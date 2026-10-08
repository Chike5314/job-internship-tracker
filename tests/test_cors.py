"""The origin a response names, once more than one frontend is allowed.

Each deployed frontend has to see its own origin echoed back. A response that
names a different one is blocked by the browser, and from the page that reads
exactly like the backend sending nothing.
"""
from common import config
from common.errors import NotFoundError
from common.responses import ok
from common.router import Router, api_handler

LOCAL = "http://localhost:3000"
HOSTED = "https://main.example.amplifyapp.com"


def _handler():
    router = Router("cors-test")

    @router.route("GET", "/things")
    def things(_event, _context):
        return ok({"things": []})

    @router.route("GET", "/missing")
    def missing(_event, _context):
        raise NotFoundError("Nothing here.")

    return api_handler(router)


def _call(path, origin):
    event = {"httpMethod": "GET", "resource": path, "headers": {"origin": origin}}
    return _handler()(event, None)["headers"]["Access-Control-Allow-Origin"]


def test_a_success_names_the_callers_own_origin(monkeypatch):
    monkeypatch.setattr(config, "ALLOWED_ORIGINS", [LOCAL, HOSTED])
    assert _call("/things", HOSTED) == HOSTED
    assert _call("/things", LOCAL) == LOCAL


def test_an_error_names_the_callers_own_origin(monkeypatch):
    monkeypatch.setattr(config, "ALLOWED_ORIGINS", [LOCAL, HOSTED])
    assert _call("/missing", HOSTED) == HOSTED


def test_an_unlisted_origin_is_not_echoed(monkeypatch):
    monkeypatch.setattr(config, "ALLOWED_ORIGINS", [LOCAL, HOSTED])
    assert _call("/things", "https://elsewhere.example") == LOCAL
