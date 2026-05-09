import importlib
import hashlib
import json
import pathlib
import sys
import unittest
from datetime import datetime, timezone
from unittest import mock


LAMBDA_ROOT = pathlib.Path(__file__).resolve().parents[1] / "src"


def api_event(
    path: str,
    method: str = "GET",
    body: str | None = None,
    query: dict | None = None,
):
    event = {
        "httpMethod": method,
        "pathParameters": {"proxy": path},
        "queryStringParameters": query,
    }
    if body is not None:
        event["body"] = body
    return event


class ApiRoutesTest(unittest.TestCase):
    def setUp(self):
        sys.path.insert(0, str(LAMBDA_ROOT))
        for module_name in [
            "util",
            "api",
            "group_roulette_core.repository",
            "group_roulette_core",
            "api.group_roulette",
            "api.main",
        ]:
            sys.modules.pop(module_name, None)

    def tearDown(self):
        sys.path = [path for path in sys.path if path != str(LAMBDA_ROOT)]
        for module_name in [
            "util",
            "api",
            "group_roulette_core.repository",
            "group_roulette_core",
            "api.group_roulette",
            "api.main",
        ]:
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

    def test_group_roulette_create_room_returns_room_state_envelope_with_host_member(self):
        main = importlib.import_module("api.main")
        now = datetime(2026, 5, 8, 9, 30, 0, tzinfo=timezone.utc)
        expires_at = int(
            datetime(2026, 5, 9, 9, 30, 0, tzinfo=timezone.utc).timestamp()
        )

        with (
            mock.patch("api.group_roulette._now", return_value=now),
            mock.patch(
                "api.group_roulette.secrets.token_urlsafe",
                side_effect=["room-random", "host-random"],
            ),
            mock.patch(
                "group_roulette_core.repository.create_room",
                return_value={
                    "room": {
                        "revision": 1,
                        "status": "waiting",
                        "expires_at": expires_at,
                        "guest_add_enabled": True,
                        "active_options": [],
                        "current_spin": None,
                    },
                    "member": {
                        "id": "member_host",
                        "display_name": "ホスト",
                        "role": "host",
                    },
                },
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
                "protocolVersion": 1,
                "tool": "group-roulette",
                "type": "roomState",
                "requestId": None,
                "revision": 1,
                "serverTime": "2026-05-08T09:30:00.000Z",
                "payload": {
                    "status": "waiting",
                    "expiresAt": "2026-05-09T09:30:00Z",
                    "guestAddEnabled": True,
                    "activeOptions": [],
                    "currentSpin": None,
                    "member": {
                        "id": "member_host",
                        "displayName": "ホスト",
                        "role": "host",
                    },
                },
            },
        )
        self.assertNotIn("hostToken", body["payload"])
        create_room.assert_called_once()
        args = create_room.call_args.args
        self.assertEqual(args[0], "room_room-random")
        self.assertEqual(args[1], expected_host_token_hash)
        self.assertNotIn(expected_host_token, args)

    def test_group_roulette_create_room_rejects_non_empty_body(self):
        main = importlib.import_module("api.main")

        with mock.patch("group_roulette_core.repository.create_room") as create_room:
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

    def test_group_roulette_get_room_state_returns_envelope(self):
        main = importlib.import_module("api.main")

        with mock.patch(
            "group_roulette_core.repository.get_room_state",
            return_value={
                "room": {
                    "revision": 3,
                    "status": "waiting",
                    "expires_at": 1778319000,
                    "guest_add_enabled": True,
                    "active_options": [
                        {
                            "id": "option_1",
                            "label": "Pizza",
                            "order": 1,
                            "added_by_member_id": "member_1",
                        }
                    ],
                    "current_spin": None,
                },
                "member": {
                    "id": "member_1",
                    "display_name": "主催者",
                    "role": "host",
                },
            },
        ) as get_room_state:
            response = main.main(
                api_event(
                    "group-roulette/rooms/room_abc/state",
                    "GET",
                    query={"memberId": "member_1"},
                ),
                None,
            )

        body = json.loads(response["body"])

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(body["tool"], "group-roulette")
        self.assertEqual(body["type"], "roomState")
        self.assertEqual(body["roomId"], "room_abc")
        self.assertEqual(body["revision"], 3)
        self.assertEqual(body["payload"]["activeOptions"][0]["label"], "Pizza")
        self.assertEqual(body["payload"]["member"]["role"], "host")
        get_room_state.assert_called_once()
        self.assertEqual(get_room_state.call_args.args[0], "room_abc")
        self.assertEqual(get_room_state.call_args.kwargs["member_id"], "member_1")

    def test_group_roulette_join_room_reads_host_token_from_body(self):
        main = importlib.import_module("api.main")
        request_body = {
            "requestId": "req_join",
            "displayName": "主催者",
            "hostToken": "host_secret",
        }

        with mock.patch(
            "group_roulette_core.repository.join_room",
            return_value={
                "room": {
                    "revision": 1,
                    "status": "waiting",
                    "expires_at": 1778319000,
                    "guest_add_enabled": True,
                    "active_options": [],
                    "current_spin": None,
                },
                "member": {
                    "id": "member_1",
                    "display_name": "主催者",
                    "role": "host",
                },
            },
        ) as join_room:
            response = main.main(
                api_event(
                    "group-roulette/rooms/room_abc/join",
                    "POST",
                    body=json.dumps(request_body),
                ),
                None,
            )

        body = json.loads(response["body"])

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(body["type"], "roomState")
        self.assertEqual(body["requestId"], "req_join")
        self.assertEqual(body["payload"]["member"]["role"], "host")
        join_room.assert_called_once()
        self.assertEqual(join_room.call_args.args[0], "room_abc")
        self.assertEqual(join_room.call_args.kwargs["host_token"], "host_secret")

    def test_group_roulette_add_option_returns_updated_room_state(self):
        main = importlib.import_module("api.main")

        with mock.patch(
            "group_roulette_core.repository.add_option",
            return_value={
                "room": {
                    "revision": 2,
                    "status": "waiting",
                    "expires_at": 1778319000,
                    "guest_add_enabled": True,
                    "active_options": [
                        {"id": "option_1", "label": "Pizza", "order": 1}
                    ],
                    "current_spin": None,
                }
            },
        ) as add_option:
            response = main.main(
                api_event(
                    "group-roulette/rooms/room_abc/options",
                    "POST",
                    body=json.dumps(
                        {
                            "requestId": "req_add",
                            "memberId": "member_1",
                            "label": " Pizza ",
                        }
                    ),
                ),
                None,
            )

        body = json.loads(response["body"])

        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(body["type"], "roomState")
        self.assertEqual(body["requestId"], "req_add")
        self.assertEqual(body["payload"]["activeOptions"][0]["label"], "Pizza")
        add_option.assert_called_once()
        self.assertEqual(add_option.call_args.kwargs["label"], "Pizza")

    def test_group_roulette_start_and_stop_spin_are_rest_operations(self):
        main = importlib.import_module("api.main")
        started_room = {
            "revision": 3,
            "status": "spinning",
            "expires_at": 1778319000,
            "guest_add_enabled": True,
            "active_options": [{"id": "option_1", "label": "Pizza", "order": 1}],
            "current_spin": {
                "id": "spin_1",
                "started_at": 1778232600,
                "duration_ms": 5000,
                "options": [{"id": "option_1", "label": "Pizza", "order": 1}],
            },
        }
        stopped_room = {
            **started_room,
            "revision": 4,
            "status": "stopping",
            "current_spin": {
                **started_room["current_spin"],
                "winner_option_id": "option_1",
                "stop_at": 1778232603,
            },
        }

        with (
            mock.patch(
                "group_roulette_core.repository.start_spin",
                return_value={"room": started_room},
            ) as start_spin,
            mock.patch(
                "group_roulette_core.repository.stop_spin",
                return_value={"room": stopped_room},
            ) as stop_spin,
            mock.patch("api.group_roulette.random.randrange", return_value=0),
        ):
            start_response = main.main(
                api_event(
                    "group-roulette/rooms/room_abc/spins/start",
                    "POST",
                    body=json.dumps(
                        {
                            "requestId": "req_start",
                            "memberId": "member_1",
                            "hostToken": "host_secret",
                        }
                    ),
                ),
                None,
            )
            stop_response = main.main(
                api_event(
                    "group-roulette/rooms/room_abc/spins/stop",
                    "POST",
                    body=json.dumps(
                        {
                            "requestId": "req_stop",
                            "memberId": "member_1",
                            "hostToken": "host_secret",
                        }
                    ),
                ),
                None,
            )

        start_body = json.loads(start_response["body"])
        stop_body = json.loads(stop_response["body"])

        self.assertEqual(start_body["payload"]["status"], "spinning")
        self.assertEqual(start_body["payload"]["currentSpin"]["durationMs"], 5000)
        self.assertEqual(stop_body["payload"]["status"], "stopping")
        self.assertEqual(stop_body["payload"]["currentSpin"]["winnerOptionId"], "option_1")
        self.assertEqual(stop_body["payload"]["currentSpin"]["stopAt"], "2026-05-08T09:30:03Z")
        start_spin.assert_called_once()
        stop_spin.assert_called_once()
        self.assertEqual(stop_spin.call_args.kwargs["winner_index"], 0)


if __name__ == "__main__":
    unittest.main()
