import hashlib
import secrets
from datetime import datetime, timezone

import util as u

try:
    from realtime import repository
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


def create_room(request: u.ApiRequest) -> dict:
    if request.body not in (None, {}):
        return u.api_error_response(
            status_code=400,
            error_code="INVALID_REQUEST",
            message="リクエストが不正です",
        )

    room_id = f"room_{secrets.token_urlsafe(16)}"
    host_token = f"host_{secrets.token_urlsafe(32)}"
    room = repository.create_room(
        room_id,
        _hash_host_token(host_token),
        datetime.now(timezone.utc),
    )

    return u.api_response(
        status_code=201,
        body={
            "roomId": room_id,
            "hostToken": host_token,
            "expiresAt": _format_expires_at(int(room["expires_at"])),
        },
    )
