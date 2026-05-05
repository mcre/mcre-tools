import importlib
import os
import pathlib
import sys
import unittest

from aws_cdk import App, Stack
from aws_cdk.assertions import Match, Template


CDK_ROOT = pathlib.Path(__file__).resolve().parents[1]


class ModernizedStackTest(unittest.TestCase):
    def setUp(self):
        os.environ["CDK_ENV"] = "dev"
        sys.path.insert(0, str(CDK_ROOT))
        for module_name in ["config", "resources", "app"]:
            sys.modules.pop(module_name, None)

    def tearDown(self):
        sys.path = [path for path in sys.path if path != str(CDK_ROOT)]
        for module_name in ["config", "resources", "app"]:
            sys.modules.pop(module_name, None)

    def _templates(self):
        cdk_app = importlib.import_module("app")
        return {
            stack.stack_name: Template.from_stack(stack)
            for stack in cdk_app.app.node.children
            if isinstance(stack, Stack)
        }

    def test_dev_config_is_selected_by_cdk_env(self):
        config = importlib.import_module("config").get_env_config()

        self.assertEqual(config["env"], "dev")
        self.assertEqual(config["prefix"], "mcre-tools-dev")

    def test_lambda_runtime_and_bucket_security_are_modernized(self):
        templates = self._templates()
        jp_template = templates["mcre-tools-dev-ap-northeast-1"]
        us_template = templates["mcre-tools-dev-us-east-1"]

        jp_template.has_resource_properties(
            "AWS::Lambda::Function",
            {"Runtime": "python3.13"},
        )
        us_template.has_resource_properties(
            "AWS::S3::Bucket",
            {
                "BucketEncryption": Match.any_value(),
                "PublicAccessBlockConfiguration": Match.any_value(),
            },
        )

    def test_outputs_include_vite_env_for_actions(self):
        templates = self._templates()
        jp_template = templates["mcre-tools-dev-ap-northeast-1"]
        us_template = templates["mcre-tools-dev-us-east-1"]

        jp_template.has_output("ViteEnvJp", Match.any_value())
        us_template.has_output("ViteEnvUs", Match.any_value())


if __name__ == "__main__":
    unittest.main()
