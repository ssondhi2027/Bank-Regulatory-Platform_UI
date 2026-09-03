output "api_base_url" {
  description = "Set this as VITE_API_BASE for the React app."
  value       = google_cloud_run_v2_service.api.uri
}

output "service_account_email" {
  description = "Pass this to `gcloud run deploy --service-account` when shipping code."
  value       = google_service_account.api_reader.email
}

output "github_wif_provider" {
  description = "Set as the GCP_WIF_PROVIDER GitHub Actions secret. Empty unless github_repo is set."
  value       = var.github_repo == "" ? null : google_iam_workload_identity_pool_provider.github[0].name
}

output "github_ci_service_account" {
  description = "Set as the GCP_CI_SERVICE_ACCOUNT GitHub Actions secret. Empty unless github_repo is set."
  value       = var.github_repo == "" ? null : google_service_account.ci_deployer[0].email
}
