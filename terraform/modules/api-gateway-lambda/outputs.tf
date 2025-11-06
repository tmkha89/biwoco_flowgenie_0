output "api_url" {
  description = "API Gateway endpoint URL"
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${var.aws_region}.amazonaws.com/${var.stage}"
}

output "api_arn" {
  description = "API Gateway ARN"
  value       = aws_api_gateway_rest_api.main.arn
}

output "rest_api_id" {
  description = "API Gateway REST API ID"
  value       = aws_api_gateway_rest_api.main.id
}

output "lambda_function_arn" {
  description = "Lambda function ARN"
  value       = aws_lambda_function.api.arn
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.api.function_name
}

output "api_gateway_access_log_group" {
  description = "CloudWatch log group name for API Gateway access logs"
  value       = aws_cloudwatch_log_group.api_gateway_access.name
}

output "api_gateway_execution_log_group" {
  description = "CloudWatch log group name for API Gateway execution logs"
  value       = aws_cloudwatch_log_group.api_gateway_execution.name
}

output "api_gateway_access_log_group_arn" {
  description = "CloudWatch log group ARN for API Gateway access logs"
  value       = aws_cloudwatch_log_group.api_gateway_access.arn
}

output "api_gateway_execution_log_group_arn" {
  description = "CloudWatch log group ARN for API Gateway execution logs"
  value       = aws_cloudwatch_log_group.api_gateway_execution.arn
}

