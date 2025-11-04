# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.stage}-redis-subnet-group"
  subnet_ids = var.subnet_ids

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-redis-subnet-group"
    }
  )
}

# Security Group for ElastiCache
resource "aws_security_group" "redis" {
  name        = "${var.stage}-redis-sg"
  description = "Security group for ElastiCache Redis"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from VPC"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
    cidr_blocks     = length(var.allowed_security_group_ids) > 0 ? [] : var.allowed_cidr_blocks
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-redis-sg"
    }
  )
}

# ElastiCache Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  family = "redis7"
  name   = "${var.stage}-redis-params"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-redis-params"
    }
  )
}

# ElastiCache Replication Group (Redis Cluster Mode Disabled)
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.stage}-flowgenie-redis"
  description          = "Redis cluster for FlowGenie ${var.stage}"

  engine             = "redis"
  engine_version     = "7.0"
  node_type          = var.node_type
  num_cache_clusters = var.num_cache_nodes
  port               = 6379

  parameter_group_name = aws_elasticache_parameter_group.main.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.auth_token_enabled ? random_password.redis_auth_token[0].result : null

  automatic_failover_enabled = var.stage == "prod"
  multi_az_enabled           = var.stage == "prod"

  snapshot_retention_limit = var.stage == "prod" ? 5 : 0
  snapshot_window          = var.stage == "prod" ? "03:00-05:00" : null

  maintenance_window = "sun:05:00-sun:06:00"

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-redis"
    }
  )
}

# Generate auth token if enabled
resource "random_password" "redis_auth_token" {
  count   = var.auth_token_enabled ? 1 : 0
  length  = 32
  special = true
}

