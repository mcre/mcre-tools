import json
import os
import sys


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import util as u


def get_jukugo_search(search_type: str, character: str):
    decoded_character = u.decode(character)[0]
    response = u.get_db_item(f"jukugo|{search_type}|{decoded_character}", ["pairs"])
    print(response)
    if response is not None:
        return u.api_response(response["pairs"])
    return u.api_response([])


def main(event, context):
    print(json.dumps(event))

    api = event.get("pathParameters", {}).get("proxy", None)
    method = event.get("httpMethod", None)

    api_parts = [item for item in api.split("/") if len(item) > 0]
    m, l, a = method, len(api_parts), api_parts

    try:
        if m == "GET" and l == 3 and a[0] == "jukugo" and a[2] == "left-search":
            return get_jukugo_search("left", a[1])
        if m == "GET" and l == 3 and a[0] == "jukugo" and a[2] == "right-search":
            return get_jukugo_search("right", a[1])
    except Exception:
        u.logger.exception("API処理中にエラー")
        return u.api_response(500)

    return u.api_response(404)
