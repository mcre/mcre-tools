# cd tools/jukugo
# python seed.py m_cre-super-user mcre-tools-primary

import sys
import time
import boto3
import zipfile
import io
from botocore.exceptions import ClientError


RETRIES = 5
DELAY = 1


def insert_jukugo_data(aws_profile, table_name):
    session = boto3.Session(profile_name=aws_profile)
    dynamodb = session.resource("dynamodb", region_name="ap-northeast-1")
    table = dynamodb.Table(table_name)

    data_dict = {}

    def insert_data(kanji_key, kanji, cost):
        if kanji_key in data_dict:
            data_dict[kanji_key]["pairs"].append({"character": kanji, "cost": cost})
        else:
            data_dict[kanji_key] = {
                "id": kanji_key,
                "pairs": [{"character": kanji, "cost": cost}],
            }

    def put_item_with_retry(item):
        for attempt in range(RETRIES):
            try:
                table.put_item(Item=item)
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
                    print(f"Failed to insert item: {e}")
                    return False
        print("Max retries reached. Failed to insert item.")
        return False

    with zipfile.ZipFile("dic.txt.zip", "r") as zip_ref:
        with zip_ref.open("dic.txt") as file:
            for line in io.TextIOWrapper(file, encoding="utf-8"):
                parts = line.strip().split(" ")
                left_kanji = parts[0][0]
                right_kanji = parts[0][1]
                cost = int(parts[1])

                insert_data(f"jukugo|left|{left_kanji}", right_kanji, cost)
                insert_data(f"jukugo|right|{right_kanji}", left_kanji, cost)

    for i, item in enumerate(data_dict.values()):
        success = put_item_with_retry(item)
        if success:
            print(f"Inserted {i + 1}/{len(data_dict)} items into DynamoDB")
        else:
            print(f"Failed to insert item {i + 1}")


if len(sys.argv) != 3:
    print("Usage: python seed.py <aws_profile> <table_name>")
    sys.exit(1)

insert_jukugo_data(sys.argv[1], sys.argv[2])
