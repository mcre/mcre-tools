import importlib
import hashlib
import json
import pathlib
import sys
import unittest
from datetime import datetime, timezone
from unittest import mock


LAMBDA_ROOT = pathlib.Path(__file__).resolve().parents[1] / "src"


def api_event(path: str, method: str = "GET", body: str | None = None):
    event = {
        "httpMethod": method,
        "pathParameters": {"proxy": path},
        "queryStringParameters": None,
    }
    if body is not None:
        event["body"] = body
    return event


class ApiRoutesTest(unittest.TestCase):
    def setUp(self):
        sys.path.insert(0, str(LAMBDA_ROOT))
        for module_name in ["util", "api.group_roulette", "api.main"]:
            sys.modules.pop(module_name, None)

    def tearDown(self):
        sys.path = [path for path in sys.path if path != str(LAMBDA_ROOT)]
        for module_name in ["util", "api.group_roulette", "api.main"]:
            sys.modules.pop(module_name, None)

    def test_jukugo_left_search_returns_empty_array_when_item_is_missing(self):
        main = importlib.import_module("api.main")

        with mock.patch("util.get_db_item", return_value=None):
            response = main.main(api_event("jukugo/力/left-search"), None)

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(response["body"], "[]")

    def test_unknown_route_returns_structured_404(self):
        main = importlib.import_module("api.main")

        response = main.main(api_event("unknown"), None)

        self.assertEqual(response["statusCode"], 404)
        self.assertIn("NOT_FOUND", response["body"])

    def test_group_roulette_create_room_returns_room_id_host_token_and_expiry(self):
        main = importlib.import_module("api.main")
        expires_at = int(
            datetime(2026, 5, 9, 9, 30, 0, tzinfo=timezone.utc).timestamp()
        )

        with (
            mock.patch(
                "api.group_roulette.secrets.token_urlsafe",
                side_effect=["room-random", "host-random"],
            ),
            mock.patch(
                "api.group_roulette.repository.create_room",
                return_value={"expires_at": expires_at},
            ) as create_room,
        ):
            response = main.main(api_event("group-roulette/rooms", "POST"), None)

        body = json.loads(response["body"])
        expected_host_token = "host_host-random"
        expected_host_token_hash = hashlib.sha256(
            expected_host_token.encode("utf-8")
        ).hexdigest()

        self.assertEqual(response["statusCode"], 201)
        self.assertEqual(
            body,
            {
                "roomId": "room_room-random",
                "hostToken": expected_host_token,
                "expiresAt": "2026-05-09T09:30:00Z",
            },
        )
        create_room.assert_called_once()
        args = create_room.call_args.args
        self.assertEqual(args[0], "room_room-random")
        self.assertEqual(args[1], expected_host_token_hash)
        self.assertNotIn(expected_host_token, args)

    def test_group_roulette_create_room_rejects_non_empty_body(self):
        main = importlib.import_module("api.main")

        with mock.patch("api.group_roulette.repository.create_room") as create_room:
            response = main.main(
                api_event(
                    "group-roulette/rooms",
                    "POST",
                    body=json.dumps({"unexpected": True}),
                ),
                None,
            )

        body = json.loads(response["body"])

        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(body["error"]["code"], "INVALID_REQUEST")
        create_room.assert_not_called()


if __name__ == "__main__":
    unittest.main()
