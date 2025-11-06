output "service_id" {
  description = "App Runner service ID"
  value       = aws_apprunner_service.backend.id
}

output "service_arn" {
  description = "App Runner service ARN"
  value       = aws_apprunner_service.backend.arn
}

output "service_url" {
  description = "App Runner service URL"
  value       = aws_apprunner_service.backend.service_url
}

output "service_name" {
  description = "App Runner service name"
  value       = aws_apprunner_service.backend.service_name
}

output "vpc_connector_arn" {
  description = "VPC Connector ARN (either existing or newly created)"
  value       = local.vpc_connector_arn
}

output "vpc_connector_id" {
  description = "VPC Connector ID (only if connector was created)"
  value       = var.existing_vpc_connector_arn == "" ? aws_apprunner_vpc_connector.main[0].id : ""
}

output "ecr_repository_url" {
  description = "ECR Repository URL"
  value       = local.ecr_repository_url
}

output "ecr_repository_arn" {
  description = "ECR Repository ARN"
  value       = var.use_existing_ecr ? data.aws_ecr_repository.existing[0].arn : aws_ecr_repository.backend[0].arn
}

