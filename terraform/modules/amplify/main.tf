# Amplify App
resource "aws_amplify_app" "main" {
  name       = "${var.stage}-flowgenie-frontend"
  repository = var.repository_url

  # OAuth token for GitHub connection (if provided)
  oauth_token = var.devops_token != "" ? var.devops_token : null

  # Build specification for Vite/React app
  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - cd frontend
            - npm ci
        build:
          commands:
            - npm run build
      artifacts:
        baseDirectory: frontend/dist
        files:
          - '**/*'
      cache:
        paths:
          - frontend/node_modules/**/*
  EOT

  # Environment variables
  dynamic "environment_variables" {
    for_each = var.environment_variables
    content {
      name  = environment_variables.key
      value = environment_variables.value
    }
  }

  # Enable auto branch creation
  enable_auto_branch_creation = false
  enable_branch_auto_build    = true
  enable_branch_auto_deletion = false

  # IAM service role (will be created separately if needed)
  iam_service_role_arn = aws_iam_role.amplify.arn

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-frontend"
    }
  )
}

# IAM Role for Amplify
resource "aws_iam_role" "amplify" {
  name = "${var.stage}-amplify-service-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "amplify.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-amplify-service-role"
    }
  )
}

# IAM Policy for Amplify
resource "aws_iam_role_policy_attachment" "amplify" {
  role       = aws_iam_role.amplify.name
  policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess-Amplify"
}

# Amplify Branch (main)
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.main.id
  branch_name = var.branch_name

  # Enable auto build
  enable_auto_build = true

  # Environment variables for the branch
  dynamic "environment_variables" {
    for_each = var.environment_variables
    content {
      name  = environment_variables.key
      value = environment_variables.value
    }
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-amplify-${var.branch_name}"
    }
  )
}

# Amplify Domain (optional)
resource "aws_amplify_domain_association" "main" {
  count       = var.domain_name != "" ? 1 : 0
  app_id      = aws_amplify_app.main.id
  domain_name = var.domain_name

  # Subdomain configuration
  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = var.stage == "prod" ? "" : var.stage
  }

  # Wait for domain verification
  wait_for_verification = true
}
