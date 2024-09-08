# jukugo|で始まるレコードをすべて削除する
#
# cd tools/jukugo
# python delete_records.py m_cre-super-user mcre-tools-primary

import sys
import time

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

RETRIES = 5
DELAY = 1


def delete_jukugo_data(aws_profile, table_name):
    session = boto3.Session(profile_name=aws_profile)
    dynamodb = session.resource("dynamodb", region_name="ap-northeast-1")
    table = dynamodb.Table(table_name)

    def delete_item_with_retry(key):
        for attempt in range(RETRIES):
            try:
                table.delete_item(Key=key)
                return True
            except ClientError as e:
                if (
                    e.response["Error"]["Code"]
                    == "ProvisionedThroughputExceededException"
                ):
                    print(
                        f"Provisioned throughput exceeded. Retrying ({attempt + 1}/{RETRIES})..."
                    )
                    time.sleep(DELAY * (2**attempt))
                else:
                    print(f"Failed to delete item: {e}")
                    return False
        print("Max retries reached. Failed to delete item.")
        return False

    try:
        scan_kwargs = {"FilterExpression": Key("id").begins_with("jukugo|")}

        while True:
            response = table.scan(**scan_kwargs)
            items = response.get("Items", [])

            for i, item in enumerate(items):
                key = {"id": item["id"]}
                success = delete_item_with_retry(key)
                if success:
                    print(f"Deleted {i + 1}/{len(items)} items from DynamoDB")
                else:
                    print(f"Failed to delete item {i + 1}")

            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break
            scan_kwargs["ExclusiveStartKey"] = last_key

    except ClientError as e:
        print(f"Error scanning DynamoDB table: {e}")
        return


if len(sys.argv) != 3:
    print("Usage: python delete_jukugo.py <aws_profile> <table_name>")
    sys.exit(1)

delete_jukugo_data(sys.argv[1], sys.argv[2])
