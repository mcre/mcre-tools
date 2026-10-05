import importlib
import json
import os
import pathlib
import sys
import unittest
import zipfile
from unittest.mock import patch

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

    def _edge_source(self, change_locale=None):
        read_text = pathlib.Path.read_text
        locales_dir = CDK_ROOT.parents[1] / "src" / "locales"

        def read_locale(path, *args, **kwargs):
            content = read_text(path, *args, **kwargs)
            if change_locale and path.parent == locales_dir and path.suffix == ".json":
                data = json.loads(content)
                change_locale(path.stem, data)
                return json.dumps(data, ensure_ascii=False)
            return content

        sys.modules.pop("app", None)
        with patch.object(pathlib.Path, "read_text", autospec=True, side_effect=read_locale):
            self._templates()
        return (
            CDK_ROOT / "work" / "response-to-bot-with-directory-index" / "index.js"
        ).read_text()

    def _embedded_locales(self, source):
        return json.loads(source.split("const LOCALES = ", 1)[1].split(";\n", 1)[0])

    def test_edge_source_contains_only_metadata_used_by_the_handler(self):
        embedded = self._embedded_locales(self._edge_source())
        locales_dir = CDK_ROOT.parents[1] / "src" / "locales"
        originals = {
            path.stem: json.loads(path.read_text()) for path in locales_dir.glob("*.json")
        }
        self.assertEqual(set(embedded), set(originals))
        for locale, original in originals.items():
            with self.subTest(locale=locale):
                self.assertEqual(
                    embedded[locale],
                    {
                        "localeName": original["localeName"],
                        "common": {"title": original["common"]["title"]},
                        "tools": {
                            tool: {
                                "title": messages["title"],
                                "description": messages["description"],
                            }
                            for tool, messages in original["tools"].items()
                        },
                    },
                )
                self.assertEqual(
                    list(embedded[locale]["tools"]), list(original["tools"])
                )

    def test_interface_copy_changes_leave_the_generated_edge_source_unchanged(self):
        before = self._edge_source()

        def change_copy(locale, data):
            data["common"]["moveToHome"] = f"Updated home label ({locale})"
            data["tools"]["pi-lab"]["monte"]["addOne"] = "Updated dot label"
            data["tools"]["pi-lab"]["seoTitle"] = "Updated static page title"
            data["tools"]["pi-lab"]["descriptionShort"] = "Updated card text"

        self.assertEqual(before, self._edge_source(change_copy))

    def test_ogp_metadata_and_new_tools_change_the_generated_edge_source(self):
        before = self._edge_source()

        def change_metadata(locale, data):
            data["localeName"] = f"updated_{locale}"
            data["common"]["title"] = f"Updated site ({locale})"
            data["tools"]["pi-lab"]["title"] = f"Updated tool ({locale})"
            data["tools"]["pi-lab"]["description"] = f"Updated description ({locale})"
            data["tools"]["new-tool"] = {
                "title": f"New tool ({locale})",
                "description": f"New description ({locale})",
                "button": "An interface label",
            }

        after = self._edge_source(change_metadata)
        self.assertNotEqual(before, after)
        for locale, metadata in self._embedded_locales(after).items():
            with self.subTest(locale=locale):
                self.assertEqual(metadata["localeName"], f"updated_{locale}")
                self.assertEqual(metadata["common"]["title"], f"Updated site ({locale})")
                self.assertEqual(
                    metadata["tools"]["pi-lab"]["title"], f"Updated tool ({locale})"
                )
                self.assertEqual(
                    metadata["tools"]["pi-lab"]["description"],
                    f"Updated description ({locale})",
                )
                self.assertEqual(
                    metadata["tools"]["new-tool"],
                    {
                        "title": f"New tool ({locale})",
                        "description": f"New description ({locale})",
                    },
                )

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

    def test_primary_table_has_no_group_room_index_or_ttl(self):
        templates = self._templates()
        jp_template = templates["mcre-tools-dev-ap-northeast-1"]
        table = next(iter(jp_template.find_resources("AWS::DynamoDB::Table").values()))
        properties = table["Properties"]
        self.assertNotIn("GlobalSecondaryIndexes", properties)
        self.assertNotIn("TimeToLiveSpecification", properties)

    def test_stack_does_not_create_websocket_resources(self):
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

    def test_api_lambda_has_deploy_output(self):
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

    def test_dev_dist_is_public_and_noindex_on_all_site_behaviors(self):
        config = importlib.import_module("config").get_env_config()
        self.assertNotIn("basic_auth", config["cloudfront"]["dist"])
        self.assertTrue(config["cloudfront"]["dist"]["noindex"])

        templates = self._templates()
        us_template = templates["mcre-tools-dev-us-east-1"]
        distribution = next(
            resource
            for resource in us_template.to_json()["Resources"].values()
            if resource["Type"] == "AWS::CloudFront::Distribution"
        )
        distribution_config = distribution["Properties"]["DistributionConfig"]

        response_policies = us_template.find_resources(
            "AWS::CloudFront::ResponseHeadersPolicy"
        )
        self.assertEqual(len(response_policies), 1)
        policy_id, policy = next(iter(response_policies.items()))
        custom_headers = policy["Properties"]["ResponseHeadersPolicyConfig"][
            "CustomHeadersConfig"
        ]["Items"]
        self.assertIn(
            {"Header": "X-Robots-Tag", "Value": "noindex, nofollow", "Override": True},
            custom_headers,
        )
        security_headers = policy["Properties"]["ResponseHeadersPolicyConfig"][
            "SecurityHeadersConfig"
        ]
        self.assertTrue(security_headers["ContentTypeOptions"]["Override"])
        self.assertEqual(
            security_headers["FrameOptions"]["FrameOption"], "SAMEORIGIN"
        )
        self.assertTrue(
            security_headers["StrictTransportSecurity"]["IncludeSubdomains"]
        )

        def has_viewer_request_lambda(behavior):
            return any(
                association.get("EventType") == "viewer-request"
                for association in behavior.get("LambdaFunctionAssociations", [])
            )

        self.assertTrue(
            has_viewer_request_lambda(distribution_config["DefaultCacheBehavior"])
        )
        self.assertEqual(
            distribution_config["DefaultCacheBehavior"]["ResponseHeadersPolicyId"],
            {"Ref": policy_id},
        )

        behavior_by_path = {
            behavior["PathPattern"]: behavior
            for behavior in distribution_config["CacheBehaviors"]
        }
        for path_pattern in ["/assets/*", "/img/*"]:
            self.assertTrue(has_viewer_request_lambda(behavior_by_path[path_pattern]))
            self.assertEqual(
                behavior_by_path[path_pattern]["ResponseHeadersPolicyId"],
                {"Ref": policy_id},
            )

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
