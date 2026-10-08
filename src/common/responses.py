"""HTTP response helpers and the JSON encoding DynamoDB needs."""
import decimal
import json
from typing import Any, Dict, Optional

from common import config


class _Encoder(json.JSONEncoder):
    """DynamoDB returns numbers as Decimal, which json cannot serialise."""

    def default(self, o):
        if isinstance(o, decimal.Decimal):
            return int(o) if o == o.to_integral_value() else float(o)
        if isinstance(o, set):
            return sorted(o)
        return super().default(o)


def _cors_headers(origin: Optional[str] = None) -> Dict[str, str]:
    allowed = config.ALLOWED_ORIGINS
    if "*" in allowed or origin is None:
        value = allowed[0] if allowed and "*" not in allowed else "*"
    else:
        value = origin if origin in allowed else allowed[0]
    return {
        "Access-Control-Allow-Origin": value,
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        "Vary": "Origin",
    }


def with_cors(response: Dict[str, Any], origin: Optional[str]) -> Dict[str, Any]:
    """Names the caller's own origin on a response built without it."""
    if isinstance(response, dict) and origin is not None:
        response["headers"] = {**(response.get("headers") or {}), **_cors_headers(origin)}
    return response


def respond(
    status_code: int, body: Any, *, origin: Optional[str] = None
) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json", **_cors_headers(origin)},
        "body": json.dumps(body, cls=_Encoder),
    }


def ok(body: Any, **kwargs) -> Dict[str, Any]:
    return respond(200, body, **kwargs)


def created(body: Any, **kwargs) -> Dict[str, Any]:
    return respond(201, body, **kwargs)


def accepted(body: Any, **kwargs) -> Dict[str, Any]:
    return respond(202, body, **kwargs)


def no_content(**kwargs) -> Dict[str, Any]:
    return respond(204, {}, **kwargs)
