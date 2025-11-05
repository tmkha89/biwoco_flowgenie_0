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
        configuration_source = "REPOSITORY"
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

  # Environment variables are set via apprunner.yaml or can be updated via API
  # For now, we'll use the apprunner.yaml file in the repository

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

