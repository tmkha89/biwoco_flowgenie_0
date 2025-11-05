# Amplify App
resource "aws_amplify_app" "main" {
  name         = "${var.stage}-flowgenie-frontend"
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

