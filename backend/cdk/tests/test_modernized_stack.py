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

    def test_lambda_log_retention_does_not_recreate_default_log_groups(self):
        templates = self._templates()
        jp_template = templates["mcre-tools-dev-ap-northeast-1"]
        existing_log_group_names = [
            "/aws/lambda/mcre-tools-dev-api",
            "/aws/lambda/mcre-tools-dev-ogp",
        ]

        log_group_resources = jp_template.find_resources("AWS::Logs::LogGroup")
        for log_group_name in existing_log_group_names:
            self.assertNotIn(
                log_group_name,
                [
                    resource.get("Properties", {}).get("LogGroupName")
                    for resource in log_group_resources.values()
                ],
            )
            jp_template.has_resource_properties(
                "Custom::LogRetention",
                {
                    "LogGroupName": log_group_name,
                    "RetentionInDays": 90,
                },
            )

        for name in ["api", "ogp"]:
            jp_template.has_resource_properties(
                "AWS::IAM::Role",
                {
                    "RoleName": f"mcre-tools-dev-lambda-{name}",
                    "ManagedPolicyArns": Match.array_with(
                        [
                            {
                                "Fn::Join": Match.array_with(
                                    [
                                        "",
                                        Match.array_with(
                                            [
                                                "arn:",
                                                {"Ref": "AWS::Partition"},
                                                ":iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
                                            ]
                                        ),
                                    ]
                                )
                            }
                        ]
                    ),
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
