variable "stage" {
  description = "Deployment stage"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "repository_url" {
  description = "GitHub repository URL for Amplify app"
  type        = string
}

variable "branch_name" {
  description = "Branch name for Amplify app"
  type        = string
  default     = "main"
}

variable "domain_name" {
  description = "Custom domain name for Amplify app (optional)"
  type        = string
  default     = ""
}

variable "environment_variables" {
  description = "Environment variables for Amplify app"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

