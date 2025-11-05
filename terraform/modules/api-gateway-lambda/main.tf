# Data sources
data "aws_caller_identity" "current" {}

# IAM Role for Lambda
resource "aws_iam_role" "lambda" {
  name = "${var.stage}-api-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-api-lambda-role"
    }
  )
}

# IAM Policy for Lambda VPC access
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# IAM Policy for Lambda basic execution
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.stage}-flowgenie-func"
  retention_in_days = var.stage == "prod" ? 30 : 7

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-api-logs"
    }
  )
}

# Lambda Function (Container Image)
resource "aws_lambda_function" "api" {
  function_name = "${var.stage}-flowgenie-func"
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size

  # ECR Image URI (will be updated by CI/CD pipeline)
  # Use a placeholder image initially, or provide the actual ECR image URI
  image_uri = var.lambda_image_uri != "" ? var.lambda_image_uri : "228863541674.dkr.ecr.ap-southeast-1.amazonaws.com/dev-flowgenie-worker:bd7bc9de8d572f3d2b6a4b70eefc434fb84add27"

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.security_group_ids
  }

  environment {
    variables = merge(
      {
        STAGE            = var.stage
        NODE_ENV         = var.stage == "prod" ? "production" : var.stage
        DATABASE_URL     = "postgresql://${var.db_username}:${var.db_password}@${var.rds_endpoint}:5432/${var.db_name}"
        REDIS_URL        = var.redis_endpoint != "" ? "redis://${var.redis_endpoint}:6379" : ""
        REDIS_AUTH_TOKEN = var.redis_auth_token != "" ? var.redis_auth_token : ""
      },
      var.environment_variables
    )
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_vpc,
    aws_cloudwatch_log_group.lambda
  ]

  # Ignore image_uri changes - CI/CD pipeline manages image updates
  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-func"
    }
  )
}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "main" {
  name        = "${var.stage}-flowgenie-api"
  description = "FlowGenie API Gateway for ${var.stage}"

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-api"
    }
  )
}

# IAM Role for API Gateway CloudWatch Logs
resource "aws_iam_role" "apigateway_cloudwatch_role" {
  name = "${var.stage}-apigateway-cloudwatch-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-apigateway-cloudwatch-role"
    }
  )
}

resource "aws_iam_role_policy_attachment" "apigateway_cloudwatch_policy" {
  role       = aws_iam_role.apigateway_cloudwatch_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

# API Gateway Account Settings (enables CloudWatch logging)
resource "aws_api_gateway_account" "main" {
  cloudwatch_role_arn = aws_iam_role.apigateway_cloudwatch_role.arn
}

# CloudWatch Log Group for API Gateway Access Logs
resource "aws_cloudwatch_log_group" "api_gateway_access" {
  name              = "/aws/apigateway/${var.stage}-flowgenie-api/access"
  retention_in_days = var.stage == "prod" ? 30 : 7

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-api-gateway-access-logs"
    }
  )
}

# CloudWatch Log Group for API Gateway Execution Logs
resource "aws_cloudwatch_log_group" "api_gateway_execution" {
  name              = "/aws/apigateway/${var.stage}-flowgenie-api/execution"
  retention_in_days = var.stage == "prod" ? 30 : 7

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-api-gateway-execution-logs"
    }
  )
}

# API Gateway Resource (proxy)
resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "{proxy+}"
}

# API Gateway Method
resource "aws_api_gateway_method" "proxy" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

# API Gateway Integration
resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.proxy.id
  http_method = aws_api_gateway_method.proxy.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# API Gateway Method for root
resource "aws_api_gateway_method" "proxy_root" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_rest_api.main.root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
}

# API Gateway Integration for root
resource "aws_api_gateway_integration" "lambda_root" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_rest_api.main.root_resource_id
  http_method = aws_api_gateway_method.proxy_root.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.api.invoke_arn
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "main" {
  depends_on = [
    aws_api_gateway_integration.lambda,
    aws_api_gateway_integration.lambda_root
  ]

  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = var.stage

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway Stage
resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.stage

  # Access Logging Configuration
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_access.arn
    format          = "{\"requestId\":\"$context.requestId\",\"ip\":\"$context.identity.sourceIp\",\"caller\":\"$context.identity.caller\",\"user\":\"$context.identity.user\",\"requestTime\":\"$context.requestTime\",\"httpMethod\":\"$context.httpMethod\",\"resourcePath\":\"$context.resourcePath\",\"status\":$context.status,\"protocol\":\"$context.protocol\",\"responseLength\":$context.responseLength,\"error\":{\"message\":\"$context.error.message\",\"messageString\":\"$context.error.messageString\"},\"integration\":{\"error\":\"$context.integrationErrorMessage\",\"latency\":\"$context.integration.latency\",\"status\":\"$context.integration.status\"},\"requestTimeEpoch\":$context.requestTimeEpoch,\"responseLatency\":$context.responseLatency}"
  }

  # Execution Logging Configuration
  xray_tracing_enabled = var.enable_xray_tracing

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-api-stage"
    }
  )

  depends_on = [
    aws_api_gateway_account.main,
    aws_cloudwatch_log_group.api_gateway_access,
    aws_cloudwatch_log_group.api_gateway_execution
  ]
}

# API Gateway Method Settings (for execution logging)
resource "aws_api_gateway_method_settings" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  method_path = "*/*"

  settings {
    # Enable execution logging
    logging_level = var.api_gateway_logging_level

    # Enable detailed CloudWatch metrics
    metrics_enabled = true

    # Enable data trace (logs request/response bodies)
    data_trace_enabled = var.stage == "prod" ? false : true

    # Throttling settings
    throttling_burst_limit = var.api_gateway_throttling_burst_limit
    throttling_rate_limit  = var.api_gateway_throttling_rate_limit
  }

  depends_on = [
    aws_api_gateway_account.main,
    aws_cloudwatch_log_group.api_gateway_execution
  ]
}

