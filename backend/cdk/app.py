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

## Lambda Function
lambda_layers = [
    lambda_.LayerVersion.from_layer_version_arn(
        stack,
        "lambda-layers-powertools",
        "arn:aws:lambda:ap-northeast-1:017000801446:layer:AWSLambdaPowertoolsPythonV2:78",
    )
]

lambda_api = create_lambda_function(
    stack,
    "api",
    policies=[policy_dynamodb_primary_rw],
    environment={
        "DYNAMO_DB_PRIMARY_TABLE_NAME": dynamodb_primary_table.table_name,
    },
    layers=lambda_layers,
)
github_actions_lambda_deploy_targets = [lambda_api]

# API-Gateway
acm_api, hosted_zone_api, domain_name_api = create_acm_certificate(
    stack, "api", config["api-gateway"]["domain"]["api"]
)
create_apigateway(stack, "api", lambda_api, acm_api, hosted_zone_api, domain_name_api)


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
acm_distribution, hosted_zone_distribution, domain_name_distribution = (
    create_acm_certificate(stack_us, "dist", config["cloudfront"]["domain"]["dist"])
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
    acm_distribution,
    hosted_zone_distribution,
    domain_name_distribution,
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
CfnOutput(stack, "DomainNameApi", value=domain_name_api)
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

CfnOutput(stack_us, "DomainNameDistribution", value=domain_name_distribution)
CfnOutput(stack_us, "BucketDistribution", value=bucket_distribution.bucket_name)
CfnOutput(
    stack_us, "CloudfrontDistribution", value=cloudfront_distribution.distribution_id
)

# 終了処理
app.synth()
