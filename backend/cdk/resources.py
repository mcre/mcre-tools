import json
import os
import string
from pathlib import Path
from typing import Dict, List, Optional, Union

from aws_cdk import (
    Aws,
    Duration,
    RemovalPolicy,
    Size,
    Stack,
    aws_apigateway as apigateway,
    aws_certificatemanager as acm,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as cloudfront_origins,
    aws_dynamodb as dynamodb,
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_logs as logs,
    aws_route53 as route53,
    aws_route53_targets as route53_targets,
    aws_s3 as s3,
)

from config import get_env_config


config = get_env_config()
CDK_ROOT = Path(__file__).parent
DEPLOYED_CLOUDFRONT_CACHE_POLICY_LOGICAL_IDS = {
    "dist": "distCustomCachePolicyEB4AD228",
}


def _domain_name(domain_config: dict) -> str:
    name = domain_config.get("name")
    zone_name = domain_config["zone_name"]
    return f"{name}.{zone_name}" if name else zone_name


def _hosted_zone(scope: Stack, name: str, domain_config: dict) -> route53.IHostedZone:
    return route53.HostedZone.from_hosted_zone_attributes(
        scope,
        f"hosted-zone-{name}",
        hosted_zone_id=domain_config["hosted_zone_id"],
        zone_name=domain_config["zone_name"],
    )


def _a_record_kwargs(
    acm_result: Dict[str, Union[acm.Certificate, route53.IHostedZone, str]],
) -> dict:
    kwargs = {
        "zone": acm_result["hosted_zone"],
    }
    if acm_result["domain_name"] != acm_result["hosted_zone"].zone_name:
        kwargs["record_name"] = acm_result["domain_name"]
    return kwargs


def create_acm_certificate(
    scope: Stack, name: str, domain_config: dict
) -> Dict[str, Union[acm.Certificate, route53.IHostedZone, str]]:
    hosted_zone = _hosted_zone(scope, name, domain_config)
    domain_name = _domain_name(domain_config)
    resource = acm.Certificate(
        scope,
        f"acm-certificate-{name}",
        domain_name=domain_name,
        validation=acm.CertificateValidation.from_dns(hosted_zone),
    )
    return {
        "certificate": resource,
        "hosted_zone": hosted_zone,
        "domain_name": domain_name,
    }


def create_dynamodb_primary_table(scope: Stack) -> dynamodb.Table:
    table_config = config["dynamodb"]["primary"]
    deletion_protection = table_config["deletion_protection"]
    table = dynamodb.Table(
        scope,
        "dynamodb-primary",
        table_name=f"{config['prefix']}-primary",
        billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
        deletion_protection=deletion_protection,
        point_in_time_recovery_specification=dynamodb.PointInTimeRecoverySpecification(
            point_in_time_recovery_enabled=table_config["point_in_time_recovery"]
        ),
        max_read_request_units=table_config["max_read_request_units"],
        max_write_request_units=table_config["max_write_request_units"],
        removal_policy=(
            RemovalPolicy.RETAIN if deletion_protection else RemovalPolicy.DESTROY
        ),
        partition_key=dynamodb.Attribute(name="id", type=dynamodb.AttributeType.STRING),
        time_to_live_attribute="ttl",
    )
    table.add_global_secondary_index(
        index_name="search_key_1-order-index",
        partition_key=dynamodb.Attribute(
            name="search_key_1", type=dynamodb.AttributeType.STRING
        ),
        sort_key=dynamodb.Attribute(name="order", type=dynamodb.AttributeType.NUMBER),
        projection_type=dynamodb.ProjectionType.ALL,
    )
    return table


def create_s3_bucket(
    scope: Stack,
    name: str,
    public_read_access: bool = False,
) -> s3.Bucket:
    props = config["s3"][name]
    lifecycle_rules = []
    if "remove_days" in props:
        lifecycle_rules.append(
            s3.LifecycleRule(
                id=f"s3-bucket-{name}-lifecycle-rule",
                expiration=Duration.days(props["remove_days"]),
                enabled=True,
            )
        )

    return s3.Bucket(
        scope,
        f"s3-bucket-{name}",
        bucket_name=f"{config['prefix']}-{name}",
        removal_policy=(
            RemovalPolicy.RETAIN
            if props["deletion_protection"]
            else RemovalPolicy.DESTROY
        ),
        auto_delete_objects=not props["deletion_protection"],
        public_read_access=public_read_access,
        block_public_access=(
            s3.BlockPublicAccess.BLOCK_ACLS
            if public_read_access
            else s3.BlockPublicAccess.BLOCK_ALL
        ),
        encryption=s3.BucketEncryption.S3_MANAGED,
        enforce_ssl=True,
        lifecycle_rules=lifecycle_rules,
    )


def create_lambda_layer(scope: Stack, name: str, zip_name: str):
    return lambda_.LayerVersion(
        scope,
        f"lambda-layer-{name}",
        layer_version_name=f"{config['prefix']}-{name}",
        code=lambda_.Code.from_asset(str(CDK_ROOT / "layers" / f"{zip_name}.zip")),
        compatible_runtimes=[lambda_.Runtime.PYTHON_3_13],
    )


def create_lambda_function(
    scope: Stack,
    name: str,
    policies: Optional[List[iam.PolicyStatement]] = None,
    environment: Optional[dict] = None,
    layers: Optional[list] = None,
) -> lambda_.Function:
    iam_role_name = f"{config['prefix']}-lambda-{name}"
    iam_role = iam.Role(
        scope,
        f"iam-role-lambda-{name}",
        role_name=iam_role_name,
        assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
        managed_policies=[
            iam.ManagedPolicy.from_aws_managed_policy_name(
                "service-role/AWSLambdaBasicExecutionRole"
            )
        ],
        inline_policies=(
            {f"{iam_role_name}-policy": iam.PolicyDocument(statements=policies)}
            if policies
            else None
        ),
    )

    log_group_name = f"/aws/lambda/{config['prefix']}-{name}"
    log_retention = logs.RetentionDays[config["lambda"][name]["log_retention"]]
    logs.LogRetention(
        scope,
        f"lambda-log-retention-{name}",
        log_group_name=log_group_name,
        retention=log_retention,
    )

    lambda_environment = environment.copy() if environment else {}
    for key, value in config["lambda"][name].get("env", {}).items():
        lambda_environment[key.upper()] = os.getenv(key.upper(), value)

    return lambda_.Function(
        scope,
        f"lambda-function-{name}",
        function_name=f"{config['prefix']}-{name}",
        code=lambda_.InlineCode("def main(event, context):\n    pass"),
        handler="main.main",
        runtime=lambda_.Runtime.PYTHON_3_13,
        memory_size=config["lambda"][name]["memory"],
        timeout=Duration.seconds(config["lambda"][name]["timeout_in_seconds"]),
        role=iam_role,
        ephemeral_storage_size=Size.mebibytes(512),
        environment=lambda_environment,
        layers=layers or [],
    )


def create_apigateway(
    scope: Stack,
    name: str,
    target_lambda: lambda_.Function,
    acm_result: Dict[str, Union[acm.Certificate, route53.IHostedZone, str]],
    cors_allow_origins: Optional[List[str]] = None,
) -> apigateway.RestApi:
    resource = apigateway.RestApi(
        scope,
        f"api-gateway-{name}",
        rest_api_name=f"{config['prefix']}-{name}",
        endpoint_types=[apigateway.EndpointType.REGIONAL],
        min_compression_size=Size.bytes(0),
    )

    lambda_integration = apigateway.LambdaIntegration(target_lambda)
    proxy_resource = resource.root.add_resource("{proxy+}")
    proxy_resource.add_method("ANY", lambda_integration)
    if cors_allow_origins:
        proxy_resource.add_cors_preflight(allow_origins=cors_allow_origins)

    custom_domain = apigateway.DomainName(
        scope,
        f"api-gateway-domain-{name}",
        domain_name=acm_result["domain_name"],
        certificate=acm_result["certificate"],
        endpoint_type=apigateway.EndpointType.REGIONAL,
        security_policy=apigateway.SecurityPolicy.TLS_1_2,
    )

    domain_config = config["api-gateway"][name]["domain"]
    apigateway.BasePathMapping(
        scope,
        f"base-path-mapping-{name}",
        domain_name=custom_domain,
        rest_api=resource,
        stage=resource.deployment_stage,
        base_path=domain_config.get("base_path"),
    )

    route53.ARecord(
        scope,
        f"api-gateway-a-record-{name}",
        **_a_record_kwargs(acm_result),
        target=route53.RecordTarget.from_alias(
            route53_targets.ApiGatewayDomain(custom_domain)
        ),
    )
    return resource


def create_lambda_edge_function_version(
    scope: Stack,
    name: str,
    replaces: Optional[dict] = None,
    runtime: lambda_.Runtime = lambda_.Runtime.NODEJS_20_X,
) -> lambda_.Version:
    iam_role_name = f"{config['prefix']}-lambda-{name}"
    iam_role = iam.Role(
        scope,
        f"iam-role-lambda-{name}",
        role_name=iam_role_name,
        assumed_by=iam.CompositePrincipal(
            iam.ServicePrincipal("lambda.amazonaws.com"),
            iam.ServicePrincipal("edgelambda.amazonaws.com"),
        ),
        inline_policies={
            f"{iam_role_name}-policy": iam.PolicyDocument(
                statements=[
                    iam.PolicyStatement(
                        actions=[
                            "logs:CreateLogGroup",
                            "logs:CreateLogStream",
                            "logs:PutLogEvents",
                        ],
                        resources=["arn:aws:logs:*:*:*"],
                    )
                ]
            )
        },
    )

    class AtTemplate(string.Template):
        delimiter = "@"

    work_dir = CDK_ROOT / "work" / name
    work_dir.mkdir(parents=True, exist_ok=True)
    code_path = work_dir / "index.js"
    template_path = CDK_ROOT / "resource-files" / "lambda-edge" / name / "index.js"
    template = AtTemplate(template_path.read_text())
    code_path.write_text(template.substitute(replaces or {}))

    resource = lambda_.Function(
        scope,
        f"lambda-function-edge-{name}",
        function_name=f"{config['prefix']}-{name}",
        runtime=runtime,
        handler="index.handler",
        code=lambda_.Code.from_asset(str(work_dir)),
        role=iam_role,
        current_version_options=lambda_.VersionOptions(
            removal_policy=RemovalPolicy.RETAIN
        ),
    )
    return resource.current_version


def create_cloudfront(
    scope: Stack,
    name: str,
    bucket: s3.Bucket,
    acm_result: Dict[str, Union[acm.Certificate, route53.IHostedZone, str]],
    lambda_edge_version_viewer_request: lambda_.Version,
) -> cloudfront.Distribution:
    def viewer_request_edge_lambdas() -> List[cloudfront.EdgeLambda]:
        return [
            cloudfront.EdgeLambda(
                function_version=lambda_edge_version_viewer_request,
                event_type=cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
            )
        ]

    html_cache_policy = cloudfront.CachePolicy(
        scope,
        f"custom-cache-policy-{name}",
        cache_policy_name=f"{config['prefix']}-{name}",
        default_ttl=Duration.minutes(5),
        max_ttl=Duration.days(30),
        min_ttl=Duration.seconds(0),
        query_string_behavior=cloudfront.CacheQueryStringBehavior.none(),
        header_behavior=cloudfront.CacheHeaderBehavior.none(),
        cookie_behavior=cloudfront.CacheCookieBehavior.none(),
        enable_accept_encoding_gzip=True,
        enable_accept_encoding_brotli=True,
    )
    deployed_logical_id = DEPLOYED_CLOUDFRONT_CACHE_POLICY_LOGICAL_IDS.get(name)
    if deployed_logical_id:
        html_cache_policy.node.default_child.override_logical_id(deployed_logical_id)

    behavior = cloudfront.BehaviorOptions(
        origin=cloudfront_origins.S3BucketOrigin.with_origin_access_control(bucket),
        viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cache_policy=html_cache_policy,
        response_headers_policy=cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        edge_lambdas=viewer_request_edge_lambdas(),
    )

    resource = cloudfront.Distribution(
        scope,
        f"cloudfront-distribution-{name}",
        certificate=acm_result["certificate"],
        domain_names=[acm_result["domain_name"]],
        default_behavior=behavior,
        default_root_object="index.html",
        error_responses=[
            cloudfront.ErrorResponse(
                http_status=403,
                response_http_status=200,
                response_page_path="/index.html",
                ttl=Duration.seconds(0),
            ),
            cloudfront.ErrorResponse(
                http_status=404,
                response_http_status=404,
                response_page_path="/404.html",
                ttl=Duration.seconds(0),
            ),
        ],
        additional_behaviors={
            "/assets/*": cloudfront.BehaviorOptions(
                origin=cloudfront_origins.S3BucketOrigin.with_origin_access_control(
                    bucket
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
                response_headers_policy=cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
                edge_lambdas=viewer_request_edge_lambdas(),
            ),
            "/img/*": cloudfront.BehaviorOptions(
                origin=cloudfront_origins.S3BucketOrigin.with_origin_access_control(
                    bucket
                ),
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cache_policy=cloudfront.CachePolicy.CACHING_OPTIMIZED,
                response_headers_policy=cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
                edge_lambdas=viewer_request_edge_lambdas(),
            ),
        },
    )

    route53.ARecord(
        scope,
        f"cloudfront-a-record-{name}",
        **_a_record_kwargs(acm_result),
        target=route53.RecordTarget.from_alias(
            route53_targets.CloudFrontTarget(resource)
        ),
    )
    return resource


def create_iam_role_github_actions(
    scope: Stack,
    policies: Optional[List[iam.PolicyStatement]] = None,
) -> iam.Role:
    owner = config["github"]["owner"]
    repo = config["github"]["repo"]
    account_id = config["aws"]["account_id"]

    return iam.Role(
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
                statements=policies or []
            )
        },
    )


def vite_env_output(value: dict) -> str:
    return json.dumps(value, ensure_ascii=False)
