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

    def test_primary_table_has_group_room_lookup_index_and_ttl(self):
        templates = self._templates()
        jp_template = templates["mcre-tools-dev-ap-northeast-1"]

        jp_template.has_resource_properties(
            "AWS::DynamoDB::Table",
            {
                "TimeToLiveSpecification": {
                    "AttributeName": "ttl",
                    "Enabled": True,
                },
                "GlobalSecondaryIndexes": Match.array_with(
                    [
                        Match.object_like(
                            {
                                "IndexName": "search_key_1-order-index",
                                "KeySchema": [
                                    {
                                        "AttributeName": "search_key_1",
                                        "KeyType": "HASH",
                                    },
                                    {"AttributeName": "order", "KeyType": "RANGE"},
                                ],
                            }
                        )
                    ]
                ),
            },
        )

    def test_polling_mvp_does_not_create_websocket_resources(self):
        templates = self._templates()
        jp_template = templates["mcre-tools-dev-ap-northeast-1"]
        template_json = jp_template.to_json()

        self.assertFalse(
            any(
                resource["Type"].startswith("AWS::ApiGatewayV2::")
                for resource in template_json["Resources"].values()
            )
        )
        self.assertNotIn("tools-ws-dev.mcre.info", json.dumps(template_json))

    def test_api_lambda_has_group_room_permissions_and_deploy_output(self):
        templates = self._templates()
        jp_template = templates["mcre-tools-dev-ap-northeast-1"]
        template_json = jp_template.to_json()

        jp_template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "FunctionName": "mcre-tools-dev-api",
                "Runtime": "python3.13",
                "Environment": {
                    "Variables": {
                        "DYNAMO_DB_PRIMARY_TABLE_NAME": {
                            "Ref": Match.string_like_regexp("dynamodbprimary")
                        },
                        "LOG_LEVEL": "DEBUG",
                    }
                },
            },
        )
        jp_template.has_resource_properties(
            "Custom::LogRetention",
            {
                "LogGroupName": "/aws/lambda/mcre-tools-dev-api",
                "RetentionInDays": 90,
            },
        )

        api_role = next(
            resource
            for resource in template_json["Resources"].values()
            if resource["Type"] == "AWS::IAM::Role"
            and resource["Properties"].get("RoleName")
            == "mcre-tools-dev-lambda-api"
        )
        api_policy_statements = [
            statement
            for policy in api_role["Properties"]["Policies"]
            for statement in policy["PolicyDocument"]["Statement"]
        ]
        self.assertTrue(
            any(
                "dynamodb:TransactWriteItems" in statement["Action"]
                and "dynamodb:Query" in statement["Action"]
                and "dynamodb:ConditionCheckItem" in statement["Action"]
                for statement in api_policy_statements
            )
        )
        self.assertNotIn("execute-api:ManageConnections", json.dumps(template_json))
        self.assertNotIn("mcre-tools-dev-realtime", json.dumps(template_json))

    def test_api_cors_allows_localhost_and_loopback_preview_origins(self):
        templates = self._templates()
        jp_template = templates["mcre-tools-dev-ap-northeast-1"]
        template_json = jp_template.to_json()

        options_methods = [
            resource
            for resource in template_json["Resources"].values()
            if resource["Type"] == "AWS::ApiGateway::Method"
            and resource.get("Properties", {}).get("HttpMethod") == "OPTIONS"
        ]
        self.assertEqual(len(options_methods), 1)
        response_templates = options_methods[0]["Properties"]["Integration"][
            "IntegrationResponses"
        ][0]["ResponseTemplates"]
        cors_template = response_templates["application/json"]

        for origin in [
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]:
            self.assertIn(origin, cors_template)

        jp_template.has_output("LambdaFunctions", {"Value": Match.any_value()})
        lambda_functions_output = template_json["Outputs"]["LambdaFunctions"]["Value"]
        self.assertIn("api", json.dumps(lambda_functions_output))
        self.assertIn("ogp", json.dumps(lambda_functions_output))
        self.assertNotIn("realtime", json.dumps(lambda_functions_output))

    def test_vite_env_excludes_realtime_websocket_url(self):
        templates = self._templates()
        jp_template = templates["mcre-tools-dev-ap-northeast-1"]
        vite_env_output = jp_template.to_json()["Outputs"]["ViteEnvJp"]["Value"]

        self.assertNotIn("VITE_REALTIME_WS_URL", json.dumps(vite_env_output))
        self.assertNotIn("tools-ws-dev.mcre.info", json.dumps(vite_env_output))

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
