# Amplify App
resource "aws_amplify_app" "main" {
  name         = "${var.stage}-flowgenie-frontend"
  repository   = var.repository_url
  access_token = "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"

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

  environment_variables = merge(
    {
      AMPLIFY_DIFF_DEPLOY       = "false"
      AMPLIFY_MONOREPO_APP_ROOT = "frontend"
    },
    var.environment_variables
  )

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

  enable_auto_build           = true
  enable_pull_request_preview = var.stage != "prod"

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-frontend-branch"
    }
  )
}

# Amplify Domain (optional - can be configured separately)
# resource "aws_amplify_domain_association" "main" {
#   app_id      = aws_amplify_app.main.id
#   domain_name = var.domain_name
#
#   sub_domain {
#     branch = aws_amplify_branch.main.branch_name
#     prefix = var.stage
#   }
# }

