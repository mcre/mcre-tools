import importlib
import json
import pathlib
import sys
import unittest
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
            "api.main",
        ]:
            sys.modules.pop(module_name, None)

    def tearDown(self):
        sys.path = [path for path in sys.path if path != str(LAMBDA_ROOT)]
        for module_name in [
            "util",
            "api",
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

    def test_removed_group_roulette_routes_return_404(self):
        main = importlib.import_module("api.main")

        for method, path in [
            ("POST", "group-roulette/rooms"),
            ("GET", "group-roulette/rooms/room_abc/state"),
            ("POST", "group-roulette/rooms/room_abc/join"),
            ("POST", "group-roulette/rooms/room_abc/options"),
            ("DELETE", "group-roulette/rooms/room_abc/options/option_1"),
            ("PATCH", "group-roulette/rooms/room_abc/guest-add-enabled"),
            ("POST", "group-roulette/rooms/room_abc/spins/start"),
            ("POST", "group-roulette/rooms/room_abc/spins/stop"),
        ]:
            with self.subTest(method=method, path=path):
                response = main.main(api_event(path, method), None)
                self.assertEqual(response["statusCode"], 404)
                self.assertIn("NOT_FOUND", response["body"])

if __name__ == "__main__":
    unittest.main()
