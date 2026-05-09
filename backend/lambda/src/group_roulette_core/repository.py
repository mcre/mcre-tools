import hashlib
import json
import os
import secrets
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


TOOL_GROUP_ROULETTE = "group-roulette"
ROOM_ACTIVE_SECONDS = 24 * 60 * 60
RAW_RETENTION_SECONDS = 90 * 24 * 60 * 60
REQUEST_TTL_SECONDS = 24 * 60 * 60
MAX_OPTIONS = 100
STOP_DURATION_SECONDS = 3


class GroupRouletteRepositoryError(Exception):
    pass


class RoomNotFoundError(GroupRouletteRepositoryError):
    pass


class RoomExpiredError(GroupRouletteRepositoryError):
    pass


class RoomStateError(GroupRouletteRepositoryError):
    pass


class TooManyOptionsError(GroupRouletteRepositoryError):
    pass


class PermissionDeniedError(GroupRouletteRepositoryError):
    pass


class EmptyOptionsError(GroupRouletteRepositoryError):
    pass


class MemberNotFoundError(GroupRouletteRepositoryError):
    pass


class InvalidInputError(GroupRouletteRepositoryError):
    pass


class IdempotencyConflictError(GroupRouletteRepositoryError):
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


def _spin_id(now: datetime, request_id: str) -> str:
    return f"spin_{int(_as_utc(now).timestamp() * 1000)}_{request_id}"


def _new_member_id() -> str:
    return f"member_{secrets.token_urlsafe(12)}"


def _hash_host_token(host_token: str) -> str:
    return hashlib.sha256(host_token.encode("utf-8")).hexdigest()


def _clean_text(value: Optional[str], max_length: int) -> str:
    text = "" if value is None else str(value)
    text = unicodedata.normalize("NFKC", text)
    text = "".join(
        char
        for char in text
        if not unicodedata.category(char).startswith("C")
    ).strip()
    return text[:max_length]


def payload_hash(payload: dict) -> str:
    encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def room_item_id(room_id: str) -> str:
    return f"GroupRouletteRoom|{room_id}"


def member_item_id(room_id: str, member_id: str) -> str:
    return f"GroupRouletteMember|{room_id}|{member_id}"


def option_item_id(room_id: str, option_id: str) -> str:
    return f"GroupRouletteOption|{room_id}|{option_id}"


def event_item_id(room_id: str, event_id: str) -> str:
    return f"GroupRouletteEvent|{room_id}|{event_id}"


def request_item_id(room_id: str, request_id: str) -> str:
    return f"GroupRouletteRequest|{room_id}|{request_id}"


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
    payload_hash: str,
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
        "payload_hash": payload_hash,
        "created_at": timestamp,
    }


def create_room(room_id: str, host_token_hash: str, now: datetime) -> Dict[str, Any]:
    room = room_item(room_id, host_token_hash, now)
    host_member_id = _new_member_id()
    host_member = member_item(
        room_id,
        host_member_id,
        display_name="ホスト",
        role="host",
        now=now,
    )
    _write_transaction(
        [
            {
                "Put": {
                    "Item": room,
                    "ConditionExpression": "attribute_not_exists(id)",
                }
            },
            {
                "Put": {
                    "Item": host_member,
                    "ConditionExpression": "attribute_not_exists(id)",
                }
            },
        ]
    )
    return {
        "room": room,
        "member": {
            "id": host_member_id,
            "display_name": "ホスト",
            "role": "host",
        },
    }


def join_room(
    room_id: str,
    member_id: Optional[str],
    request_id: str,
    display_name: Optional[str],
    host_token: Optional[str],
    now: datetime,
) -> Dict[str, Any]:
    if not request_id:
        raise InvalidInputError("requestId")

    room = _get_active_room(room_id, now)
    is_host = False
    if host_token:
        _require_host_token(room, host_token)
        is_host = True

    member_id = _clean_member_id(member_id) or _new_member_id()
    role = "host" if is_host else "guest"
    cleaned_display_name = _clean_text(display_name, 40)
    next_guest_sequence = int(room.get("guest_sequence", 0)) + 1
    if not cleaned_display_name:
        cleaned_display_name = "ホスト" if is_host else f"ゲスト{next_guest_sequence}"

    request_payload_hash = payload_hash(
        {
            "displayName": cleaned_display_name,
            "host": is_host,
            "memberId": member_id,
        }
    )
    idempotent = _idempotent_result_if_exists(
        room,
        request_id,
        member_id,
        "joinRoom",
        request_payload_hash,
        now,
    )
    if idempotent is not None:
        return idempotent

    member = member_item(
        room_id,
        member_id,
        display_name=cleaned_display_name,
        role=role,
        now=now,
    )
    timestamp = _epoch(now)
    transaction: List[dict] = []
    if not is_host and not _clean_text(display_name, 40):
        transaction.append(
            {
                "Update": {
                    "Key": {"id": room_item_id(room_id)},
                    "UpdateExpression": (
                        "SET guest_sequence = :guest_sequence, updated_at = :updated_at"
                    ),
                    "ConditionExpression": (
                        "attribute_exists(id) AND "
                        "guest_sequence = :expected_guest_sequence AND "
                        "expires_at > :now"
                    ),
                    "ExpressionAttributeValues": {
                        ":guest_sequence": next_guest_sequence,
                        ":updated_at": timestamp,
                        ":expected_guest_sequence": int(room.get("guest_sequence", 0)),
                        ":now": timestamp,
                    },
                }
            }
        )
        room = {**room, "guest_sequence": next_guest_sequence, "updated_at": timestamp}
    else:
        transaction.append(
            {
                "ConditionCheck": {
                    "Key": {"id": room_item_id(room_id)},
                    "ConditionExpression": "attribute_exists(id) AND expires_at > :now",
                    "ExpressionAttributeValues": {
                        ":now": timestamp,
                    },
                }
            }
        )

    transaction.extend(
        [
            {"Put": {"Item": member}},
            {
                "Put": {
                    "Item": request_item(
                        room_id,
                        request_id,
                        member_id,
                        "joinRoom",
                        request_payload_hash,
                        now,
                    ),
                    "ConditionExpression": "attribute_not_exists(id)",
                }
            },
        ]
    )
    _write_transaction(transaction)

    return {
        "room": room,
        "member": {
            "id": member_id,
            "display_name": cleaned_display_name,
            "role": role,
        },
    }


def get_room_state(
    room_id: str,
    member_id: Optional[str],
    now: datetime,
    allow_expired: bool = False,
) -> Dict[str, Any]:
    room = _get_room(room_id)
    if room is None:
        raise RoomNotFoundError(room_id)
    if int(room.get("expires_at", 0)) <= _epoch(now):
        if not allow_expired:
            raise RoomExpiredError(room_id)
        room = {**room, "status": "expired"}
    elif _should_advance_to_result(room, now):
        room = _advance_stopping_room_to_result(room_id, room, now)

    result: Dict[str, Any] = {"room": room}
    if member_id:
        member = _get_member(room_id, member_id)
        if member:
            result["member"] = {
                "id": member_id,
                "display_name": member.get("display_name"),
                "role": member.get("role"),
            }
    return result


def add_option(
    room_id: str,
    member_id: str,
    request_id: str,
    label: str,
    host_token: Optional[str],
    now: datetime,
) -> Dict[str, Any]:
    room = _get_active_room(room_id, now)
    if room.get("status") not in ["waiting", "result"]:
        raise RoomStateError(room.get("status"))

    cleaned_label = _clean_text(label, 80)
    if not cleaned_label:
        raise InvalidInputError("label")

    request_payload_hash = payload_hash({"label": cleaned_label})
    idempotent = _idempotent_result_if_exists(
        room,
        request_id,
        member_id,
        "addOption",
        request_payload_hash,
        now,
    )
    if idempotent is not None:
        return idempotent

    member = _require_member(room_id, member_id)
    if not room.get("guest_add_enabled", True):
        _require_host_token(room, host_token)

    active_options = list(room.get("active_options") or [])
    if len(active_options) >= MAX_OPTIONS:
        raise TooManyOptionsError(room_id)

    option_order = int(room.get("option_sequence", 0)) + 1
    option_id = f"option_{option_order}"
    next_revision = int(room.get("revision", 0)) + 1
    timestamp = _epoch(now)
    active_option = {
        "id": option_id,
        "label": cleaned_label,
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
                    "#status = :next_status, "
                    "current_spin = :current_spin, "
                    "revision = :next_revision, "
                    "updated_at = :updated_at"
                ),
                "ConditionExpression": (
                    "attribute_exists(id) AND "
                    "revision = :expected_revision AND "
                    "expires_at > :now AND "
                    "#status IN (:waiting, :result)"
                ),
                "ExpressionAttributeNames": {"#status": "status"},
                "ExpressionAttributeValues": {
                    ":active_options": next_active_options,
                    ":option_sequence": option_order,
                    ":next_status": "waiting",
                    ":current_spin": None,
                    ":next_revision": next_revision,
                    ":updated_at": timestamp,
                    ":expected_revision": int(room.get("revision", 0)),
                    ":now": timestamp,
                    ":waiting": "waiting",
                    ":result": "result",
                },
            }
        },
        {
            "Put": {
                "Item": option_item(
                    room_id,
                    option_id,
                    label=cleaned_label,
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
                    member_id,
                    "addOption",
                    request_payload_hash,
                    now,
                ),
                "ConditionExpression": "attribute_not_exists(id)",
            }
        },
    ]
    _write_transaction(transaction)
    next_room = {
        **room,
        "status": "waiting",
        "active_options": next_active_options,
        "option_sequence": option_order,
        "current_spin": None,
        "revision": next_revision,
        "updated_at": timestamp,
    }
    return {"room": next_room, "member": _member_payload(member_id, member)}


def remove_option(
    room_id: str,
    member_id: str,
    request_id: str,
    option_id: str,
    host_token: Optional[str],
    now: datetime,
) -> Dict[str, Any]:
    room = _get_active_room(room_id, now)
    _require_host_token(room, host_token)
    member = _require_member(room_id, member_id)
    if room.get("status") not in ["waiting", "result"]:
        raise RoomStateError(room.get("status"))

    cleaned_option_id = _clean_text(option_id, 80)
    active_options = list(room.get("active_options") or [])
    next_active_options = [
        option for option in active_options if option.get("id") != cleaned_option_id
    ]
    if len(next_active_options) == len(active_options):
        raise InvalidInputError("optionId")

    request_payload_hash = payload_hash({"optionId": cleaned_option_id})
    idempotent = _idempotent_result_if_exists(
        room,
        request_id,
        member_id,
        "removeOption",
        request_payload_hash,
        now,
    )
    if idempotent is not None:
        return idempotent

    timestamp = _epoch(now)
    next_revision = int(room.get("revision", 0)) + 1
    event_id = _event_id(now, request_id)
    transaction = [
        {
            "Update": {
                "Key": {"id": room_item_id(room_id)},
                "UpdateExpression": (
                    "SET active_options = :active_options, "
                    "#status = :next_status, "
                    "current_spin = :current_spin, "
                    "revision = :next_revision, "
                    "updated_at = :updated_at"
                ),
                "ConditionExpression": (
                    "attribute_exists(id) AND "
                    "revision = :expected_revision AND "
                    "expires_at > :now AND "
                    "#status IN (:waiting, :result)"
                ),
                "ExpressionAttributeNames": {"#status": "status"},
                "ExpressionAttributeValues": {
                    ":active_options": next_active_options,
                    ":next_status": "waiting",
                    ":current_spin": None,
                    ":next_revision": next_revision,
                    ":updated_at": timestamp,
                    ":expected_revision": int(room.get("revision", 0)),
                    ":now": timestamp,
                    ":waiting": "waiting",
                    ":result": "result",
                },
            }
        },
        {
            "Update": {
                "Key": {"id": option_item_id(room_id, cleaned_option_id)},
                "UpdateExpression": (
                    "SET archived = :archived, updated_at = :updated_at"
                ),
                "ConditionExpression": "attribute_exists(id)",
                "ExpressionAttributeValues": {
                    ":archived": True,
                    ":updated_at": timestamp,
                },
            }
        },
        {
            "Put": {
                "Item": event_item(
                    room_id,
                    event_id,
                    event_type="optionRemoved",
                    member_id=member_id,
                    payload={"optionId": cleaned_option_id},
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
                    member_id,
                    "removeOption",
                    request_payload_hash,
                    now,
                ),
                "ConditionExpression": "attribute_not_exists(id)",
            }
        },
    ]
    _write_transaction(transaction)
    next_room = {
        **room,
        "status": "waiting",
        "active_options": next_active_options,
        "current_spin": None,
        "revision": next_revision,
        "updated_at": timestamp,
    }
    return {"room": next_room, "member": _member_payload(member_id, member)}


def set_guest_add_enabled(
    room_id: str,
    member_id: str,
    request_id: str,
    enabled: bool,
    host_token: Optional[str],
    now: datetime,
) -> Dict[str, Any]:
    room = _get_active_room(room_id, now)
    _require_host_token(room, host_token)
    member = _require_member(room_id, member_id)
    request_payload_hash = payload_hash({"enabled": bool(enabled)})
    idempotent = _idempotent_result_if_exists(
        room,
        request_id,
        member_id,
        "setGuestAddEnabled",
        request_payload_hash,
        now,
    )
    if idempotent is not None:
        return idempotent

    timestamp = _epoch(now)
    next_revision = int(room.get("revision", 0)) + 1
    event_id = _event_id(now, request_id)
    transaction = [
        {
            "Update": {
                "Key": {"id": room_item_id(room_id)},
                "UpdateExpression": (
                    "SET guest_add_enabled = :enabled, "
                    "revision = :next_revision, "
                    "updated_at = :updated_at"
                ),
                "ConditionExpression": (
                    "attribute_exists(id) AND "
                    "revision = :expected_revision AND "
                    "expires_at > :now"
                ),
                "ExpressionAttributeValues": {
                    ":enabled": bool(enabled),
                    ":next_revision": next_revision,
                    ":updated_at": timestamp,
                    ":expected_revision": int(room.get("revision", 0)),
                    ":now": timestamp,
                },
            }
        },
        {
            "Put": {
                "Item": event_item(
                    room_id,
                    event_id,
                    event_type="guestAddEnabledChanged",
                    member_id=member_id,
                    payload={"enabled": bool(enabled)},
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
                    member_id,
                    "setGuestAddEnabled",
                    request_payload_hash,
                    now,
                ),
                "ConditionExpression": "attribute_not_exists(id)",
            }
        },
    ]
    _write_transaction(transaction)
    next_room = {
        **room,
        "guest_add_enabled": bool(enabled),
        "revision": next_revision,
        "updated_at": timestamp,
    }
    return {"room": next_room, "member": _member_payload(member_id, member)}


def start_spin(
    room_id: str,
    member_id: str,
    request_id: str,
    host_token: Optional[str],
    now: datetime,
    duration_ms: int = 5000,
) -> Dict[str, Any]:
    room = _get_active_room(room_id, now)
    _require_host_token(room, host_token)
    member = _require_member(room_id, member_id)
    if room.get("status") not in ["waiting", "result"]:
        raise RoomStateError(room.get("status"))

    active_options = list(room.get("active_options") or [])
    if not active_options:
        raise EmptyOptionsError(room_id)

    duration_ms = max(1000, min(int(duration_ms or 5000), 30000))
    request_payload_hash = payload_hash({"durationMs": duration_ms})
    idempotent = _idempotent_result_if_exists(
        room,
        request_id,
        member_id,
        "startSpin",
        request_payload_hash,
        now,
    )
    if idempotent is not None:
        return idempotent

    timestamp = _epoch(now)
    next_revision = int(room.get("revision", 0)) + 1
    current_spin = {
        "id": _spin_id(now, request_id),
        "started_at": timestamp,
        "duration_ms": duration_ms,
        "options": active_options,
    }
    event_id = _event_id(now, request_id)
    transaction = [
        {
            "Update": {
                "Key": {"id": room_item_id(room_id)},
                "UpdateExpression": (
                    "SET #status = :status, "
                    "current_spin = :current_spin, "
                    "revision = :next_revision, "
                    "updated_at = :updated_at"
                ),
                "ConditionExpression": (
                    "attribute_exists(id) AND "
                    "revision = :expected_revision AND "
                    "expires_at > :now AND "
                    "#status IN (:waiting, :result)"
                ),
                "ExpressionAttributeNames": {"#status": "status"},
                "ExpressionAttributeValues": {
                    ":status": "spinning",
                    ":current_spin": current_spin,
                    ":next_revision": next_revision,
                    ":updated_at": timestamp,
                    ":expected_revision": int(room.get("revision", 0)),
                    ":now": timestamp,
                    ":waiting": "waiting",
                    ":result": "result",
                },
            }
        },
        {
            "Put": {
                "Item": event_item(
                    room_id,
                    event_id,
                    event_type="spinStarted",
                    member_id=member_id,
                    payload={"spinId": current_spin["id"]},
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
                    member_id,
                    "startSpin",
                    request_payload_hash,
                    now,
                ),
                "ConditionExpression": "attribute_not_exists(id)",
            }
        },
    ]
    _write_transaction(transaction)
    next_room = {
        **room,
        "status": "spinning",
        "current_spin": current_spin,
        "revision": next_revision,
        "updated_at": timestamp,
    }
    return {"room": next_room, "member": _member_payload(member_id, member)}


def stop_spin(
    room_id: str,
    member_id: str,
    request_id: str,
    host_token: Optional[str],
    winner_index: int,
    now: datetime,
) -> Dict[str, Any]:
    room = _get_active_room(room_id, now)
    _require_host_token(room, host_token)
    member = _require_member(room_id, member_id)
    if room.get("status") != "spinning":
        raise RoomStateError(room.get("status"))

    current_spin = dict(room.get("current_spin") or {})
    spin_options = list(current_spin.get("options") or [])
    if not spin_options:
        raise EmptyOptionsError(room_id)

    request_payload_hash = payload_hash({"spinId": current_spin.get("id")})
    idempotent = _idempotent_result_if_exists(
        room,
        request_id,
        member_id,
        "stopSpin",
        request_payload_hash,
        now,
    )
    if idempotent is not None:
        return idempotent

    selected_index = int(winner_index) % len(spin_options)
    winner_option_id = spin_options[selected_index]["id"]
    timestamp = _epoch(now)
    stop_at = _epoch_after(now, STOP_DURATION_SECONDS)
    next_revision = int(room.get("revision", 0)) + 1
    stopped_spin = {
        **current_spin,
        "winner_option_id": winner_option_id,
        "stop_at": stop_at,
    }
    event_id = _event_id(now, request_id)
    transaction = [
        {
            "Update": {
                "Key": {"id": room_item_id(room_id)},
                "UpdateExpression": (
                    "SET #status = :status, "
                    "current_spin = :current_spin, "
                    "revision = :next_revision, "
                    "updated_at = :updated_at"
                ),
                "ConditionExpression": (
                    "attribute_exists(id) AND "
                    "revision = :expected_revision AND "
                    "expires_at > :now AND "
                    "#status = :spinning"
                ),
                "ExpressionAttributeNames": {"#status": "status"},
                "ExpressionAttributeValues": {
                    ":status": "stopping",
                    ":current_spin": stopped_spin,
                    ":next_revision": next_revision,
                    ":updated_at": timestamp,
                    ":expected_revision": int(room.get("revision", 0)),
                    ":now": timestamp,
                    ":spinning": "spinning",
                },
            }
        },
        {
            "Put": {
                "Item": event_item(
                    room_id,
                    event_id,
                    event_type="spinStopped",
                    member_id=member_id,
                    payload={
                        "spinId": stopped_spin.get("id"),
                        "winnerOptionId": winner_option_id,
                    },
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
                    member_id,
                    "stopSpin",
                    request_payload_hash,
                    now,
                ),
                "ConditionExpression": "attribute_not_exists(id)",
            }
        },
    ]
    _write_transaction(transaction)
    next_room = {
        **room,
        "status": "stopping",
        "current_spin": stopped_spin,
        "revision": next_revision,
        "updated_at": timestamp,
    }
    return {"room": next_room, "member": _member_payload(member_id, member)}


def _clean_member_id(member_id: Optional[str]) -> Optional[str]:
    if not member_id:
        return None
    cleaned = _clean_text(member_id, 80)
    if not cleaned.startswith("member_"):
        return None
    return cleaned


def _require_host_token(room: dict, host_token: Optional[str]) -> None:
    if not host_token or _hash_host_token(host_token) != room.get("host_token_hash"):
        raise PermissionDeniedError("host required")


def _require_member(room_id: str, member_id: str) -> dict:
    if not member_id:
        raise MemberNotFoundError(room_id)
    member = _get_member(room_id, member_id)
    if not member:
        raise MemberNotFoundError(member_id)
    return member


def _member_payload(member_id: str, member: Optional[dict]) -> Optional[dict]:
    if not member:
        return None
    return {
        "id": member_id,
        "display_name": member.get("display_name"),
        "role": member.get("role"),
    }


def _should_advance_to_result(room: dict, now: datetime) -> bool:
    spin = room.get("current_spin") or {}
    return (
        room.get("status") == "stopping"
        and spin.get("stop_at") is not None
        and int(spin.get("stop_at")) <= _epoch(now)
    )


def _advance_stopping_room_to_result(room_id: str, room: dict, now: datetime) -> dict:
    timestamp = _epoch(now)
    next_revision = int(room.get("revision", 0)) + 1
    try:
        response = _table().update_item(
            Key={"id": room_item_id(room_id)},
            UpdateExpression=(
                "SET #status = :result, revision = :next_revision, updated_at = :updated_at"
            ),
            ConditionExpression=(
                "attribute_exists(id) AND "
                "revision = :expected_revision AND "
                "#status = :stopping"
            ),
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":result": "result",
                ":next_revision": next_revision,
                ":updated_at": timestamp,
                ":expected_revision": int(room.get("revision", 0)),
                ":stopping": "stopping",
            },
            ReturnValues="ALL_NEW",
        )
        return response.get("Attributes") or {**room, "status": "result"}
    except Exception:
        return _get_room(room_id) or {**room, "status": "result"}


def _idempotent_result_if_exists(
    room: dict,
    request_id: str,
    member_id: str,
    request_type: str,
    request_payload_hash: str,
    now: datetime,
) -> Optional[Dict[str, Any]]:
    if not request_id:
        raise InvalidInputError("requestId")
    existing = _get_request(room_id_from_item(room), request_id)
    if not existing:
        return None
    if (
        existing.get("member_id") != member_id
        or existing.get("type") != request_type
        or existing.get("payload_hash") != request_payload_hash
    ):
        raise IdempotencyConflictError(request_id)
    return get_room_state(room_id_from_item(room), member_id=None, now=now)


def room_id_from_item(room: dict) -> str:
    return str(room.get("id", "")).split("|", 1)[1]


def _table_name() -> str:
    table_name = os.getenv("DYNAMO_DB_PRIMARY_TABLE_NAME")
    if not table_name:
        raise GroupRouletteRepositoryError("DYNAMO_DB_PRIMARY_TABLE_NAME is not set")
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


def _get_active_room(room_id: str, now: datetime) -> dict:
    room = _get_room(room_id)
    if room is None:
        raise RoomNotFoundError(room_id)
    if int(room.get("expires_at", 0)) <= _epoch(now):
        raise RoomExpiredError(room_id)
    return room


def _get_member(room_id: str, member_id: str) -> Optional[dict]:
    response = _table().get_item(Key={"id": member_item_id(room_id, member_id)})
    return response.get("Item")


def _get_request(room_id: str, request_id: str) -> Optional[dict]:
    response = _table().get_item(Key={"id": request_item_id(room_id, request_id)})
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
