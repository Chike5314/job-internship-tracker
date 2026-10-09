#!/usr/bin/env python3
"""Write the sample documents the demo applicants upload, as real one page PDFs.

The backend checks that an upload is a PDF by its extension and content type,
and a recruiter opens it in the review page, so each file has to be a valid
PDF with readable text rather than a placeholder. Standard library only.

Usage:
    python scripts/make_demo_files.py            # writes docs/demo-files/
"""
import os
import sys

OUT = os.path.join(os.path.dirname(__file__), "..", "docs", "demo-files")


def pdf(lines):
    """A single A4 page of Helvetica text, one entry per line; '#' marks a heading."""
    ops = ["BT", "/F1 11 Tf", "56 790 Td", "16 TL"]
    for line in lines:
        text = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        if line.startswith("# "):
            ops += ["/F2 15 Tf", f"({text[2:]}) Tj", "T*", "/F1 11 Tf"]
        else:
            ops += [f"({text}) Tj", "T*"]
    ops.append("ET")
    stream = "\n".join(ops).encode("latin-1")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for offset in offsets:
        out += f"{offset:010d} 00000 n \n".encode()
    out += f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return out


def cv(name, contact, school, field, skills, experience):
    return [
        f"# {name}",
        contact,
        "",
        "# Education",
        school,
        field,
        "",
        "# Skills",
        skills,
        "",
        "# Experience",
        *experience,
        "",
        "Sample document for the Offerline demo. The person is fictional.",
    ]


FILES = {
    "CV_Ngwa_Brenda.pdf": cv(
        "Brenda Ngwa",
        "Buea, South West Region, Cameroon",
        "University of Buea, Faculty of Science",
        "BSc Computer Science, final year",
        "Python, Linux, AWS basics (EC2, S3, Lambda), Git, SQL",
        [
            "2025  Volunteer IT support, campus computer lab, University of Buea",
            "2024  Built a timetable web app for her department (Python, Flask)",
        ],
    ),
    "CV_Tabe_Emmanuel.pdf": cv(
        "Emmanuel Tabe",
        "Douala, Littoral Region, Cameroon",
        "University of Douala, Faculty of Economics",
        "BSc Statistics and Economics, graduated 2025",
        "Excel, SQL, Power BI, Python (pandas), report writing",
        [
            "2025  Data entry and reporting assistant, a microfinance office, Douala",
            "2024  Survey analysis for a student research project on mobile money",
        ],
    ),
    "CV_Fon_Mirabel.pdf": cv(
        "Mirabel Fon",
        "Yaounde, Centre Region, Cameroon",
        "University of Yaounde II, Advanced School of Mass Communication",
        "BA Communication, third year",
        "Content writing (English and French), Canva, social media, photography",
        [
            "2025  Ran social media pages for a student association",
            "2024  Wrote articles for the campus newsletter",
        ],
    ),
    "Transcript_Ngwa_Brenda.pdf": [
        "# Academic transcript",
        "University of Buea, Faculty of Science",
        "Student: Brenda Ngwa    Programme: BSc Computer Science",
        "",
        "CSC 301  Operating Systems              A",
        "CSC 305  Computer Networks              B+",
        "CSC 311  Database Systems               A",
        "CSC 317  Software Engineering           A-",
        "CSC 321  Introduction to Cloud Computing A",
        "",
        "Cumulative GPA: 3.62 / 4.00",
        "",
        "Sample document for the Offerline demo. The person is fictional.",
    ],
    "School_Authorisation_Ngwa_Brenda.pdf": [
        "# Internship authorisation letter",
        "University of Buea, Department of Computer Science",
        "",
        "To whom it may concern,",
        "",
        "This is to confirm that Brenda Ngwa is a registered final year student",
        "in the Department of Computer Science and is authorised to undertake an",
        "academic internship of three months as part of her programme.",
        "",
        "The department will assign an academic supervisor and expects a short",
        "report from the host organisation at the end of the internship.",
        "",
        "Head of Department",
        "",
        "Sample document for the Offerline demo. The person is fictional.",
    ],
}


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for name, lines in FILES.items():
        with open(os.path.join(OUT, name), "wb") as handle:
            handle.write(pdf(lines))
        print(f"wrote docs/demo-files/{name}")


if __name__ == "__main__":
    sys.exit(main())
