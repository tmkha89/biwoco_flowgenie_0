# Amplify App
resource "aws_amplify_app" "main" {
  name       = "${var.stage}-flowgenie-frontend"
  repository = var.repository_url
  
  # Environment variables - use map attribute, not dynamic block
  environment_variables = var.environment_variables

  # Build specification
  build_spec = <<-EOF
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - cd frontend
            - npm ci
        build:
          commands:
            - cd frontend
            - npm run build
      artifacts:
        baseDirectory: frontend/dist
        files:
          - '**/*'
      cache:
        paths:
          - frontend/node_modules/**/*
  EOF

  # Enable auto branch creation
  enable_auto_branch_creation = false

  # Enable branch auto builds
  enable_branch_auto_build = true

  # Enable branch auto deletion
  enable_branch_auto_deletion = false

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-frontend"
    }
  )
}

# Amplify Branch
resource "aws_amplify_branch" "main" {
  app_id      = aws_amplify_app.main.id
  branch_name = var.branch_name

  # Enable auto build
  enable_auto_build = true

  # Enable pull request previews
  enable_pull_request_preview = true

  # Framework
  framework = "React"

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-frontend-${var.branch_name}"
    }
  )
}

# Custom Domain (optional)
resource "aws_amplify_domain_association" "main" {
  count = var.domain_name != "" ? 1 : 0

  app_id      = aws_amplify_app.main.id
  domain_name = var.domain_name

  # Wait for domain verification (can be done manually in console)
  wait_for_verification = false

  # Subdomain configuration
  sub_domain {
    branch_name = aws_amplify_branch.main.branch_name
    prefix      = var.stage == "prod" ? "" : var.stage
  }
}
