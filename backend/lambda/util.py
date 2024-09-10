import decimal
import json
import os
import urllib.parse

import boto3
import aws_lambda_powertools

# --- logger ---

logger = aws_lambda_powertools.Logger()

# --- utility functions ---


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


def get_db_item(id: str, columns: list = None):
    table = boto3.resource("dynamodb").Table(os.getenv("DYNAMO_DB_PRIMARY_TABLE_NAME"))

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
