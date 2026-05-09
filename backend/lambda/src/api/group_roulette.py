import hashlib
import random
import secrets
from datetime import datetime, timezone
from typing import Any, Optional

import util as u

try:
    from group_roulette_core import repository
except ImportError:
    import repository


def _hash_host_token(host_token: str) -> str:
    return hashlib.sha256(host_token.encode("utf-8")).hexdigest()


def _format_expires_at(timestamp: int) -> str:
    return (
        datetime.fromtimestamp(timestamp, timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _server_time(now: datetime) -> str:
    return (
        now.astimezone(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _iso_from_epoch(timestamp: Optional[int]) -> Optional[str]:
    if timestamp is None:
        return None
    return _format_expires_at(int(timestamp))


def _clean_text(value: Any, max_length: int) -> str:
    return repository._clean_text(value, max_length)


def _body(request: u.ApiRequest) -> dict:
    body = request.body or {}
    return body if isinstance(body, dict) else {}


def _request_id(body: dict) -> str:
    request_id = body.get("requestId")
    if not isinstance(request_id, str) or not request_id:
        raise repository.InvalidInputError("requestId")
    return request_id


def _member_id(body: dict) -> str:
    member_id = body.get("memberId")
    if not isinstance(member_id, str) or not member_id:
        raise repository.MemberNotFoundError("memberId")
    return member_id


def _option_payload(option: dict) -> dict:
    payload = {
        "id": option.get("id"),
        "label": option.get("label"),
        "order": option.get("order"),
    }
    if option.get("added_by_member_id") is not None:
        payload["addedByMemberId"] = option.get("added_by_member_id")
    return payload


def _spin_payload(spin: Optional[dict]) -> Optional[dict]:
    if not spin:
        return None

    payload = {
        "id": spin.get("id"),
        "startedAt": _iso_from_epoch(spin.get("started_at")),
        "durationMs": spin.get("duration_ms"),
        "options": [_option_payload(option) for option in spin.get("options") or []],
    }
    if spin.get("winner_option_id") is not None:
        payload["winnerOptionId"] = spin.get("winner_option_id")
    if spin.get("stop_at") is not None:
        payload["stopAt"] = _iso_from_epoch(spin.get("stop_at"))
    return payload


def _member_payload(member: Optional[dict]) -> Optional[dict]:
    if not member:
        return None
    return {
        "id": member.get("id"),
        "displayName": member.get("display_name"),
        "role": member.get("role"),
    }


def _room_payload(result: dict) -> dict:
    room = result["room"]
    payload = {
        "status": room.get("status"),
        "expiresAt": _iso_from_epoch(room.get("expires_at")),
        "guestAddEnabled": bool(room.get("guest_add_enabled", True)),
        "activeOptions": [
            _option_payload(option) for option in room.get("active_options") or []
        ],
        "currentSpin": _spin_payload(room.get("current_spin")),
    }
    member = _member_payload(result.get("member"))
    if member is not None:
        payload["member"] = member
    return payload


def _envelope_response(
    request: u.ApiRequest,
    room_id: str,
    message_type: str,
    result: dict,
    now: datetime,
    status_code: int = 200,
    extra_body: Optional[dict] = None,
) -> dict:
    body = _body(request)
    room = result["room"]
    response_body = {
        "protocolVersion": 1,
        "tool": "group-roulette",
        "type": message_type,
        "roomId": room_id,
        "requestId": body.get("requestId"),
        "revision": room.get("revision"),
        "serverTime": _server_time(now),
        "payload": _room_payload(result),
    }
    if extra_body:
        response_body.update(extra_body)
    return u.api_response(
        status_code=status_code,
        body=response_body,
    )


def _repo_error_response(error: Exception) -> dict:
    if isinstance(error, repository.RoomExpiredError):
        return u.api_error_response(410, "ROOM_EXPIRED", "部屋の有効期限が切れています")
    if isinstance(error, repository.RoomNotFoundError):
        return u.api_error_response(404, "NOT_FOUND", "部屋が見つかりません")
    if isinstance(error, repository.PermissionDeniedError):
        return u.api_error_response(403, "FORBIDDEN", "権限がありません")
    if isinstance(error, repository.MemberNotFoundError):
        return u.api_error_response(409, "NOT_JOINED", "部屋に入室していません")
    if isinstance(error, repository.RoomStateError):
        return u.api_error_response(409, "ROOM_STATE_CONFLICT", "現在の部屋状態では操作できません")
    if isinstance(error, repository.EmptyOptionsError):
        return u.api_error_response(400, "EMPTY_OPTIONS", "候補がありません")
    if isinstance(error, repository.TooManyOptionsError):
        return u.api_error_response(400, "TOO_MANY_OPTIONS", "候補数の上限を超えています")
    if isinstance(error, repository.IdempotencyConflictError):
        return u.api_error_response(409, "IDEMPOTENCY_CONFLICT", "requestId が再利用されています")
    if isinstance(error, repository.InvalidInputError):
        return u.api_error_response(400, "INVALID_REQUEST", "入力が不正です")
    raise error


def get_room_state(request: u.ApiRequest, room_id: str) -> dict:
    now = _now()
    try:
        result = repository.get_room_state(
            room_id,
            member_id=request.query_string.get("memberId"),
            now=now,
            allow_expired=True,
        )
    except repository.GroupRouletteRepositoryError as error:
        return _repo_error_response(error)

    message_type = (
        "roomExpired" if result["room"].get("status") == "expired" else "roomState"
    )
    return _envelope_response(request, room_id, message_type, result, now)


def join_room(request: u.ApiRequest, room_id: str) -> dict:
    body = _body(request)
    now = _now()
    try:
        result = repository.join_room(
            room_id,
            member_id=body.get("memberId"),
            request_id=_request_id(body),
            display_name=body.get("displayName"),
            host_token=body.get("hostToken"),
            now=now,
        )
    except repository.GroupRouletteRepositoryError as error:
        return _repo_error_response(error)
    return _envelope_response(request, room_id, "roomState", result, now)


def add_option(request: u.ApiRequest, room_id: str) -> dict:
    body = _body(request)
    label = _clean_text(body.get("label"), 80)
    now = _now()
    try:
        result = repository.add_option(
            room_id,
            member_id=_member_id(body),
            request_id=_request_id(body),
            label=label,
            host_token=body.get("hostToken"),
            now=now,
        )
    except repository.GroupRouletteRepositoryError as error:
        return _repo_error_response(error)
    return _envelope_response(request, room_id, "roomState", result, now)


def remove_option(request: u.ApiRequest, room_id: str, option_id: str) -> dict:
    body = _body(request)
    now = _now()
    try:
        result = repository.remove_option(
            room_id,
            member_id=_member_id(body),
            request_id=_request_id(body),
            option_id=option_id,
            host_token=body.get("hostToken"),
            now=now,
        )
    except repository.GroupRouletteRepositoryError as error:
        return _repo_error_response(error)
    return _envelope_response(request, room_id, "roomState", result, now)


def set_guest_add_enabled(request: u.ApiRequest, room_id: str) -> dict:
    body = _body(request)
    if not isinstance(body.get("enabled"), bool):
        return u.api_error_response(400, "INVALID_REQUEST", "入力が不正です")
    now = _now()
    try:
        result = repository.set_guest_add_enabled(
            room_id,
            member_id=_member_id(body),
            request_id=_request_id(body),
            enabled=body["enabled"],
            host_token=body.get("hostToken"),
            now=now,
        )
    except repository.GroupRouletteRepositoryError as error:
        return _repo_error_response(error)
    return _envelope_response(request, room_id, "roomState", result, now)


def start_spin(request: u.ApiRequest, room_id: str) -> dict:
    body = _body(request)
    now = _now()
    try:
        result = repository.start_spin(
            room_id,
            member_id=_member_id(body),
            request_id=_request_id(body),
            host_token=body.get("hostToken"),
            now=now,
            duration_ms=int(body.get("durationMs") or 5000),
        )
    except repository.GroupRouletteRepositoryError as error:
        return _repo_error_response(error)
    return _envelope_response(request, room_id, "roomState", result, now)


def stop_spin(request: u.ApiRequest, room_id: str) -> dict:
    body = _body(request)
    now = _now()
    try:
        result = repository.stop_spin(
            room_id,
            member_id=_member_id(body),
            request_id=_request_id(body),
            host_token=body.get("hostToken"),
            winner_index=random.randrange(1_000_000_000),
            now=now,
        )
    except repository.GroupRouletteRepositoryError as error:
        return _repo_error_response(error)
    return _envelope_response(request, room_id, "roomState", result, now)


def create_room(request: u.ApiRequest) -> dict:
    if request.body not in (None, {}):
        return u.api_error_response(
            status_code=400,
            error_code="INVALID_REQUEST",
            message="リクエストが不正です",
        )

    room_id = f"room_{secrets.token_urlsafe(16)}"
    host_token = f"host_{secrets.token_urlsafe(32)}"
    now = _now()
    result = repository.create_room(
        room_id,
        _hash_host_token(host_token),
        now,
    )

    return _envelope_response(
        request,
        room_id,
        "roomState",
        result,
        now,
        status_code=201,
        extra_body={"hostToken": host_token},
    )
