import importlib
import json
import os
import pathlib
import sys
import unittest
import zipfile

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

    def test_pillow_layer_matches_python_313_runtime(self):
        layer_path = CDK_ROOT / "layers" / "Pillow-11.3.0-py313.zip"

        self.assertTrue(layer_path.exists())
        with zipfile.ZipFile(layer_path) as archive:
            names = archive.namelist()

        self.assertTrue(any("cpython-313" in name for name in names))
        self.assertFalse(any("cpython-312" in name for name in names))

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

    def test_cloudfront_cache_policy_uses_consistent_construct_id_without_replacement(
        self,
    ):
        cdk_app = importlib.import_module("app")
        us_stack = next(
            stack
            for stack in cdk_app.app.node.children
            if isinstance(stack, Stack)
            and stack.stack_name == "mcre-tools-dev-us-east-1"
        )
        self.assertIsNotNone(us_stack.node.try_find_child("custom-cache-policy-dist"))

        us_template = Template.from_stack(us_stack)
        cache_policy_resources = {
            logical_id: resource
            for logical_id, resource in us_template.to_json()["Resources"].items()
            if resource["Type"] == "AWS::CloudFront::CachePolicy"
            and resource["Properties"]["CachePolicyConfig"]["Name"]
            == "mcre-tools-dev-dist"
        }

        self.assertEqual(1, len(cache_policy_resources))
        self.assertTrue(
            next(iter(cache_policy_resources)).startswith("distCustomCachePolicy")
        )

    def test_dev_dist_cloudfront_basic_auth_is_configured_for_all_site_behaviors(self):
        config = importlib.import_module("config").get_env_config()
        self.assertEqual(
            {
                "enabled": True,
                "username": "mcre",
                "password": "53",
            },
            config["cloudfront"]["dist"]["basic_auth"],
        )

        templates = self._templates()
        us_template = templates["mcre-tools-dev-us-east-1"]
        distribution = next(
            resource
            for resource in us_template.to_json()["Resources"].values()
            if resource["Type"] == "AWS::CloudFront::Distribution"
        )
        distribution_config = distribution["Properties"]["DistributionConfig"]

        def has_viewer_request_lambda(behavior):
            return any(
                association.get("EventType") == "viewer-request"
                for association in behavior.get("LambdaFunctionAssociations", [])
            )

        self.assertTrue(
            has_viewer_request_lambda(distribution_config["DefaultCacheBehavior"])
        )

        behavior_by_path = {
            behavior["PathPattern"]: behavior
            for behavior in distribution_config["CacheBehaviors"]
        }
        for path_pattern in ["/assets/*", "/img/*"]:
            self.assertTrue(has_viewer_request_lambda(behavior_by_path[path_pattern]))

    def test_github_actions_role_can_assume_cdk_bootstrap_roles(self):
        templates = self._templates()
        us_template = templates["mcre-tools-dev-us-east-1"]
        template_json = us_template.to_json()
        resources = template_json["Resources"].values()
        github_actions_role = next(
            resource
            for resource in resources
            if resource["Type"] == "AWS::IAM::Role"
            and resource["Properties"].get("RoleName")
            == "mcre-tools-dev-github-actions"
        )
        statements = [
            statement
            for policy in github_actions_role["Properties"]["Policies"]
            for statement in policy["PolicyDocument"]["Statement"]
        ]
        assume_role_statement = next(
            (
                statement
                for statement in statements
                if statement["Effect"] == "Allow"
                and statement["Action"] == "sts:AssumeRole"
            ),
            None,
        )

        self.assertIsNotNone(assume_role_statement)
        assume_role_resources = [
            json.dumps(resource) for resource in assume_role_statement["Resource"]
        ]
        for region in ["ap-northeast-1", "us-east-1"]:
            for role_type in [
                "deploy-role",
                "file-publishing-role",
                "image-publishing-role",
                "lookup-role",
            ]:
                self.assertTrue(
                    any(
                        f"cdk-hnb659fds-{role_type}-" in resource
                        and region in resource
                        for resource in assume_role_resources
                    ),
                    f"{role_type} in {region}",
                )


if __name__ == "__main__":
    unittest.main()
