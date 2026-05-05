import importlib
import pathlib
import sys
import unittest
from unittest import mock


LAMBDA_ROOT = pathlib.Path(__file__).resolve().parents[1] / "src"


def api_event(path: str, method: str = "GET"):
    return {
        "httpMethod": method,
        "pathParameters": {"proxy": path},
        "queryStringParameters": None,
    }


class ApiRoutesTest(unittest.TestCase):
    def setUp(self):
        sys.path.insert(0, str(LAMBDA_ROOT))
        for module_name in ["util", "api.main"]:
            sys.modules.pop(module_name, None)

    def tearDown(self):
        sys.path = [path for path in sys.path if path != str(LAMBDA_ROOT)]
        for module_name in ["util", "api.main"]:
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


if __name__ == "__main__":
    unittest.main()
