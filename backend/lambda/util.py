import decimal
import json
import urllib.parse
from typing import Tuple

import boto3
import aws_lambda_powertools

# --- logger ---

logger = aws_lambda_powertools.Logger()

# --- utility functions ---


def parse_request(event: dict) -> Tuple[str, int, str, dict]:
    api = event.get("pathParameters", {}).get("proxy", None)
    method = event.get("httpMethod", None)
    api_parts = [item for item in api.split("/") if len(item) > 0]
    return method, len(api_parts), api_parts, event.get("queryStringParameters", {})


def decode(encoded_string: str) -> str:
    return urllib.parse.unquote(encoded_string)


def decimal_default(obj):
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    raise TypeError


def api_response(body: dict | list = {}, status_code: int = 200):
    logger.info(status_code)
    logger.info(body)
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,POST",
        },
        "body": json.dumps(body, default=decimal_default),
    }


def redirect_response(url: str):
    logger.info(url)
    return {"statusCode": 302, "headers": {"Location": url}}


# --- s3 functions ---


def upload_public_image_to_s3(bucket_name, image_key, image_bytes):
    s3 = boto3.client("s3")
    s3.put_object(
        Bucket=bucket_name,
        Key=image_key,
        Body=image_bytes,
        ContentType="image/png",
        ACL="public-read",
    )


def is_exists_in_s3(bucket_name, image_key):
    s3 = boto3.client("s3")
    try:
        s3.head_object(Bucket=bucket_name, Key=image_key)
        return True
    except s3.exceptions.NoSuchKey as e:
        return False


# --- dynamodb functions ---

DYNAMODB_RESERVED_WORDS = []


def generate_dynamodb_params(columns: list):
    e, p = {}, []
    for c in columns:
        if c in DYNAMODB_RESERVED_WORDS:
            e[f"#{c}"] = c
            p.append(f"#{c}")
        else:
            p.append(c)
    if len(e) <= 0:
        e = None

    expression_attribute_names = e
    projection_expression = ", ".join(p)
    return expression_attribute_names, projection_expression


def get_db_item(table_name: str, id: str, columns: list = None):
    table = boto3.resource("dynamodb").Table(table_name)

    kwargs = {"Key": {"id": id}}

    expression_attribute_names, projection_expression = None, None
    if columns is not None:
        expression_attribute_names, projection_expression = generate_dynamodb_params(
            columns
        )

    if projection_expression is not None:
        kwargs["ProjectionExpression"] = projection_expression

    if expression_attribute_names is not None:
        kwargs["ExpressionAttributeNames"] = expression_attribute_names

    response = table.get_item(**kwargs)

    if "Item" not in response:
        return None
    return response["Item"]
