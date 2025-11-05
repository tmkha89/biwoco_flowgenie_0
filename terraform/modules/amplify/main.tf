# Amplify App
resource "aws_amplify_app" "main" {
  name       = "${var.stage}-flowgenie-frontend"
}