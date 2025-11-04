output "security_group_id" {
  description = "Security group ID"
  value       = aws_security_group.main.id
}

output "security_group_arn" {
  description = "Security group ARN"
  value       = aws_security_group.main.arn
}

