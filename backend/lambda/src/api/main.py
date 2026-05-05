import os

import util as u


CHARACTER = u.request_path_param("character")


def get_jukugo_search(key_type: str, character: str):
    response = u.get_db_item(
        os.getenv("DYNAMO_DB_PRIMARY_TABLE_NAME"),
        f"jukugo|{key_type}|{character}",
        ["pairs"],
    )
    if response is not None:
        return u.api_response(response["pairs"])
    return u.api_response([])


ROUTES = [
    u.api_route(
        "GET",
        "jukugo/{character}/left-search",
        lambda character: get_jukugo_search("right", character),
        CHARACTER,
    ),
    u.api_route(
        "GET",
        "jukugo/{character}/right-search",
        lambda character: get_jukugo_search("left", character),
        CHARACTER,
    ),
]


@u.logger.inject_lambda_context(log_event=True)
def main(event, context):
    return u.dispatch_api_request(event, ROUTES)
