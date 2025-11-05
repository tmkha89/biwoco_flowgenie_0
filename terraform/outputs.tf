# Amplify Outputs
output "amplify_app_id" {
  description = "Amplify App ID"
  value       = module.amplify.app_id
}

# API Gateway Outputs (DISABLED - using App Runner instead)
# output "api_gateway_url" {
#   description = "API Gateway endpoint URL"
#   value       = module.api.api_url
# }
#
# output "api_gateway_arn" {
#   description = "API Gateway ARN"
#   value       = module.api.api_arn
# }
#
# output "api_gateway_rest_api_id" {
#   description = "API Gateway REST API ID"
#   value       = module.api.rest_api_id
# }

# App Runner Outputs
output "app_runner_service_url" {
  description = "App Runner service URL"
  value       = module.app_runner.service_url
}

output "app_runner_service_arn" {
  description = "App Runner service ARN"
  value       = module.app_runner.service_arn
}

output "app_runner_service_id" {
  description = "App Runner service ID"
  value       = module.app_runner.service_id
}

output "app_runner_ecr_repository_url" {
  description = "App Runner ECR Repository URL"
  value       = module.app_runner.ecr_repository_url
}

output "app_runner_vpc_connector_arn" {
  description = "App Runner VPC Connector ARN"
  value       = module.app_runner.vpc_connector_arn
}

# RDS Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.endpoint
}

output "rds_arn" {
  description = "RDS instance ARN"
  value       = module.rds.arn
}

output "rds_database_url" {
  description = "RDS database connection URL"
  value       = module.rds.database_url
  sensitive   = true
}

# ElastiCache Outputs
output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.elasticache.endpoint
}

output "redis_arn" {
  description = "ElastiCache Redis ARN"
  value       = module.elasticache.arn
}

output "redis_url" {
  description = "ElastiCache Redis connection URL"
  value       = module.elasticache.redis_url
  sensitive   = true
}

# ECS Outputs
output "ecs_cluster_arn" {
  description = "ECS Cluster ARN"
  value       = module.ecs_worker.cluster_arn
}

output "ecs_cluster_name" {
  description = "ECS Cluster Name"
  value       = module.ecs_worker.cluster_name
}

output "ecs_service_arn" {
  description = "ECS Service ARN"
  value       = module.ecs_worker.service_arn
}

output "ecs_service_name" {
  description = "ECS Service Name"
  value       = module.ecs_worker.service_name
}

# VPC Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnet_ids
}

