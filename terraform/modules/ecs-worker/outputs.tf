output "cluster_arn" {
  description = "ECS Cluster ARN"
  value       = aws_ecs_cluster.main.arn
}

output "cluster_name" {
  description = "ECS Cluster Name"
  value       = aws_ecs_cluster.main.name
}

output "service_arn" {
  description = "ECS Service ARN"
  value       = aws_ecs_service.worker.id
}

output "service_name" {
  description = "ECS Service Name"
  value       = aws_ecs_service.worker.name
}

output "ecr_repository_url" {
  description = "ECR Repository URL"
  value       = aws_ecr_repository.worker.repository_url
}

output "task_definition_arn" {
  description = "ECS Task Definition ARN"
  value       = aws_ecs_task_definition.worker.arn
}

