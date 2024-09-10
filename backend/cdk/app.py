from aws_cdk import (
    App,
    Environment,
    Stack,
    CfnOutput,
    aws_lambda as lambda_,
    aws_iam as iam,
)


from resources import (
    create_dynamodb_primary_table,
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
stack = Stack(
    app, f"{config['prefix']}-stack", env=Environment(region="ap-northeast-1")
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
lambda_functions = [lambda_api]

# API-Gateway
_, domain_name_api = create_apigateway(stack, "api", lambda_api)

# S3
bucket_distribution = create_s3_bucket(stack, "distribution")

# CloudFront
cloudfront_distribution, domain_name_app = create_cloudfront(
    stack, "distribution", bucket_distribution
)

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
            lambda_function.function_arn for lambda_function in lambda_functions
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
CfnOutput(stack, "DomainNameApp", value=domain_name_app)
CfnOutput(stack, "DomainNameApi", value=domain_name_api)
CfnOutput(stack, "IamRoleGithubActions", value=iam_role_github_actions.role_arn)
CfnOutput(
    stack,
    "LambdaFunctions",
    value=",".join(
        [lambda_function.function_name for lambda_function in lambda_functions]
    ),
)
CfnOutput(stack, "BucketDistribution", value=bucket_distribution.bucket_name)
CfnOutput(
    stack, "CloudfrontDistribution", value=cloudfront_distribution.distribution_id
)


# 終了処理
app.synth()
