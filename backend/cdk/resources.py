from aws_cdk import (
    Stack,
    Tags,
    Duration,
    RemovalPolicy,
    Size,
    aws_lambda as lambda_,
    aws_apigateway as apigateway,
    aws_dynamodb as dynamodb,
    aws_iam as iam,
    aws_logs as logs,
    aws_certificatemanager as acm,
    aws_route53 as route53,
    aws_route53_targets as route53_targets,
    aws_s3 as s3,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as cloudfront_origins,
)
from config import get_env_config

config = get_env_config()


def add_tags(resource):
    for tag in config["tags"]:
        Tags.of(resource).add(tag["key"], tag["value"])


def create_dynamodb_primary_table(scope: Stack):
    table_config = config["dynamodb"]["primary"]
    dp = table_config["deletion_protection"]
    resource = dynamodb.Table(
        scope,
        "dynamodb-primary",
        table_name=f"{config['prefix']}-primary",
        billing_mode=dynamodb.BillingMode.PROVISIONED,
        deletion_protection=dp,
        point_in_time_recovery=table_config["point_in_time_recovery"],
        read_capacity=table_config["capacity"]["table"]["read"],
        write_capacity=table_config["capacity"]["table"]["write"],
        removal_policy=RemovalPolicy.RETAIN if dp else RemovalPolicy.DESTROY,
        partition_key=dynamodb.Attribute(name="id", type=dynamodb.AttributeType.STRING),
    )

    if "autoscaling" in table_config["capacity"]["table"]:
        asc = table_config["capacity"]["table"]["autoscaling"]
        resource.auto_scale_read_capacity(
            min_capacity=asc["read"]["min"], max_capacity=asc["read"]["max"]
        ).scale_on_utilization(target_utilization_percent=asc["read"]["percent"])
        resource.auto_scale_write_capacity(
            min_capacity=asc["write"]["min"], max_capacity=asc["write"]["max"]
        ).scale_on_utilization(target_utilization_percent=asc["write"]["percent"])

    columns = [
        ("record_type", dynamodb.AttributeType.STRING),
    ]

    for column_name, column_type in columns:
        resource.add_global_secondary_index(
            index_name=f"{column_name}-id-index",
            partition_key=dynamodb.Attribute(name=column_name, type=column_type),
            sort_key=dynamodb.Attribute(name="id", type=dynamodb.AttributeType.STRING),
            read_capacity=table_config["capacity"][column_name]["read"],
            write_capacity=table_config["capacity"][column_name]["write"],
        )
        if "autoscaling" in table_config["capacity"][column_name]:
            ascg = table_config["capacity"][column_name]["autoscaling"]
            resource.auto_scale_global_secondary_index_read_capacity(
                index_name=f"{column_name}-id-index",
                min_capacity=ascg["read"]["min"],
                max_capacity=ascg["read"]["max"],
            ).scale_on_utilization(
                target_utilization_percent=ascg["read"]["percent"],
            )
            resource.auto_scale_global_secondary_index_write_capacity(
                index_name=f"{column_name}-id-index",
                min_capacity=ascg["write"]["min"],
                max_capacity=ascg["write"]["max"],
            ).scale_on_utilization(
                target_utilization_percent=ascg["write"]["percent"],
            )

    add_tags(resource)
    return resource


def create_lambda_function(
    scope: Stack,
    name: str,
    policies: list = [],
):
    policies.append(
        iam.PolicyStatement(
            actions=[
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
            ],
            resources=["arn:aws:logs:*:*:*"],
        )
    )

    iam_role_name = f"{config['prefix']}-lambda-{name}"
    iam_role = iam.Role(
        scope,
        f"iam-role-lambda-{name}",
        role_name=iam_role_name,
        assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
        inline_policies={
            f"{iam_role_name}-policy": iam.PolicyDocument(statements=policies)
        },
    )
    add_tags(iam_role)

    resource = lambda_.Function(
        scope,
        f"lambda-function-{name}",
        function_name=f"{config['prefix']}-{name}",
        code=lambda_.InlineCode("def main(event, context):\n    pass"),
        handler="main.main",
        runtime=lambda_.Runtime.PYTHON_3_12,
        memory_size=config["lambda"][name]["memory"],
        timeout=Duration.seconds(config["lambda"][name]["timeout_in_seconds"]),
        role=iam_role,
        log_retention=logs.RetentionDays.INFINITE,
        ephemeral_storage_size=Size.mebibytes(512),
    )

    add_tags(resource)
    return resource


def create_apigateway(scope: Stack, name: str, target_lambda: lambda_.Function):
    resource = apigateway.RestApi(
        scope,
        f"api-gateway-{name}",
        rest_api_name=f"{config['prefix']}-{name}",
        endpoint_types=[apigateway.EndpointType.REGIONAL],
    )
    add_tags(resource)

    lambda_integration = apigateway.LambdaIntegration(target_lambda)
    proxy_resource = resource.root.add_resource("{proxy+}")
    proxy_resource.add_method("ANY", lambda_integration)
    proxy_resource.add_cors_preflight(
        allow_origins=[
            f"https://{config["cloudfront"]["domain"]["distribution"]['name']}.{config["cloudfront"]["domain"]["distribution"]['zone_name']}",
            "http://localhost:3000",
        ]
    )
    domain_config = config["api-gateway"]["domain"][name]

    existing_hosted_zone = route53.HostedZone.from_hosted_zone_attributes(
        scope,
        f"api-gateway-hosted-zone-{name}",
        hosted_zone_id=domain_config["hosted_zone_id"],
        zone_name=domain_config["zone_name"],
    )

    custom_domain = apigateway.DomainName(
        scope,
        f"api-gateway-domain-{name}",
        domain_name=f"{domain_config['name']}.{domain_config['zone_name']}",
        certificate=acm.Certificate.from_certificate_arn(
            scope,
            f"api-gateway-certificate-{name}",
            domain_config["certificate_arn"],
        ),
        endpoint_type=apigateway.EndpointType.REGIONAL,
        security_policy=apigateway.SecurityPolicy.TLS_1_2,
    )
    add_tags(custom_domain)

    apigateway.BasePathMapping(
        scope,
        f"base-path-mapping-{name}",
        domain_name=custom_domain,
        rest_api=resource,
        stage=resource.deployment_stage,
        base_path=domain_config.get("base_path", ""),
    )

    route53.ARecord(
        scope,
        f"api-gateway-a-record-{name}",
        record_name=domain_config["name"],
        zone=existing_hosted_zone,
        target=route53.RecordTarget.from_alias(
            route53_targets.ApiGatewayDomain(custom_domain)
        ),
    )

    return resource


def create_s3_bucket(scope: Stack, name: str):
    dp = config["s3"][name]["deletion_protection"]
    resource = s3.Bucket(
        scope,
        f"s3-bucket-{name}",
        bucket_name=f"{config['prefix']}-{name}",
        removal_policy=RemovalPolicy.RETAIN if dp else RemovalPolicy.DESTROY,
    )
    add_tags(resource)
    return resource


def create_cloudfront(scope: Stack, name: str, bucket: s3.Bucket):
    domain_config = config["cloudfront"]["domain"][name]

    existing_hosted_zone = route53.HostedZone.from_hosted_zone_attributes(
        scope,
        f"cloudfront-hosted-zone-{name}",
        hosted_zone_id=domain_config["hosted_zone_id"],
        zone_name=domain_config["zone_name"],
    )

    resource = cloudfront.Distribution(
        scope,
        f"cloudfront-distribution-{name}",
        certificate=acm.Certificate.from_certificate_arn(
            scope,
            f"cloudfront-certificate-{name}",
            domain_config["certificate_arn"],
        ),
        domain_names=[f"{domain_config['name']}.{domain_config['zone_name']}"],
        default_behavior=cloudfront.BehaviorOptions(
            origin=cloudfront_origins.S3Origin(bucket),
            viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        ),
        default_root_object="index.html",
        error_responses=[
            cloudfront.ErrorResponse(
                http_status=403,
                response_http_status=200,
                response_page_path="/",
                ttl=Duration.seconds(0),
            ),
        ],
    )

    route53.ARecord(
        scope,
        f"cloudfront-a-record-{name}",
        record_name=domain_config["name"],
        zone=existing_hosted_zone,
        target=route53.RecordTarget.from_alias(
            route53_targets.CloudFrontTarget(resource)
        ),
    )

    add_tags(resource)
    return resource


def create_iam_role_github_actions(scope: Stack, policies: list = []):
    owner = "mcre"
    repo = "mcre-tools"

    rg = "ap-northeast-1"
    id = config["account_id"]
    cdk_identifier = config["cdk_identifier"]

    policies.extend(
        [
            iam.PolicyStatement(
                actions=["ssm:GetParameter"],
                resources=[
                    f"arn:aws:ssm:{rg}:{id}:parameter/cdk-bootstrap/{cdk_identifier}/*"
                ],
            ),
            iam.PolicyStatement(
                actions=["sts:AssumeRole"],
                resources=[
                    f"arn:aws:iam::{id}:role/cdk-{cdk_identifier}-deploy-role-{id}-{rg}",
                    f"arn:aws:iam::{id}:role/cdk-{cdk_identifier}-file-publishing-role-{id}-{rg}",
                    f"arn:aws:iam::{id}:role/cdk-{cdk_identifier}-image-publishing-role-{id}-{rg}",
                    f"arn:aws:iam::{id}:role/cdk-{cdk_identifier}-lookup-role--{id}-{rg}",
                ],
            ),
            iam.PolicyStatement(
                actions=["s3:ListBucket", "s3:GetObject", "s3:PutObject"],
                resources=[
                    f"arn:aws:s3:::cdk-{cdk_identifier}-assets-{id}-{rg}",
                    f"arn:aws:s3:::cdk-{cdk_identifier}-assets-{id}-{rg}/*",
                ],
            ),
        ]
    )

    resource = iam.Role(
        scope,
        "iam-role-github-actions",
        role_name=f"{config['prefix']}-github-actions",
        assumed_by=iam.WebIdentityPrincipal(
            config["iam"]["open_id_connect_provider"]["github_arn"],
            {
                "StringLike": {
                    "token.actions.githubusercontent.com:sub": f"repo:{owner}/{repo}:*"
                }
            },
        ),
        inline_policies={
            f"{config['prefix']}-github-actions-policy": iam.PolicyDocument(
                statements=policies
            )
        },
    )

    add_tags(resource)
    return resource
