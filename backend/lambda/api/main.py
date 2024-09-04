import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import util as u


def main(event, context):
    return {
        "statusCode": 200,
        "body": json.dumps({"TEST": "TEST"}),
    }
