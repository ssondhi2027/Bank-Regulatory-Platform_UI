output "api_base_url" {
  description = "Set this as VITE_API_BASE for the React app."
  value       = trimsuffix(aws_lambda_function_url.api.function_url, "/")
}

output "service_account_email" {
  value = google_service_account.api_reader.email
}

output "log_group" {
  value = aws_cloudwatch_log_group.api.name
}
