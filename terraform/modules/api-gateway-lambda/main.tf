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
  name              = "/aws/lambda/${var.stage}-flowgenie-api"
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
  function_name = "${var.stage}-flowgenie-api"
  role          = aws_iam_role.lambda.arn
  package_type  = "Image"
  timeout       = var.lambda_timeout
  memory_size   = var.lambda_memory_size

  # ECR Image URI (will be updated by CI/CD pipeline)
  # Use a placeholder image initially, or provide the actual ECR image URI
  image_uri = var.lambda_image_uri != "" ? var.lambda_image_uri : "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com/${var.stage}-flowgenie-api:latest"

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
      Name = "${var.stage}-flowgenie-api"
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

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-api-stage"
    }
  )
}

