import os
import sys


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import util as u


def get_jukugo_search(key_type: str, character: str):
    decoded_character = u.decode(character)[0]
    response = u.get_db_item(
        os.getenv("DYNAMO_DB_PRIMARY_TABLE_NAME"),
        f"jukugo|{key_type}|{decoded_character}",
        ["pairs"],
    )
    if response is not None:
        return u.api_response(response["pairs"])
    return u.api_response([])


@u.logger.inject_lambda_context(log_event=True)
def main(event, context):
    m, l, a, _ = u.parse_request(event)
    try:
        if m == "GET" and l == 3 and a[0] == "jukugo" and a[2] == "left-search":
            return get_jukugo_search("right", a[1])
        if m == "GET" and l == 3 and a[0] == "jukugo" and a[2] == "right-search":
            return get_jukugo_search("left", a[1])
    except Exception:
        u.logger.exception("API処理中にエラー")
        return u.api_response(status_code=500)

    return u.api_response(status_code=404)
