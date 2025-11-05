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
  description = "VPC Connector ARN"
  value       = aws_apprunner_vpc_connector.main.arn
}

output "vpc_connector_id" {
  description = "VPC Connector ID"
  value       = aws_apprunner_vpc_connector.main.id
}

output "github_connection_arn" {
  description = "GitHub Connection ARN"
  value       = aws_apprunner_connection.github.arn
}

output "github_connection_name" {
  description = "GitHub Connection Name"
  value       = aws_apprunner_connection.github.connection_name
}

