# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.stage}-flowgenie-worker"

  setting {
    name  = "containerInsights"
    value = var.stage == "prod" ? "enabled" : "disabled"
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-worker-cluster"
    }
  )
}

# CloudWatch Log Group for ECS
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.stage}-flowgenie-worker"
  retention_in_days = var.stage == "prod" ? 30 : 7

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-worker-logs"
    }
  )
}

# IAM Role for ECS Task Execution
resource "aws_iam_role" "ecs_execution" {
  name = "${var.stage}-ecs-worker-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-ecs-worker-execution-role"
    }
  )
}

# IAM Policy for ECS Task Execution
resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# IAM Role for ECS Task
resource "aws_iam_role" "ecs_task" {
  name = "${var.stage}-ecs-worker-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-ecs-worker-task-role"
    }
  )
}

# ECR Repository (if needed)
resource "aws_ecr_repository" "worker" {
  name                 = "${var.stage}-flowgenie-worker"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-worker-ecr"
    }
  )
}

# ECS Task Definition
resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.stage}-flowgenie-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.task_cpu
  memory                   = var.task_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = "${aws_ecr_repository.worker.repository_url}:latest"
      essential = true

      environment = [
        for key, value in merge(
          {
            STAGE            = var.stage
            NODE_ENV         = var.stage == "prod" ? "production" : var.stage
            DATABASE_URL     = "postgresql://${var.db_username}:${var.db_password}@${var.rds_endpoint}:5432/${var.db_name}"
            REDIS_URL        = var.redis_endpoint != "" ? "redis://${var.redis_endpoint}:6379" : ""
            REDIS_AUTH_TOKEN = var.redis_auth_token != "" ? var.redis_auth_token : ""
          },
          var.environment_variables
          ) : {
          name  = key
          value = value
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-worker-task"
    }
  )
}

# ECS Service
resource "aws_ecs_service" "worker" {
  name            = "${var.stage}-flowgenie-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = var.security_group_ids
    assign_public_ip = false
  }

  tags = merge(
    var.tags,
    {
      Name = "${var.stage}-flowgenie-worker-service"
    }
  )
}

