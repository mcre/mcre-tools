from aws_cdk import (
    App,
    Stack,
    aws_iam as iam,
)


from resources import (
    create_dynamodb_primary_table,
    create_lambda_function,
    create_apigateway,
    create_s3_bucket,
    create_cloudfront_distribution,
)
from config import get_env_config

# 開始処理
config = get_env_config()
app = App()
stack = Stack(app, f"{config['prefix']}-stack")

# DynamoDB
dynamodb_primary_table = create_dynamodb_primary_table(stack)

# Lambda
## Lambda IAM Policy
policy_dynamodb_primary_rw = iam.PolicyStatement(
    effect=iam.Effect.ALLOW,
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
create_cloudfront_distribution(stack, "distribution", bucket_distribution)

# 終了処理
app.synth()
