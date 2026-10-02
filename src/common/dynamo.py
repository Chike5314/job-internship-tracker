"""DynamoDB access.

Table resources are created once per container and reused across invocations.
The helpers here cover the small number of shapes the handlers actually need, so
that no handler has to assemble an UpdateExpression by hand.
"""
import functools
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Tuple

import boto3
from boto3.dynamodb.conditions import Key

from common import config


@functools.lru_cache(maxsize=1)
def _resource():
    return boto3.resource("dynamodb")


@functools.lru_cache(maxsize=8)
def table(name: str):
    return _resource().Table(name)


def users():
    return table(config.USERS_TABLE)


def companies():
    return table(config.COMPANIES_TABLE)


def jobs():
    return table(config.JOBS_TABLE)


def applications():
    return table(config.APPLICATIONS_TABLE)


def notifications():
    return table(config.NOTIFICATIONS_TABLE)


def to_dynamo(value: Any) -> Any:
    """floats are not storable, so every number becomes a Decimal on the way in."""
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, dict):
        return {k: to_dynamo(v) for k, v in value.items() if v is not None}
    if isinstance(value, list):
        return [to_dynamo(v) for v in value]
    return value


def from_dynamo(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict):
        return {k: from_dynamo(v) for k, v in value.items()}
    if isinstance(value, list):
        return [from_dynamo(v) for v in value]
    return value


def build_update(changes: Dict[str, Any]) -> Tuple[str, Dict[str, str], Dict[str, Any]]:
    """Turns a plain dict of attributes into a SET update expression.

    Attribute names are aliased because several of the fields in this system,
    status among them, are DynamoDB reserved words.
    """
    parts: List[str] = []
    names: Dict[str, str] = {}
    values: Dict[str, Any] = {}
    for index, (field, value) in enumerate(changes.items()):
        name_key = f"#f{index}"
        value_key = f":v{index}"
        names[name_key] = field
        values[value_key] = to_dynamo(value)
        parts.append(f"{name_key} = {value_key}")
    return "SET " + ", ".join(parts), names, values


def query_all(
    tbl,
    *,
    key_condition,
    index_name: Optional[str] = None,
    filter_expression=None,
    scan_forward: bool = False,
    limit: Optional[int] = None,
    page_cap: int = 20,
) -> List[Dict[str, Any]]:
    """Query with pagination, capped so one request cannot run away.

    page_cap exists because a filter expression can reject a whole page, and a
    query that keeps paging through a large table is exactly the cost the SRS
    warns about in section 4.6.
    """
    items: List[Dict[str, Any]] = []
    kwargs: Dict[str, Any] = {
        "KeyConditionExpression": key_condition,
        "ScanIndexForward": scan_forward,
    }
    if index_name:
        kwargs["IndexName"] = index_name
    if filter_expression is not None:
        kwargs["FilterExpression"] = filter_expression

    pages = 0
    last_key = None
    while pages < page_cap:
        if last_key:
            kwargs["ExclusiveStartKey"] = last_key
        response = tbl.query(**kwargs)
        items.extend(response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        pages += 1
        if not last_key:
            break
        if limit is not None and len(items) >= limit:
            break

    return items[:limit] if limit is not None else items


def by_partition(
    tbl, key_name: str, key_value: str, **kwargs
) -> List[Dict[str, Any]]:
    return query_all(tbl, key_condition=Key(key_name).eq(key_value), **kwargs)


def approximate_count(tbl) -> Optional[int]:
    """The row count DynamoDB already keeps, rather than a scan.

    It is refreshed roughly every six hours, so a caller has to describe it as
    approximate. It costs one describe call, where counting by scan would read
    every row in the table.
    """
    try:
        return int(tbl.item_count)
    except Exception:  # noqa: BLE001
        return None


def chunked(values: Iterable[Any], size: int) -> Iterable[List[Any]]:
    batch: List[Any] = []
    for value in values:
        batch.append(value)
        if len(batch) == size:
            yield batch
            batch = []
    if batch:
        yield batch
