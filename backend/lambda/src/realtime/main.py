import json
from typing import Any, Optional

import util as u

try:
    from . import repository
except ImportError:
    import repository


def _response(body: Optional[dict] = None, status_code: int = 200) -> dict:
    return {
        "statusCode": status_code,
        "body": "" if body is None else json.dumps(body, ensure_ascii=False),
    }


def _error_response(
    status_code: int,
    error_code: str,
    message: str,
    envelope: Optional[dict] = None,
) -> dict:
    envelope = envelope or {}
    body = {
        "protocolVersion": envelope.get("protocolVersion", 1),
        "tool": envelope.get("tool"),
        "type": "error",
        "roomId": envelope.get("roomId"),
        "requestId": envelope.get("requestId"),
        "error": {
            "code": error_code,
            "message": message,
        },
    }
    return _response(body, status_code=status_code)


def _parse_envelope(raw_body: Any) -> tuple[Optional[dict], Optional[dict]]:
    try:
        envelope = json.loads(raw_body or "{}")
    except json.JSONDecodeError:
        return None, _error_response(
            400,
            "INVALID_REQUEST",
            "WebSocket メッセージの JSON が不正です",
        )

    if not isinstance(envelope, dict):
        return None, _error_response(
            400,
            "INVALID_REQUEST",
            "WebSocket メッセージが不正です",
        )

    if not envelope.get("type"):
        return None, _error_response(
            400,
            "INVALID_REQUEST",
            "WebSocket メッセージ type が不正です",
            envelope,
        )

    return envelope, None


def _handle_default(event: dict) -> dict:
    envelope, error = _parse_envelope(event.get("body"))
    if error is not None:
        return error

    return _error_response(
        400,
        "UNSUPPORTED_TYPE",
        "未対応の WebSocket メッセージ type です",
        envelope,
    )


@u.logger.inject_lambda_context(log_event=True)
def main(event, context):
    route_key = (event.get("requestContext") or {}).get("routeKey")
    connection_id = (event.get("requestContext") or {}).get("connectionId")

    if route_key == "$connect":
        return _response()

    if route_key == "$disconnect":
        if connection_id:
            repository.delete_connection(connection_id)
        return _response()

    return _handle_default(event)
