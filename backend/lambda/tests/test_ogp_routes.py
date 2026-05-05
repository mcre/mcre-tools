import importlib
import os
import pathlib
import sys
import unittest
from unittest import mock


LAMBDA_ROOT = pathlib.Path(__file__).resolve().parents[1] / "src"


class OgpRoutesTest(unittest.TestCase):
    def setUp(self):
        os.environ["S3_OGP_BUCKET_NAME"] = "ogp-bucket"
        os.environ["DOMAIN_NAME_DISTRIBUTION"] = "tools.mcre.info"
        sys.path.insert(0, str(LAMBDA_ROOT))
        for module_name in ["util", "ogp.main"]:
            sys.modules.pop(module_name, None)

    def tearDown(self):
        sys.path = [path for path in sys.path if path != str(LAMBDA_ROOT)]
        for module_name in ["util", "ogp.main"]:
            sys.modules.pop(module_name, None)

    def test_redirects_to_existing_generated_image(self):
        main = importlib.import_module("ogp.main")
        event = {
            "httpMethod": "GET",
            "pathParameters": {"proxy": "ja/jukugo"},
            "queryStringParameters": {"t": "長", "a": "老"},
        }

        with mock.patch("util.is_exists_in_s3", return_value=True):
            response = main.main(event, None)

        self.assertEqual(response["statusCode"], 302)
        self.assertRegex(
            response["headers"]["Location"],
            r"^https://ogp-bucket\.s3\.ap-northeast-1\.amazonaws\.com/jukugo/[0-9a-f]{32}\.png$",
        )


if __name__ == "__main__":
    unittest.main()
