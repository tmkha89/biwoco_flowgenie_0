variable "stage" {
  description = "Deployment stage (dev/staging/prod)"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "flowgenie"
}

# Database Variables
variable "db_name" {
  description = "RDS database name"
  type        = string
  default     = ""
  sensitive   = true
}

variable "db_username" {
  description = "RDS database master username"
  type        = string
  default     = ""
  sensitive   = true
}

variable "db_password" {
  description = "RDS database master password"
  type        = string
  sensitive   = true
}

# Amplify Variables
variable "amplify_repository_url" {
  description = "GitHub repository URL for Amplify app"
  type        = string
  default     = ""
}

variable "amplify_branch_name" {
  description = "Branch name for Amplify app"
  type        = string
  default     = "main"
}

# Environment Variables
variable "backend_environment_variables" {
  description = "Environment variables for backend Lambda/ECS"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "frontend_environment_variables" {
  description = "Environment variables for frontend Amplify app"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "devops_token" {
  description = "Github access token"
  type        = string
  default     = "main"
}
