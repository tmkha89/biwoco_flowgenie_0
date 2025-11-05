output "app_id" {
  description = "Amplify App ID"
  value       = aws_amplify_app.main.id
}

output "app_arn" {
  description = "Amplify App ARN"
  value       = aws_amplify_app.main.arn
}

output "app_url" {
  description = "Amplify App URL"
  value       = "https://${aws_amplify_branch.main.branch_name}.${aws_amplify_app.main.id}.amplifyapp.com"
}

output "branch_arn" {
  description = "Amplify Branch ARN"
  value       = aws_amplify_branch.main.arn
}

output "domain_association_arn" {
  description = "Amplify Domain Association ARN"
  value       = var.domain_name != "" ? aws_amplify_domain_association.main[0].arn : null
}

output "domain_url" {
  description = "Amplify Domain URL"
  value       = var.domain_name != "" ? "https://${var.stage == "prod" ? var.domain_name : "${var.stage}.${var.domain_name}"}" : null
}

output "iam_service_role_arn" {
  description = "Amplify IAM Service Role ARN"
  value       = aws_iam_role.amplify.arn
}
