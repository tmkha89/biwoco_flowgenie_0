# GitHub Connection for App Runner
resource "aws_apprunner_connection" "github" {
  connection_name = "${var.stage}-flowgenie-github-connection"
  provider_type   = "GITHUB"

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-github-connection"
    }
  )
}

# App Runner Service
resource "aws_apprunner_service" "backend" {
  service_name = "${var.stage}-flowgenie-apprunner-backend"

  source_configuration {
    auto_deployments_enabled = var.auto_deploy_enabled

    code_repository {
      repository_url = var.github_repository_url
      source_code_version {
        type  = "BRANCH"
        value = var.github_branch
      }
      code_configuration {
        configuration_source = "API"
        code_configuration_values {
          build_command = "docker build -t apprunner-image -f backend/Dockerfile backend/"
          runtime       = "DOCKER"
          runtime_environment_variables = merge(
            {
              PORT             = tostring(var.container_port)
              NODE_ENV         = var.stage == "prod" ? "production" : var.stage
              STAGE            = var.stage
              DATABASE_URL     = "postgresql://${var.db_username}:${var.db_password}@${var.rds_endpoint}:5432/${var.db_name}"
              REDIS_URL        = var.redis_endpoint != "" ? "redis://${var.redis_endpoint}:6379" : ""
              REDIS_AUTH_TOKEN = var.redis_auth_token != "" ? var.redis_auth_token : ""
            },
            var.environment_variables
          )
          start_command               = ""
          runtime_environment_secrets = {}
        }
      }
    }

    authentication_configuration {
      connection_arn = aws_apprunner_connection.github.arn
    }
  }

  depends_on = [
    aws_apprunner_connection.github,
    aws_apprunner_vpc_connector.main
  ]

  instance_configuration {
    cpu               = var.cpu
    memory            = var.memory
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  network_configuration {
    ingress_configuration {
      is_publicly_accessible = true
    }
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.main.arn
    }
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-backend"
    }
  )
}

# VPC Connector for App Runner (allows access to RDS and Redis)
resource "aws_apprunner_vpc_connector" "main" {
  vpc_connector_name = "${var.stage}-flowgenie-vpc-connector"
  subnets            = var.subnet_ids
  security_groups    = var.security_group_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-vpc-connector"
    }
  )
}


# IAM Role for App Runner instances
resource "aws_iam_role" "apprunner_instance" {
  name = "${var.stage}-apprunner-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "tasks.apprunner.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-apprunner-instance-role"
    }
  )
}

# CloudWatch Log Group for App Runner
resource "aws_cloudwatch_log_group" "apprunner" {
  name              = "/aws/apprunner/${var.stage}-flowgenie-apprunner-backend"
  retention_in_days = var.stage == "prod" ? 30 : 7

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-apprunner-logs"
    }
  )
}

