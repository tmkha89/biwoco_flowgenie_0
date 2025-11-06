# Amplify App
# 
# NOTE: If you encounter "Rate exceeded while calling CreateApp" error:
# - This is an AWS API rate limit (typically 5-10 requests per minute)
# - Wait 1-2 minutes and retry the Terraform apply
# - Or use: terraform apply -target=module.amplify.aws_amplify_app.main
# - The rate limit resets after a few minutes
#
resource "aws_amplify_app" "main" {
  name       = "${var.stage}-flowgenie-frontend"
  repository = var.repository_url
  
  # Token for GitHub repository access (required for GitHub authentication)
  # Amplify requires either oauth_token or access_token to connect to GitHub
  oauth_token = var.devops_token
  
  # Environment variables - use map attribute, not dynamic block
  environment_variables = var.environment_variables

  # Lifecycle rule to ignore repository changes if app already exists
  # This prevents errors when manually deployed branches exist
  lifecycle {
    ignore_changes = [
      repository,
      oauth_token,
    ]
  }

  # Build specification
  build_spec = <<-EOF
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - echo "Current directory: $(pwd)"
            - echo "Node.js version: $(node --version)"
            - echo "npm version: $(npm --version)"
            - echo "Listing root directory:"
            - ls -la
            - echo "Changing to frontend directory..."
            - cd frontend
            - echo "Current directory after cd: $(pwd)"
            - echo "Installing dependencies..."
            - npm ci
            - echo "Dependencies installed successfully"
        build:
          commands:
            - echo "Building frontend application..."
            - cd frontend
            - npm run build
            - echo "Verifying build output..."
            - ls -la dist/ || echo "ERROR: dist directory not found"
            - echo "Checking for _redirects file..."
            - |
              if [ -f public/_redirects ]; then
                echo "✅ Found _redirects in public/, copying to dist/..."
                cp public/_redirects dist/_redirects
                echo "✅ _redirects file copied to dist"
              else
                echo "⚠️ _redirects not found in public/, creating in dist/..."
                echo "/*    /index.html   200" > dist/_redirects
                echo "✅ Created _redirects file"
              fi
            - echo "Verifying _redirects file in dist:"
            - ls -la dist/_redirects && cat dist/_redirects || echo "ERROR: _redirects file not found in dist"
            - echo "✅ Build completed successfully"
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
