from aws_cdk import (
    App,
    Environment,
    Stack,
    CfnOutput,
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
lambda_api = create_lambda_function(
    stack,
    "api",
    policies=[policy_dynamodb_primary_rw],
)

# API-Gateway
create_apigateway(stack, "api", lambda_api)

# S3
bucket_distribution = create_s3_bucket(stack, "distribution")

# CloudFront
cloudfront_distribution = create_cloudfront(stack, "distribution", bucket_distribution)

# Github Actions用のIAM Role
iam_role_github_actions = create_iam_role_github_actions(stack)

# 後続処理で参照するパラメータを出力する処理
CfnOutput(stack, "Prefix", value=config["prefix"])
CfnOutput(stack, "IamRoleGithubActions", value=iam_role_github_actions.role_arn)
CfnOutput(stack, "LambdaFunctions", value=",".join([lambda_api.function_name]))
CfnOutput(stack, "BucketDistribution", value=bucket_distribution.bucket_name)
CfnOutput(
    stack, "CloudfrontDistribution", value=cloudfront_distribution.distribution_id
)


# 終了処理
app.synth()
