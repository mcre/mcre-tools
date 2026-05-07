import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


TOOL_GROUP_ROULETTE = "group-roulette"
ROOM_ACTIVE_SECONDS = 24 * 60 * 60
RAW_RETENTION_SECONDS = 90 * 24 * 60 * 60
CONNECTION_TTL_SECONDS = 2 * 60 * 60
REQUEST_TTL_SECONDS = 24 * 60 * 60
MAX_OPTIONS = 100


class RealtimeRepositoryError(Exception):
    pass


class RoomNotFoundError(RealtimeRepositoryError):
    pass


class RoomExpiredError(RealtimeRepositoryError):
    pass


class RoomStateError(RealtimeRepositoryError):
    pass


class TooManyOptionsError(RealtimeRepositoryError):
    pass


def _as_utc(now: datetime) -> datetime:
    if now.tzinfo is None:
        return now.replace(tzinfo=timezone.utc)
    return now.astimezone(timezone.utc)


def _epoch(now: datetime) -> int:
    return int(_as_utc(now).timestamp())


def _epoch_after(now: datetime, seconds: int) -> int:
    return int((_as_utc(now) + timedelta(seconds=seconds)).timestamp())


def _event_id(now: datetime, request_id: str) -> str:
    return f"event_{int(_as_utc(now).timestamp() * 1000)}_{request_id}"


def room_item_id(room_id: str) -> str:
    return f"GroupRouletteRoom|{room_id}"


def member_item_id(room_id: str, member_id: str) -> str:
    return f"GroupRouletteMember|{room_id}|{member_id}"


def connection_item_id(connection_id: str) -> str:
    return f"RealtimeConnection|{connection_id}"


def option_item_id(room_id: str, option_id: str) -> str:
    return f"GroupRouletteOption|{room_id}|{option_id}"


def event_item_id(room_id: str, event_id: str) -> str:
    return f"GroupRouletteEvent|{room_id}|{event_id}"


def request_item_id(room_id: str, request_id: str) -> str:
    return f"RealtimeRequest|{room_id}|{request_id}"


def room_item(room_id: str, host_token_hash: str, now: datetime) -> Dict[str, Any]:
    timestamp = _epoch(now)
    return {
        "id": room_item_id(room_id),
        "order": timestamp,
        "created_at": timestamp,
        "updated_at": timestamp,
        "expires_at": _epoch_after(now, ROOM_ACTIVE_SECONDS),
        "ttl": _epoch_after(now, RAW_RETENTION_SECONDS),
        "host_token_hash": host_token_hash,
        "status": "waiting",
        "revision": 1,
        "guest_add_enabled": True,
        "guest_sequence": 0,
        "option_sequence": 0,
        "active_options": [],
        "current_spin": None,
    }


def member_item(
    room_id: str,
    member_id: str,
    display_name: str,
    role: str,
    now: datetime,
    connected: bool = True,
) -> Dict[str, Any]:
    timestamp = _epoch(now)
    return {
        "id": member_item_id(room_id, member_id),
        "search_key_1": f"GroupRouletteMember|room_id={room_id}",
        "order": timestamp,
        "created_at": timestamp,
        "updated_at": timestamp,
        "ttl": _epoch_after(now, RAW_RETENTION_SECONDS),
        "display_name": display_name,
        "role": role,
        "connected": connected,
    }


def connection_item(
    connection_id: str,
    tool: str,
    room_id: str,
    member_id: str,
    now: datetime,
) -> Dict[str, Any]:
    timestamp = _epoch(now)
    return {
        "id": connection_item_id(connection_id),
        "search_key_1": f"RealtimeConnection|tool={tool}|room_id={room_id}",
        "order": timestamp,
        "ttl": _epoch_after(now, CONNECTION_TTL_SECONDS),
        "tool": tool,
        "room_id": room_id,
        "member_id": member_id,
        "connected_at": timestamp,
        "last_seen_at": timestamp,
    }


def option_item(
    room_id: str,
    option_id: str,
    label: str,
    added_by_member_id: str,
    order: int,
    now: datetime,
    archived: bool = False,
) -> Dict[str, Any]:
    timestamp = _epoch(now)
    return {
        "id": option_item_id(room_id, option_id),
        "search_key_1": f"GroupRouletteOption|room_id={room_id}",
        "order": order,
        "created_at": timestamp,
        "updated_at": timestamp,
        "ttl": _epoch_after(now, RAW_RETENTION_SECONDS),
        "label": label,
        "added_by_member_id": added_by_member_id,
        "archived": archived,
    }


def event_item(
    room_id: str,
    event_id: str,
    event_type: str,
    member_id: str,
    payload: dict,
    now: datetime,
) -> Dict[str, Any]:
    timestamp = _epoch(now)
    return {
        "id": event_item_id(room_id, event_id),
        "search_key_1": f"GroupRouletteEvent|room_id={room_id}",
        "order": timestamp,
        "created_at": timestamp,
        "ttl": _epoch_after(now, RAW_RETENTION_SECONDS),
        "type": event_type,
        "member_id": member_id,
        "payload": payload,
    }


def request_item(
    room_id: str,
    request_id: str,
    member_id: str,
    request_type: str,
    now: datetime,
) -> Dict[str, Any]:
    timestamp = _epoch(now)
    return {
        "id": request_item_id(room_id, request_id),
        "ttl": _epoch_after(now, REQUEST_TTL_SECONDS),
        "tool": TOOL_GROUP_ROULETTE,
        "room_id": room_id,
        "member_id": member_id,
        "type": request_type,
        "created_at": timestamp,
    }


def create_room(room_id: str, host_token_hash: str, now: datetime) -> Dict[str, Any]:
    item = room_item(room_id, host_token_hash, now)
    _put_item(item, condition_expression="attribute_not_exists(id)")
    return item


def add_option(
    room_id: str,
    member_id: str,
    request_id: str,
    label: str,
    now: datetime,
) -> Dict[str, Any]:
    room = _get_room(room_id)
    if room is None:
        raise RoomNotFoundError(room_id)

    timestamp = _epoch(now)
    if int(room.get("expires_at", 0)) <= timestamp:
        raise RoomExpiredError(room_id)
    if room.get("status") != "waiting":
        raise RoomStateError(room.get("status"))

    active_options = list(room.get("active_options") or [])
    if len(active_options) >= MAX_OPTIONS:
        raise TooManyOptionsError(room_id)

    option_order = int(room.get("option_sequence", 0)) + 1
    option_id = f"option_{option_order}"
    next_revision = int(room.get("revision", 0)) + 1
    active_option = {
        "id": option_id,
        "label": label,
        "order": option_order,
        "added_by_member_id": member_id,
    }
    next_active_options = active_options + [active_option]
    event_id = _event_id(now, request_id)

    transaction = [
        {
            "Update": {
                "Key": {"id": room_item_id(room_id)},
                "UpdateExpression": (
                    "SET active_options = :active_options, "
                    "option_sequence = :option_sequence, "
                    "revision = :next_revision, "
                    "updated_at = :updated_at"
                ),
                "ConditionExpression": (
                    "attribute_exists(id) AND "
                    "revision = :expected_revision AND "
                    "expires_at > :now AND "
                    "#status = :waiting"
                ),
                "ExpressionAttributeNames": {
                    "#status": "status",
                },
                "ExpressionAttributeValues": {
                    ":active_options": next_active_options,
                    ":option_sequence": option_order,
                    ":next_revision": next_revision,
                    ":updated_at": timestamp,
                    ":expected_revision": int(room.get("revision", 0)),
                    ":now": timestamp,
                    ":waiting": "waiting",
                },
            }
        },
        {
            "Put": {
                "Item": option_item(
                    room_id,
                    option_id,
                    label=label,
                    added_by_member_id=member_id,
                    order=option_order,
                    now=now,
                ),
                "ConditionExpression": "attribute_not_exists(id)",
            }
        },
        {
            "Put": {
                "Item": event_item(
                    room_id,
                    event_id,
                    event_type="optionAdded",
                    member_id=member_id,
                    payload={"optionId": option_id},
                    now=now,
                ),
                "ConditionExpression": "attribute_not_exists(id)",
            }
        },
        {
            "Put": {
                "Item": request_item(
                    room_id,
                    request_id,
                    member_id=member_id,
                    request_type="addOption",
                    now=now,
                ),
                "ConditionExpression": "attribute_not_exists(id)",
            }
        },
    ]
    _write_transaction(transaction)
    return {"option": active_option, "revision": next_revision}


def delete_connection(connection_id: str) -> None:
    _table().delete_item(Key={"id": connection_item_id(connection_id)})


def _table_name() -> str:
    table_name = os.getenv("DYNAMO_DB_PRIMARY_TABLE_NAME")
    if not table_name:
        raise RealtimeRepositoryError("DYNAMO_DB_PRIMARY_TABLE_NAME is not set")
    return table_name


def _table():
    import boto3

    return boto3.resource("dynamodb").Table(_table_name())


def _dynamodb_client():
    import boto3

    return boto3.client("dynamodb")


def _put_item(item: dict, condition_expression: Optional[str] = None) -> None:
    kwargs = {"Item": item}
    if condition_expression:
        kwargs["ConditionExpression"] = condition_expression
    _table().put_item(**kwargs)


def _get_room(room_id: str) -> Optional[dict]:
    response = _table().get_item(Key={"id": room_item_id(room_id)})
    return response.get("Item")


def _serialize(value: Any) -> dict:
    from boto3.dynamodb.types import TypeSerializer

    return TypeSerializer().serialize(value)


def _serialize_values(values: Optional[dict]) -> Optional[dict]:
    if values is None:
        return None
    return {key: _serialize(value) for key, value in values.items()}


def _serialize_dict(values: dict) -> dict:
    return {key: _serialize(value) for key, value in values.items()}


def _serialize_transaction_item(item: dict) -> dict:
    operation, payload = next(iter(item.items()))
    serialized_payload = dict(payload)
    serialized_payload["TableName"] = _table_name()

    if "Item" in serialized_payload:
        serialized_payload["Item"] = _serialize_dict(serialized_payload["Item"])
    if "Key" in serialized_payload:
        serialized_payload["Key"] = _serialize_dict(serialized_payload["Key"])
    if "ExpressionAttributeValues" in serialized_payload:
        serialized_payload["ExpressionAttributeValues"] = _serialize_values(
            serialized_payload["ExpressionAttributeValues"]
        )

    return {operation: serialized_payload}


def _write_transaction(transaction_items: List[dict]) -> None:
    _dynamodb_client().transact_write_items(
        TransactItems=[
            _serialize_transaction_item(item) for item in transaction_items
        ],
    )
