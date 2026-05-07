import importlib
import json
import pathlib
import sys
import unittest
from unittest import mock


LAMBDA_ROOT = pathlib.Path(__file__).resolve().parents[1] / "src"


def websocket_event(route_key: str, body: str | None = None):
    return {
        "requestContext": {
            "routeKey": route_key,
            "connectionId": "conn_1",
        },
        "body": body,
    }


class RealtimeHandlerTest(unittest.TestCase):
    def setUp(self):
        sys.path.insert(0, str(LAMBDA_ROOT))
        for module_name in ["util", "realtime.repository", "realtime.main"]:
            sys.modules.pop(module_name, None)

    def tearDown(self):
        sys.path = [path for path in sys.path if path != str(LAMBDA_ROOT)]
        for module_name in ["util", "realtime.repository", "realtime.main"]:
            sys.modules.pop(module_name, None)

    def test_connect_returns_ok(self):
        main = importlib.import_module("realtime.main")

        response = main.main(websocket_event("$connect"), None)

        self.assertEqual(response["statusCode"], 200)

    def test_disconnect_deletes_connection(self):
        main = importlib.import_module("realtime.main")

        with mock.patch("realtime.main.repository.delete_connection") as delete_connection:
            response = main.main(websocket_event("$disconnect"), None)

        self.assertEqual(response["statusCode"], 200)
        delete_connection.assert_called_once_with("conn_1")

    def test_default_route_returns_structured_error_for_invalid_json(self):
        main = importlib.import_module("realtime.main")

        response = main.main(websocket_event("$default", "{"), None)
        body = json.loads(response["body"])

        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(body["type"], "error")
        self.assertEqual(body["error"]["code"], "INVALID_REQUEST")

    def test_default_route_returns_structured_error_for_unsupported_type(self):
        main = importlib.import_module("realtime.main")
        envelope = {
            "protocolVersion": 1,
            "tool": "group-roulette",
            "type": "startSpin",
            "roomId": "room_abc",
            "requestId": "req_1",
            "payload": {},
        }

        response = main.main(websocket_event("$default", json.dumps(envelope)), None)
        body = json.loads(response["body"])

        self.assertEqual(response["statusCode"], 400)
        self.assertEqual(body["type"], "error")
        self.assertEqual(body["requestId"], "req_1")
        self.assertEqual(body["error"]["code"], "UNSUPPORTED_TYPE")


if __name__ == "__main__":
    unittest.main()
