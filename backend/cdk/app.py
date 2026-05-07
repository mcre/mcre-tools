import base64
import json
from pathlib import Path

from aws_cdk import App, Aws, CfnOutput, Environment, Stack, aws_iam as iam

from config import get_env_config
from resources import (
    create_acm_certificate,
    create_apigateway,
    create_cloudfront,
    create_dynamodb_primary_table,
    create_iam_role_github_actions,
    create_lambda_edge_function_version,
    create_lambda_function,
    create_lambda_layer,
    create_s3_bucket,
    create_websocket_api,
    vite_env_output,
)


config = get_env_config()
app = App()
cdk_root = Path(__file__).parent


def env(region: str) -> Environment:
    return Environment(account=config["aws"]["account_id"], region=region)


def stack_name(region: str) -> str:
    if config["env"] == "prod":
        return (
            f"{config['prefix']}-stack"
            if region == "ap-northeast-1"
            else f"{config['prefix']}-stack-us-east-1"
        )
    return f"{config['prefix']}-{region}"


stack_jp = Stack(
    app,
    stack_name("ap-northeast-1"),
    env=env("ap-northeast-1"),
    cross_region_references=True,
    tags={tag["key"]: tag["value"] for tag in config["tags"]},
)

dynamodb_primary_table = create_dynamodb_primary_table(stack_jp)
bucket_ogp = create_s3_bucket(stack_jp, "ogp", public_read_access=True)

policy_dynamodb_primary_rw = iam.PolicyStatement(
    actions=[
        "dynamodb:GetItem",
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:TransactWriteItems",
    ],
    resources=[
        dynamodb_primary_table.table_arn,
        f"{dynamodb_primary_table.table_arn}/*",
    ],
)
policy_s3_ogp_rw = iam.PolicyStatement(
    actions=["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
    resources=[
        bucket_ogp.bucket_arn,
        f"{bucket_ogp.bucket_arn}/*",
    ],
)

layer_pillow = create_lambda_layer(stack_jp, "pillow", "Pillow-11.3.0-py313")

lambda_api = create_lambda_function(
    stack_jp,
    "api",
    policies=[policy_dynamodb_primary_rw],
    environment={
        "DYNAMO_DB_PRIMARY_TABLE_NAME": dynamodb_primary_table.table_name,
    },
)
lambda_realtime = create_lambda_function(
    stack_jp,
    "realtime",
    policies=[policy_dynamodb_primary_rw],
    environment={
        "DYNAMO_DB_PRIMARY_TABLE_NAME": dynamodb_primary_table.table_name,
    },
)
lambda_ogp = create_lambda_function(
    stack_jp,
    "ogp",
    policies=[policy_s3_ogp_rw],
    environment={
        "S3_OGP_BUCKET_NAME": bucket_ogp.bucket_name,
        "DOMAIN_NAME_DISTRIBUTION": f"{config['cloudfront']['dist']['domain']['name']}.{config['cloudfront']['dist']['domain']['zone_name']}",
    },
    layers=[layer_pillow],
)
github_actions_lambda_deploy_targets = [lambda_api, lambda_realtime, lambda_ogp]
github_actions_cdk_deploy_regions = ["ap-northeast-1", "us-east-1"]
github_actions_cdk_bootstrap_role_types = [
    "deploy-role",
    "file-publishing-role",
    "image-publishing-role",
    "lookup-role",
]

dist_domain_config = config["cloudfront"]["dist"]["domain"]
dist_domain_name = (
    f"{dist_domain_config['name']}.{dist_domain_config['zone_name']}"
    if dist_domain_config.get("name")
    else dist_domain_config["zone_name"]
)
app_cors_allow_origins = [
    f"https://{dist_domain_name}",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:4173",
    "http://localhost:5173",
]

acm_result_api = create_acm_certificate(
    stack_jp, "api", config["api-gateway"]["api"]["domain"]
)
create_apigateway(
    stack_jp,
    "api",
    lambda_api,
    acm_result_api,
    cors_allow_origins=app_cors_allow_origins,
)

acm_result_ogp = create_acm_certificate(
    stack_jp, "ogp", config["api-gateway"]["ogp"]["domain"]
)
create_apigateway(stack_jp, "ogp", lambda_ogp, acm_result_ogp)

acm_result_websocket = create_acm_certificate(
    stack_jp, "websocket", config["api-gateway"]["websocket"]["domain"]
)
websocket_api = create_websocket_api(
    stack_jp,
    "websocket",
    lambda_realtime,
    acm_result_websocket,
)
lambda_realtime.add_to_role_policy(
    iam.PolicyStatement(
        actions=["execute-api:ManageConnections"],
        resources=[
            f"arn:{Aws.PARTITION}:execute-api:{Aws.REGION}:{Aws.ACCOUNT_ID}:{websocket_api.api_id}/*"
        ],
    )
)


stack_us = Stack(
    app,
    stack_name("us-east-1"),
    env=env("us-east-1"),
    cross_region_references=True,
    tags={tag["key"]: tag["value"] for tag in config["tags"]},
)

bucket_distribution = create_s3_bucket(stack_us, "dist")
acm_result_dist = create_acm_certificate(
    stack_us, "dist", config["cloudfront"]["dist"]["domain"]
)

locales_dir_path = cdk_root.parents[1] / "src" / "locales"
locales_data = {}
for filename in locales_dir_path.iterdir():
    if filename.suffix == ".json":
        locales_data[filename.stem] = json.loads(filename.read_text())

dist_basic_auth_config = config["cloudfront"]["dist"].get("basic_auth", {})
dist_basic_auth_enabled = bool(dist_basic_auth_config.get("enabled", False))
dist_basic_auth_header = ""
if dist_basic_auth_enabled:
    dist_basic_auth_credentials = (
        f"{dist_basic_auth_config['username']}:{dist_basic_auth_config['password']}"
    )
    dist_basic_auth_header = "Basic " + base64.b64encode(
        dist_basic_auth_credentials.encode()
    ).decode()

lambda_edge_version_response_to_bot_with_directory_index = (
    create_lambda_edge_function_version(
        stack_us,
        "response-to-bot-with-directory-index",
        {
            "LOCALES": json.dumps(locales_data, ensure_ascii=False),
            "DOMAIN_NAME_OGP": acm_result_ogp["domain_name"],
            "DOMAIN_NAME_DIST": acm_result_dist["domain_name"],
            "BASIC_AUTH_ENABLED": json.dumps(dist_basic_auth_enabled),
            "BASIC_AUTH_HEADER": dist_basic_auth_header,
        },
    )
)

cloudfront_distribution = create_cloudfront(
    stack_us,
    "dist",
    bucket_distribution,
    acm_result_dist,
    lambda_edge_version_response_to_bot_with_directory_index,
)

policies = [
    iam.PolicyStatement(
        actions=["s3:ListBucket", "s3:PutObject", "s3:DeleteObject"],
        resources=[
            bucket_distribution.bucket_arn,
            f"{bucket_distribution.bucket_arn}/*",
        ],
    ),
    iam.PolicyStatement(
        actions=["lambda:UpdateFunctionCode"],
        resources=[
            lambda_function.function_arn
            for lambda_function in github_actions_lambda_deploy_targets
        ],
    ),
    iam.PolicyStatement(
        actions=["cloudfront:GetInvalidation", "cloudfront:CreateInvalidation"],
        resources=[
            f"arn:aws:cloudfront::{Aws.ACCOUNT_ID}:distribution/{cloudfront_distribution.distribution_id}"
        ],
    ),
    iam.PolicyStatement(
        actions=["cloudformation:DescribeStacks"],
        resources=[
            f"arn:aws:cloudformation:us-east-1:{Aws.ACCOUNT_ID}:stack/{stack_us.stack_name}/*",
            f"arn:aws:cloudformation:ap-northeast-1:{Aws.ACCOUNT_ID}:stack/{stack_jp.stack_name}/*",
        ],
    ),
    iam.PolicyStatement(
        actions=["sts:AssumeRole"],
        resources=[
            f"arn:{Aws.PARTITION}:iam::{Aws.ACCOUNT_ID}:role/cdk-hnb659fds-{role_type}-{Aws.ACCOUNT_ID}-{region}"
            for region in github_actions_cdk_deploy_regions
            for role_type in github_actions_cdk_bootstrap_role_types
        ],
    ),
]
iam_role_github_actions = create_iam_role_github_actions(stack_us, policies)

CfnOutput(stack_jp, "Prefix", value=config["prefix"])
CfnOutput(stack_jp, "DomainNameApi", value=acm_result_api["domain_name"])
CfnOutput(stack_jp, "DomainNameOgp", value=acm_result_ogp["domain_name"])
CfnOutput(stack_jp, "DomainNameWebsocket", value=acm_result_websocket["domain_name"])
CfnOutput(
    stack_jp,
    "LambdaFunctions",
    value=",".join(
        [
            lambda_function.function_name
            for lambda_function in github_actions_lambda_deploy_targets
        ]
    ),
)
CfnOutput(
    stack_jp,
    "ViteEnvJp",
    value=vite_env_output(
        {
            **config.get("vite_env", {}),
            "VITE_API_DOMAIN_NAME": acm_result_api["domain_name"],
            "VITE_OGP_DOMAIN_NAME": acm_result_ogp["domain_name"],
            "VITE_REALTIME_WS_URL": f"wss://{acm_result_websocket['domain_name']}",
        }
    ),
)

CfnOutput(stack_us, "IamRoleGithubActions", value=iam_role_github_actions.role_arn)
CfnOutput(stack_us, "DomainNameDistribution", value=acm_result_dist["domain_name"])
CfnOutput(stack_us, "BucketDistribution", value=bucket_distribution.bucket_name)
CfnOutput(
    stack_us, "CloudfrontDistribution", value=cloudfront_distribution.distribution_id
)
CfnOutput(
    stack_us,
    "ViteEnvUs",
    value=vite_env_output(
        {
            "VITE_DISTRIBUTION_DOMAIN_NAME": acm_result_dist["domain_name"],
        }
    ),
)

app.synth()
