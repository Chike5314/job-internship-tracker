"""In house document parsing.

SRS section 2.6 and open decision 8.1. Text is pulled out of the uploaded object
with the standard library alone, so the MVP carries no paid third party API. The
credentials in Secrets Manager are read here because the parsing routine is the
component that would use them if the open decision resolves toward an external
service, and reading them now keeps that swap to one function.

What this can and cannot do is worth being plain about. A DOCX is a zip of XML
and reads cleanly. A PDF is read from its uncompressed and Flate compressed text
operators, which works for a PDF produced by a word processor and does not work
for a scanned page, since a scan holds no text at all. When nothing readable
comes back the application is left without parsed fields rather than with
guesses, and a recruiter still has the document itself.
"""
import functools
import json
import logging
import re
import zipfile
import zlib
from io import BytesIO
from typing import Any, Dict, List, Optional

import boto3

from common import config, storage

logger = logging.getLogger(__name__)

EMAIL_PATTERN = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_PATTERN = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")
LINK_PATTERN = re.compile(r"https?://[^\s<>\"')]+")

# A small, explicit vocabulary. It is deliberately visible in source rather than
# learned, because a recruiter reading a parsed summary needs to know exactly
# what the system looked for.
SKILL_VOCABULARY = [
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust", "php",
    "sql", "postgresql", "mysql", "dynamodb", "mongodb",
    "aws", "azure", "gcp", "lambda", "docker", "kubernetes", "terraform", "cdk",
    "react", "next.js", "angular", "vue", "node.js", "django", "flask", "spring",
    "html", "css", "tailwind", "figma",
    "machine learning", "data analysis", "pandas", "numpy", "tensorflow", "pytorch",
    "git", "ci/cd", "rest", "graphql", "linux", "networking", "cisco",
    "matlab", "autocad", "solidworks", "plc", "embedded", "arduino",
    "project management", "scrum", "agile", "communication", "teamwork",
]

SECTION_HEADINGS = [
    "education", "experience", "work experience", "projects", "skills",
    "certifications", "languages", "references", "summary", "objective",
]


@functools.lru_cache(maxsize=1)
def _secrets_client():
    return boto3.client("secretsmanager")


@functools.lru_cache(maxsize=1)
def parsing_credentials() -> Dict[str, Any]:
    """Read once per container.

    Nothing outside this module sees these values, and none of them is ever
    written into a parsed result or a log line.
    """
    if not config.PARSING_SECRET_ARN:
        return {}
    try:
        raw = _secrets_client().get_secret_value(SecretId=config.PARSING_SECRET_ARN)
        return json.loads(raw.get("SecretString") or "{}")
    except Exception:  # noqa: BLE001
        logger.warning("parsing credentials are not available, continuing without them")
        return {}


# ----------------------------------------------------------------------
# Text extraction
# ----------------------------------------------------------------------
def extract_text(raw: bytes, s3_key: str) -> str:
    extension = s3_key.rsplit(".", 1)[-1].lower() if "." in s3_key else ""
    if extension == "docx" or raw[:2] == b"PK":
        return _from_docx(raw)
    if extension == "pdf" or raw[:5] == b"%PDF-":
        return _from_pdf(raw)
    return raw.decode("utf-8", errors="ignore")


def _from_docx(raw: bytes) -> str:
    try:
        with zipfile.ZipFile(BytesIO(raw)) as archive:
            xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
    except (KeyError, zipfile.BadZipFile):
        return ""
    # Paragraph breaks first, so headings do not run into the line beneath them.
    xml = re.sub(r"</w:p>", "\n", xml)
    xml = re.sub(r"<w:tab[^>]*/>", " ", xml)
    text = re.sub(r"<[^>]+>", "", xml)
    return _tidy(text)


def _from_pdf(raw: bytes) -> str:
    chunks: List[str] = []
    for match in re.finditer(rb"stream\r?\n(.*?)endstream", raw, re.DOTALL):
        payload = match.group(1)
        try:
            payload = zlib.decompress(payload)
        except zlib.error:
            pass  # An uncompressed stream is read as it is.
        chunks.append(_text_operators(payload))
    return _tidy(" ".join(chunk for chunk in chunks if chunk))


def _text_operators(payload: bytes) -> str:
    try:
        content = payload.decode("latin-1")
    except UnicodeDecodeError:
        return ""
    if "Tj" not in content and "TJ" not in content:
        return ""
    pieces = re.findall(r"\((?:\\.|[^\\()])*\)", content)
    out = []
    for piece in pieces:
        body = piece[1:-1]
        body = body.replace("\\(", "(").replace("\\)", ")").replace("\\\\", "\\")
        out.append(body)
    return " ".join(out)


def _tidy(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text.strip()


# ----------------------------------------------------------------------
# Field extraction
# ----------------------------------------------------------------------
def summarise(text: str) -> Dict[str, Any]:
    lowered = text.lower()
    skills = sorted({skill for skill in SKILL_VOCABULARY if skill in lowered})
    sections = sorted({heading for heading in SECTION_HEADINGS if heading in lowered})

    emails = EMAIL_PATTERN.findall(text)
    phones = [
        candidate.strip()
        for candidate in PHONE_PATTERN.findall(text)
        if len(re.sub(r"\D", "", candidate)) >= 8
    ]
    links = LINK_PATTERN.findall(text)

    words = len(text.split())
    return {
        "wordCount": words,
        "skills": skills[:40],
        "sectionsFound": sections,
        "emails": sorted(set(emails))[:3],
        "phones": sorted(set(phones))[:3],
        "links": sorted(set(links))[:10],
        # A rough completeness reading the recruiter can sort on. It says how
        # much of the usual shape of a CV was actually found, and nothing more.
        "completeness": round(min(1.0, (len(sections) / 5) * 0.6 + (min(words, 600) / 600) * 0.4), 2),
    }


def parse_document(s3_key: str) -> Optional[Dict[str, Any]]:
    try:
        raw = storage.get_object_bytes(s3_key)
    except Exception:  # noqa: BLE001
        logger.warning("could not read an uploaded object for parsing")
        return None

    text = extract_text(raw, s3_key)
    if not text.strip():
        # A scanned page, or a format this routine cannot read. The recruiter
        # still has the document, so nothing is guessed here.
        return {"readable": False}

    result = summarise(text)
    result["readable"] = True
    return result


def parse_documents(document_keys: Dict[str, str]) -> Dict[str, Any]:
    """Parses only what is worth parsing.

    A CV and a cover letter carry the text a recruiter would search. A
    transcript or an authorisation letter is read by a person, so it is left
    alone rather than run through a routine that would add nothing.
    """
    parsing_credentials()  # loaded here so the swap in open decision 8.1 is local

    wanted = {"cv", "coverLetter"}
    parsed: Dict[str, Any] = {}
    for document_key, s3_key in document_keys.items():
        if document_key not in wanted or not s3_key:
            continue
        outcome = parse_document(s3_key)
        if outcome:
            parsed[document_key] = outcome
    return parsed
