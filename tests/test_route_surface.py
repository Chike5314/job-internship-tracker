"""Every path the frontend asks for has to exist on the API.

This file exists because the same defect landed three times. A route that is
not in the stack does not fail loudly: API Gateway matches the request against
whatever resource it does have, so `/companies/mine` quietly became
`/companies/{id}` with an id of "mine", and `/jobs/mine/{id}` became nothing at
all and answered 403 with a message about authentication. Both read, from the
browser, as "the backend is not sending data".

The first test below compares the two lists mechanically, so a frontend call
added without its route fails here rather than in somebody's browser.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]


def deployed_routes():
    stack = (ROOT / "infrastructure" / "application_stack.py").read_text(encoding="utf-8")
    return {
        (m.group(2), m.group(1))
        for m in re.finditer(r'route\(\s*"([^"]+)"\s*,\s*"([A-Z]+)"', stack)
    }


def frontend_calls():
    calls = {}
    for path in (ROOT / "frontend" / "src" / "api").glob("*.ts"):
        text = path.read_text(encoding="utf-8")
        for m in re.finditer(r"http\.(get|post|patch|put|delete)\(\s*[`'\"]([^`'\"]+)", text):
            asked = re.sub(r"\$\{[^}]+\}", "{id}", m.group(2))
            calls.setdefault((m.group(1).upper(), asked), set()).add(path.name)
    return calls


def resolves_to(verb, asked, routes):
    """What API Gateway would match, which is not always what was meant.

    Candidates are ranked the way API Gateway ranks them: a literal segment
    beats a path parameter at the same position. Without that, a set iterated in
    any order reports `/companies/mine` as falling into `/companies/{id}` even
    when the literal route is right there.
    """
    best = None
    for rverb, rpath in routes:
        if rverb != verb:
            continue
        a, b = asked.strip("/").split("/"), rpath.strip("/").split("/")
        if len(a) != len(b):
            continue
        if not all(seg.startswith("{") or ap == seg for ap, seg in zip(a, b)):
            continue
        literals = sum(1 for seg in b if not seg.startswith("{"))
        if best is None or literals > best[0]:
            best = (literals, rpath)
    return best[1] if best else None


def test_every_frontend_call_has_a_route_of_its_own():
    routes = deployed_routes()
    wrong = []
    for (verb, asked), files in sorted(frontend_calls().items()):
        hit = resolves_to(verb, asked, routes)
        if hit is None:
            wrong.append(f"{verb} {asked} has no route at all ({', '.join(sorted(files))})")
        elif hit != asked and not any(s.startswith("{") for s in asked.strip("/").split("/")):
            # A literal segment swallowed by a path parameter. It answers, with
            # the wrong handler and, where that route is public, no caller.
            wrong.append(f"{verb} {asked} falls into {hit} ({', '.join(sorted(files))})")
    assert not wrong, "frontend calls the API cannot serve:\n  " + "\n  ".join(wrong)


def test_the_routes_a_public_one_would_swallow_are_declared_first():
    """A literal path beside a parameter is the shape that caused this, so the
    stack keeps them together and this records why."""
    routes = deployed_routes()
    for literal, parameterised in [
        ("/companies/mine", "/companies/{id}"),
        ("/jobs/mine", "/jobs/{id}"),
    ]:
        assert ("GET", literal) in routes, f"{literal} is missing"
        assert ("GET", parameterised) in routes
