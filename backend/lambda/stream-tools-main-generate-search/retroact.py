# 更新
# cd backend/lambda/stream-tools-main-generate-search
# python retroact.py config.json ccd

import decimal
import json
import os
import sys
import time

import boto3

import main


with open(sys.argv[1], "r") as config_json:
    c = json.load(config_json)

aws_profile = sys.argv[2] if len(sys.argv) > 2 else "default"

session = boto3.session.Session(profile_name=aws_profile)
creds = session.get_credentials()
os.environ["AWS_ACCESS_KEY_ID"] = creds.access_key
os.environ["AWS_SECRET_ACCESS_KEY"] = creds.secret_key


def scan(table):
    items = []
    print(table)
    print(f"scan start {time.time()}")
    response = table.scan()
    items.extend(response["Items"])
    while "LastEvaluatedKey" in response:
        if not c["main_table"].endswith("-dev"):
            time.sleep(10)
        else:
            time.sleep(60)
        print(f"scan next  {time.time()}")
        response = table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
        items.extend(response["Items"])
    return items


def format(item):
    if isinstance(item, str):
        return {"S": item}
    if isinstance(item, decimal.Decimal):
        return {"N": str(item)}
    if isinstance(item, bool):
        return {"BOOL": item}
    if isinstance(item, dict):
        return {"M": {k: format(v) for k, v in item.items()}}
    if isinstance(item, list):
        return {"L": [format(x) for x in item]}
    print("\n\n【処理できてないよ】", item, type(item), "\n\n")


class ContextImitation:
    def __init__(self):
        self.function_name = c["lambda_function_name"]


def retroact():
    search_table = session.resource("dynamodb").Table(c["search_table"])
    main_table = session.resource("dynamodb").Table(c["main_table"])

    main_items = scan(main_table)
    search_items = scan(search_table)

    search_keys = set([(item["key"], item["recordType"]) for item in search_items])

    print(f"ADD LEN: {len(main_items)}")

    for count, item in enumerate(main_items):
        putted_items = main.main(
            {
                "Records": [
                    {
                        "eventName": "INSERT",
                        "dynamodb": {
                            "Keys": {"key": {"S": item["key"]}},
                            "NewImage": {
                                key: format(value) for key, value in item.items()
                            },
                        },
                    }
                ]
            },
            ContextImitation(),
            True,
        )
        if putted_items is not None:
            for pi in putted_items:
                search_keys.discard(pi)
        print("\n\n*************************")
        print(f"ADD {count + 1} / {len(main_items)} -- {time.time()}")
        if c["main_table"].endswith("-dev"):
            time.sleep(1)

    print(f"DEL LEN: {len(search_keys)}")

    for count, (key, record_type) in enumerate(search_keys):
        search_table.delete_item(Key={"key": key, "recordType": record_type})
        print("\n\n*************************")
        print(f"DEL {count + 1} / {len(search_keys)} -- {time.time()}")
        time.sleep(1)


retroact()
