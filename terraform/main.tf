terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # S3 backend configuration is provided via -backend-config flags
    # bucket, key, and region are set in GitHub Actions workflow
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "FlowGenie"
      Stage       = var.stage
      ManagedBy   = "Terraform"
      Environment = var.stage
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  stage      = var.stage
  aws_region = var.aws_region

  tags = {
    Name = "${var.project_name}-${var.stage}-vpc"
  }
}

# Security Group for Lambda/API Gateway backend (needed before RDS)
module "backend_security_group" {
  source = "./modules/security-group"

  name        = "${var.project_name}-${var.stage}-backend"
  description = "Security group for backend Lambda functions"
  vpc_id      = module.vpc.vpc_id

  ingress_rules = [
    {
      description = "HTTPS from API Gateway"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = ["0.0.0.0/0"]
    }
  ]

  egress_rules = [
    {
      description = "All outbound traffic"
      from_port   = 0
      to_port     = 0
      protocol    = "-1"
      cidr_blocks = ["0.0.0.0/0"]
    }
  ]

  tags = {
    Name = "${var.project_name}-${var.stage}-backend-sg"
  }
}

# RDS Module
module "rds" {
  source = "./modules/rds"

  stage      = var.stage
  aws_region = var.aws_region
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids

  db_name     = var.db_name
  db_username = var.db_username
  db_password = var.db_password

  allowed_security_group_ids = [module.backend_security_group.security_group_id]

  tags = {
    Name = "${var.project_name}-${var.stage}-rds"
  }
}

# ElastiCache Module
module "elasticache" {
  source = "./modules/elasticache"

  stage      = var.stage
  aws_region = var.aws_region
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids

  allowed_security_group_ids = [module.backend_security_group.security_group_id]

  tags = {
    Name = "${var.project_name}-${var.stage}-redis"
  }
}

# Lambda + API Gateway Module
module "api" {
  source = "./modules/api-gateway-lambda"

  stage      = var.stage
  aws_region = var.aws_region

  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [module.backend_security_group.security_group_id]
  rds_endpoint       = module.rds.address
  redis_endpoint     = module.elasticache.endpoint
  redis_auth_token   = module.elasticache.auth_token
  db_name            = var.db_name
  db_username        = var.db_username
  db_password        = var.db_password

  environment_variables = var.backend_environment_variables

  tags = {
    Name = "${var.project_name}-${var.stage}-api"
  }
}

# ECS Module for Worker Service
module "ecs_worker" {
  source = "./modules/ecs-worker"

  stage      = var.stage
  aws_region = var.aws_region

  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [module.backend_security_group.security_group_id]

  rds_endpoint     = module.rds.address
  redis_endpoint   = module.elasticache.endpoint
  redis_auth_token = module.elasticache.auth_token
  db_name          = var.db_name
  db_username      = var.db_username
  db_password      = var.db_password

  environment_variables = var.backend_environment_variables

  tags = {
    Name = "${var.project_name}-${var.stage}-worker"
  }
}

# Amplify Module
module "amplify" {
  source = "./modules/amplify"

  stage      = var.stage
  aws_region = var.aws_region

  repository_url = var.amplify_repository_url
  branch_name    = var.amplify_branch_name

  environment_variables = var.frontend_environment_variables

  tags = {
    Name = "${var.project_name}-${var.stage}-amplify"
  }
}

