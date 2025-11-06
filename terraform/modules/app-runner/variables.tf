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
  description = "Subnet IDs for VPC connector (private subnets)"
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security group IDs for VPC connector"
  type        = list(string)
}

variable "existing_vpc_connector_arn" {
  description = "ARN of existing VPC connector to reuse (optional). If provided, will not create a new VPC connector."
  type        = string
  default     = ""
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

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 3000
}

variable "cpu" {
  description = "CPU units for App Runner (0.25 vCPU = 256, 0.5 vCPU = 512, 1 vCPU = 1024, 2 vCPU = 2048, 4 vCPU = 4096)"
  type        = string
  default     = "1 vCPU"
}

variable "memory" {
  description = "Memory for App Runner (0.5 GB = 512, 1 GB = 1024, 2 GB = 2048, 3 GB = 3072, 4 GB = 4096)"
  type        = string
  default     = "2 GB"
}

variable "auto_deploy_enabled" {
  description = "Enable automatic deployment when new images are pushed to ECR"
  type        = bool
  default     = true
}

variable "use_existing_ecr" {
  description = "Use an existing ECR repository instead of creating a new one"
  type        = bool
  default     = false
}

variable "existing_ecr_repository_name" {
  description = "Name of existing ECR repository to use (required if use_existing_ecr is true)"
  type        = string
  default     = ""
}

variable "service_name" {
  description = "App Runner service name (optional, defaults to {stage}-flowgenie-apprunner-backend)"
  type        = string
  default     = ""
}


variable "environment_variables" {
  description = "Additional environment variables for App Runner"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

