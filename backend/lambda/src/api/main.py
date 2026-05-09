import os

import util as u

try:
    from . import group_roulette
except ImportError:
    import group_roulette


CHARACTER = u.request_path_param("character")
REQUEST = lambda request: request
ROOM_ID = u.request_path_param("roomId")
OPTION_ID = u.request_path_param("optionId")


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
    u.api_route("POST", "group-roulette/rooms", group_roulette.create_room),
    u.api_route(
        "GET",
        "group-roulette/rooms/{roomId}/state",
        group_roulette.get_room_state,
        REQUEST,
        ROOM_ID,
    ),
    u.api_route(
        "POST",
        "group-roulette/rooms/{roomId}/join",
        group_roulette.join_room,
        REQUEST,
        ROOM_ID,
    ),
    u.api_route(
        "POST",
        "group-roulette/rooms/{roomId}/options",
        group_roulette.add_option,
        REQUEST,
        ROOM_ID,
    ),
    u.api_route(
        "DELETE",
        "group-roulette/rooms/{roomId}/options/{optionId}",
        group_roulette.remove_option,
        REQUEST,
        ROOM_ID,
        OPTION_ID,
    ),
    u.api_route(
        "PATCH",
        "group-roulette/rooms/{roomId}/guest-add-enabled",
        group_roulette.set_guest_add_enabled,
        REQUEST,
        ROOM_ID,
    ),
    u.api_route(
        "POST",
        "group-roulette/rooms/{roomId}/spins/start",
        group_roulette.start_spin,
        REQUEST,
        ROOM_ID,
    ),
    u.api_route(
        "POST",
        "group-roulette/rooms/{roomId}/spins/stop",
        group_roulette.stop_spin,
        REQUEST,
        ROOM_ID,
    ),
]


@u.logger.inject_lambda_context(log_event=False)
def main(event, context):
    return u.dispatch_api_request(event, ROUTES)
