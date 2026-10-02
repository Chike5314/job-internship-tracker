"""Identifier generation."""
import uuid


def new_id(prefix: str = "") -> str:
    value = uuid.uuid4().hex
    return f"{prefix}_{value}" if prefix else value


def job_id() -> str:
    return new_id("job")


def application_id() -> str:
    return new_id("app")


def cv_id() -> str:
    return new_id("cv")


def interview_id() -> str:
    return new_id("int")


def applicant_job_key(applicant_id: str, job_id_value: str) -> str:
    """The uniqueness key behind FR-5.3.

    A conditional put on this attribute is what actually prevents a second
    application to the same posting, rather than a read followed by a write,
    which two concurrent submissions could both pass.
    """
    return f"{applicant_id}#{job_id_value}"
