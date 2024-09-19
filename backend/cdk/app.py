import os
from aws_cdk import (
    App,
    Environment,
    Stack,
    CfnOutput,
    aws_lambda as lambda_,
    aws_iam as iam,
)


from resources import (
    create_acm_certificate,
    create_dynamodb_primary_table,
    create_lambda_layer,
    create_lambda_edge_function_version,
    create_lambda_function,
    create_apigateway,
    create_s3_bucket,
    create_cloudfront,
    create_iam_role_github_actions,
)
from config import get_env_config

# 開始処理
config = get_env_config()
app = App()

# ===== 東京リージョン =====
stack = Stack(
    app,
    f"{config['prefix']}-stack",
    env=Environment(region="ap-northeast-1"),
    cross_region_references=True,
)

# DynamoDB
dynamodb_primary_table = create_dynamodb_primary_table(stack)

# S3
bucket_ogp = create_s3_bucket(stack, "ogp", public_read_access=True)

# Lambda
## Lambda IAM Policy
policy_dynamodb_primary_rw = iam.PolicyStatement(
    actions=[
        "dynamodb:GetItem",
        "dynamodb:Scan",
        "dynamodb:Query",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
    ],
    resources=[
        dynamodb_primary_table.table_arn,
        f"{dynamodb_primary_table.table_arn}/*",
    ],
)

policy_s3_ogp_rw = iam.PolicyStatement(
    actions=["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
    resources=[
        f"arn:aws:s3:::{bucket_ogp.bucket_name}",
        f"arn:aws:s3:::{bucket_ogp.bucket_name}/*",
    ],
)

## Lambda Function
layer_pillow = create_lambda_layer(stack, "pillow", "Pillow-10.4.0")
layer_powertools = lambda_.LayerVersion.from_layer_version_arn(
    stack,
    "lambda-layer-powertools",
    "arn:aws:lambda:ap-northeast-1:017000801446:layer:AWSLambdaPowertoolsPythonV2:78",
)

lambda_api = create_lambda_function(
    stack,
    "api",
    policies=[policy_dynamodb_primary_rw],
    environment={
        "DYNAMO_DB_PRIMARY_TABLE_NAME": dynamodb_primary_table.table_name,
    },
    layers=[layer_powertools],
)

lambda_ogp = create_lambda_function(
    stack,
    "ogp",
    policies=[policy_s3_ogp_rw],
    environment={
        "S3_OGP_BUCKET_NAME": bucket_ogp.bucket_name,
        "DOMAIN_NAME_DISTRIBUTION": f'{config["cloudfront"]["domain"]["dist"]["name"]}.{config["cloudfront"]["domain"]["dist"]["zone_name"]}',
    },
    layers=[layer_powertools, layer_pillow],
)

github_actions_lambda_deploy_targets = [lambda_api, lambda_ogp]

# API-Gateway
acm_result_api = create_acm_certificate(
    stack, "api", config["api-gateway"]["domain"]["api"]
)
create_apigateway(
    stack,
    "api",
    lambda_api,
    acm_result_api,
    cors_allow_origins=[
        f"https://{config['cloudfront']['domain']['dist']['name']}.{config['cloudfront']['domain']['dist']['zone_name']}",
        "http://localhost:3000",
    ],
)

acm_result_ogp = create_acm_certificate(
    stack, "ogp", config["api-gateway"]["domain"]["ogp"]
)
create_apigateway(stack, "ogp", lambda_ogp, acm_result_ogp)

# ===== USリージョン =====
# CloudFront関係はUSリージョンにある必要がある
# 仮にCloudFrontを東京リージョン置いた場合はLambda Edgeのコード更新時にエラーが発生するうえに戻せなくなり、スタックが壊れるので、やってはいけない。
#  https://github.com/aws/aws-cdk/issues/28200

stack_us = Stack(
    app,
    f"{config['prefix']}-stack-us-east-1",
    env=Environment(region="us-east-1"),
    cross_region_references=True,
)

# S3
bucket_distribution = create_s3_bucket(stack_us, "dist")

# ACM
acm_result_dist = create_acm_certificate(
    stack_us, "dist", config["cloudfront"]["domain"]["dist"]
)

# Lambda
lambda_edge_version_redirect_to_prerender = create_lambda_edge_function_version(
    stack_us, "redirect-to-prerender"
)
lambda_edge_version_set_prerender_header = create_lambda_edge_function_version(
    stack_us,
    "set-prerender-header",
    {"PRERENDER_TOKEN": os.environ["PRERENDER_TOKEN"]},
)

# CloudFront
cloudfront_distribution = create_cloudfront(
    stack_us,
    "dist",
    bucket_distribution,
    acm_result_dist,
    lambda_edge_version_redirect_to_prerender,
    lambda_edge_version_set_prerender_header,
)

# ===== 終了処理 =====
# Github Actions用のIAM Role
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
            f"arn:aws:cloudfront::{config['account_id']}:distribution/{cloudfront_distribution.distribution_id}"
        ],
    ),
]
iam_role_github_actions = create_iam_role_github_actions(stack, policies)

# 後続処理で参照するパラメータを出力する処理
CfnOutput(stack, "Prefix", value=config["prefix"])
CfnOutput(stack, "DomainNameApi", value=acm_result_api["domain_name"])
CfnOutput(stack, "DomainNameOgp", value=acm_result_ogp["domain_name"])
CfnOutput(stack, "IamRoleGithubActions", value=iam_role_github_actions.role_arn)
CfnOutput(
    stack,
    "LambdaFunctions",
    value=",".join(
        [
            lambda_function.function_name
            for lambda_function in github_actions_lambda_deploy_targets
        ]
    ),
)

CfnOutput(stack_us, "DomainNameDistribution", value=acm_result_dist["domain_name"])
CfnOutput(stack_us, "BucketDistribution", value=bucket_distribution.bucket_name)
CfnOutput(
    stack_us, "CloudfrontDistribution", value=cloudfront_distribution.distribution_id
)

# 終了処理
app.synth()
