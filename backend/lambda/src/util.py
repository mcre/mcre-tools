import decimal
import json
import logging
import os
from dataclasses import dataclass
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple
from urllib.parse import unquote


class LambdaLogger:
    def __init__(self) -> None:
        level_name = os.getenv("LOG_LEVEL", "INFO").upper()
        logging.basicConfig(level=getattr(logging, level_name, logging.INFO))
        self._logger = logging.getLogger(__name__)

    def inject_lambda_context(self, log_event: bool = False) -> Callable:
        def decorator(handler: Callable) -> Callable:
            @wraps(handler)
            def wrapper(event: dict, context: Any) -> dict:
                if log_event:
                    self._logger.debug("event=%s", event)
                return handler(event, context)

            return wrapper

        return decorator

    def exception(self, message: str, *args: Any) -> None:
        self._logger.exception(message, *args)


logger = LambdaLogger()


@dataclass(frozen=True)
class ApiRequest:
    method: str
    parts: List[str]
    query_string: Dict[str, str]
    body: Optional[dict]
    path_params: Dict[str, str]

    def with_path_params(self, path_params: Dict[str, str]) -> "ApiRequest":
        return ApiRequest(
            method=self.method,
            parts=self.parts,
            query_string=self.query_string,
            body=self.body,
            path_params=path_params,
        )


ApiHandler = Callable[[ApiRequest], dict]


@dataclass(frozen=True)
class ApiRoute:
    method: str
    pattern: Tuple[str, ...]
    handler: ApiHandler


def _decimal_default(obj: Any):
    if isinstance(obj, decimal.Decimal):
        if obj == obj.to_integral_value():
            return int(obj)
        return float(obj)
    raise TypeError


def parse_api_request(event: dict) -> ApiRequest:
    proxy_path = (event.get("pathParameters") or {}).get("proxy") or ""
    method = event.get("httpMethod") or ""
    parts = [unquote(part) for part in proxy_path.split("/") if part]
    query_string = event.get("queryStringParameters") or {}
    raw_body = event.get("body")
    body = json.loads(raw_body) if raw_body else None
    return ApiRequest(
        method=method,
        parts=parts,
        query_string=query_string,
        body=body,
        path_params={},
    )


def api_response(body: Any = None, status_code: int = 200) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
        },
        "body": json.dumps(body, default=_decimal_default, ensure_ascii=False),
    }


def api_error_response(status_code: int, error_code: str, message: str) -> dict:
    return api_response(
        status_code=status_code,
        body={
            "error": {
                "code": error_code,
                "message": message,
            }
        },
    )


def redirect_response(url: str):
    return {"statusCode": 302, "headers": {"Location": url}}


def request_path_param(name: str) -> Callable[[ApiRequest], str]:
    def get_path_param(request: ApiRequest) -> str:
        return request.path_params[name]

    return get_path_param


def api_route(
    method: str,
    path: str,
    handler: Callable[..., dict],
    *arg_getters: Callable[[ApiRequest], Any],
) -> ApiRoute:
    if arg_getters:
        route_handler = lambda request: handler(
            *(getter(request) for getter in arg_getters)
        )
    else:
        route_handler = handler

    return ApiRoute(
        method=method,
        pattern=tuple(part for part in path.split("/") if part),
        handler=route_handler,
    )


def _match_route(pattern: Sequence[str], parts: Sequence[str]) -> Optional[Dict[str, str]]:
    if len(pattern) != len(parts):
        return None

    path_params = {}
    for pattern_part, request_part in zip(pattern, parts):
        if pattern_part.startswith("{") and pattern_part.endswith("}"):
            path_params[pattern_part[1:-1]] = request_part
            continue
        if pattern_part != request_part:
            return None

    return path_params


def dispatch_api_request(event: dict, routes: Sequence[ApiRoute]) -> dict:
    try:
        request = parse_api_request(event)
    except ValueError:
        return api_error_response(
            status_code=400,
            error_code="INVALID_REQUEST",
            message="リクエストが不正です",
        )
    except Exception as error:
        logger.exception("API処理中にエラー: %s", error)
        return api_error_response(
            status_code=500,
            error_code="UNEXPECTED_ERROR",
            message="不明なエラー",
        )

    try:
        for route in routes:
            if request.method != route.method:
                continue
            path_params = _match_route(route.pattern, request.parts)
            if path_params is None:
                continue
            return route.handler(request.with_path_params(path_params))

        return api_error_response(
            status_code=404,
            error_code="NOT_FOUND",
            message="APIが見つかりません",
        )
    except Exception as error:
        logger.exception("API処理中にエラー: %s", error)
        return api_error_response(
            status_code=500,
            error_code="UNEXPECTED_ERROR",
            message="不明なエラー",
        )


def get_db_item(table_name: str, item_id: str, columns: Optional[list] = None):
    import boto3

    table = boto3.resource("dynamodb").Table(table_name)
    kwargs = {"Key": {"id": item_id}}
    if columns:
        kwargs["ProjectionExpression"] = ", ".join(columns)

    response = table.get_item(**kwargs)
    return response.get("Item")


def upload_image_to_s3(bucket_name: str, image_key: str, image_bytes):
    import boto3

    boto3.client("s3").put_object(
        Bucket=bucket_name,
        Key=image_key,
        Body=image_bytes,
        ContentType="image/png",
    )


def is_exists_in_s3(bucket_name: str, image_key: str):
    import boto3

    s3 = boto3.client("s3")
    try:
        s3.head_object(Bucket=bucket_name, Key=image_key)
        return True
    except s3.exceptions.ClientError:
        return False
