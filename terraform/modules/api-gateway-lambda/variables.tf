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
  description = "Subnet IDs for Lambda"
  type        = list(string)
}

variable "security_group_ids" {
  description = "Security group IDs for Lambda"
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

variable "lambda_image_uri" {
  description = "ECR image URI for Lambda container image. If not provided, will use a placeholder based on stage and region. CI/CD pipeline manages actual image updates."
  type        = string
  default     = ""
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds. For VPC-configured Lambdas, use at least 60-90 seconds to account for cold starts and ENI attachment delays. Maximum is 900 seconds (15 minutes)."
  type        = number
  default     = 300
}

variable "lambda_memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 512
}

variable "environment_variables" {
  description = "Additional environment variables for Lambda"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

variable "api_gateway_logging_level" {
  description = "Logging level for API Gateway execution logs. Options: OFF, ERROR, INFO"
  type        = string
  default     = "INFO"
  validation {
    condition     = contains(["OFF", "ERROR", "INFO"], var.api_gateway_logging_level)
    error_message = "api_gateway_logging_level must be one of: OFF, ERROR, INFO"
  }
}

variable "enable_xray_tracing" {
  description = "Enable X-Ray tracing for API Gateway"
  type        = bool
  default     = false
}

variable "api_gateway_throttling_burst_limit" {
  description = "Throttling burst limit for API Gateway"
  type        = number
  default     = 5000
}

variable "api_gateway_throttling_rate_limit" {
  description = "Throttling rate limit for API Gateway (requests per second)"
  type        = number
  default     = 10000
}

