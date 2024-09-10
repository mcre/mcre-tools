import json
import os
import sys
import traceback

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import util as u


def main(event, context):
    print(json.dumps(event))

    api = event.get("pathParameters", {}).get("proxy", None)
    method = event.get("httpMethod", None)

    try:
        if method == "GET" and api.starts_with("jukugo"):
            return u.api_response(body=[])
    except Exception:
        traceback.print_exc()
        return u.gen_api_response(500)

    return u.api_response(404)
