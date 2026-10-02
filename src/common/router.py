"""A small router so that one Lambda function can serve a domain's routes.

Handlers are grouped by business domain rather than one function per endpoint,
which is the constraint recorded in SRS section 2.5. This is what lets a single
function dispatch the handful of routes that belong to it.
"""
import functools
import json
import logging
import traceback
from typing import Any, Callable, Dict, List, Tuple

from common.errors import AppError, ValidationError
from common.responses import respond

logger = logging.getLogger()
logger.setLevel(logging.INFO)

Handler = Callable[..., Dict[str, Any]]


class Router:
    def __init__(self, name: str):
        self.name = name
        self._routes: List[Tuple[str, str, Handler]] = []

    def add(self, method: str, resource: str, handler: Handler) -> None:
        self._routes.append((method.upper(), resource, handler))

    def route(self, method: str, resource: str):
        def decorator(fn: Handler) -> Handler:
            self.add(method, resource, fn)
            return fn

        return decorator

    def dispatch(self, event: Dict[str, Any], context: Any) -> Dict[str, Any]:
        method = (event.get("httpMethod") or "").upper()
        # The resource template, for example /applications/{id}, not the
        # concrete path. Matching on the template keeps the table readable.
        resource = event.get("resource") or event.get("path") or ""

        for route_method, route_resource, handler in self._routes:
            if route_method == method and route_resource == resource:
                return handler(event, context)

        return respond(
            404,
            {"error": {"code": "NOT_FOUND", "message": "This route does not exist."}},
        )


def api_handler(router: Router) -> Callable:
    """Wraps dispatch with the error contract from SRS section 3.11."""

    @functools.wraps(router.dispatch)
    def wrapper(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
        origin = (event.get("headers") or {}).get("origin") or (
            event.get("headers") or {}
        ).get("Origin")
        try:
            return router.dispatch(event, context)
        except AppError as exc:
            # FR-11.4. Enough context to diagnose, nothing from a document.
            logger.warning(
                "rejected request service=%s method=%s resource=%s code=%s detail=%s",
                router.name,
                event.get("httpMethod"),
                event.get("resource"),
                exc.code,
                exc.message,
            )
            return respond(exc.status_code, exc.to_body(), origin=origin)
        except Exception:  # noqa: BLE001 - deliberate catch all at the boundary
            logger.error(
                "unhandled error service=%s resource=%s\n%s",
                router.name,
                event.get("resource"),
                traceback.format_exc(),
            )
            return respond(
                500,
                {
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "Something went wrong on our side. Please try again.",
                    }
                },
                origin=origin,
            )

    return wrapper


def parse_body(event: Dict[str, Any]) -> Dict[str, Any]:
    raw = event.get("body")
    if raw in (None, ""):
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        raise ValidationError("The request body is not valid JSON.")
    if not isinstance(parsed, dict):
        raise ValidationError("The request body must be a JSON object.")
    return parsed


def path_param(event: Dict[str, Any], name: str) -> str:
    value = (event.get("pathParameters") or {}).get(name)
    if not value:
        raise ValidationError(f"The {name} path parameter is missing.")
    return value


def query_params(event: Dict[str, Any]) -> Dict[str, str]:
    return event.get("queryStringParameters") or {}
