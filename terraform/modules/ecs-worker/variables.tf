variable "stage" {
  description = "Deployment stage"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for ECS"
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security group IDs for ECS"
  type        = list(string)
}

variable "rds_endpoint" {
  description = "RDS endpoint"
  type        = string
}

variable "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  type        = string
  default     = ""
}

variable "redis_auth_token" {
  description = "ElastiCache Redis auth token"
  type        = string
  default     = ""
  sensitive   = true
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "flowgenie_db"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "flowgenie_admin"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "task_cpu" {
  description = "ECS task CPU units (256 = 0.25 vCPU)"
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "ECS task memory in MB"
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}

variable "environment_variables" {
  description = "Additional environment variables for ECS task"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "use_fargate_spot" {
  description = "Use Fargate Spot for cost savings (optional)"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

