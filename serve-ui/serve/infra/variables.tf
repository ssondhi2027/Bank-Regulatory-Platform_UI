variable "gcp_project_id" {
  description = "GCP project holding the BigQuery marts and running the API."
  type        = string
}

variable "gcp_region" {
  description = "Cloud Run region. Defaults to where the BigQuery marts live, keeping data in Canada and minimizing latency."
  type        = string
  default     = "northamerica-northeast1"
}

variable "bq_location" {
  description = "BigQuery dataset location."
  type        = string
  default     = "northamerica-northeast1"
}

variable "bq_datasets" {
  description = "Mart dataset names, keyed by layer."
  type        = map(string)
  default = {
    core     = "core"
    finance  = "finance"
    controls = "controls"
  }
}

variable "control_run_ts_column" {
  description = "Timestamp column on fct_control_results used to pick the latest run."
  type        = string
  default     = "logged_at"
}

variable "cors_allow_origin" {
  description = "Origin allowed to call the API. Set this to the deployed site, not '*'."
  type        = string
  default     = "*"
}

variable "api_key" {
  description = <<-EOT
    Shared secret required in the x-api-key header. It ships inside the public
    Netlify build (as VITE_API_KEY), so it is not real access control — it only
    filters out bots and scrapers that hit the API directly without loading
    the site. Leave blank to disable the check entirely.
  EOT
  type        = string
  default     = ""
  sensitive   = true
}

variable "name_prefix" {
  type    = string
  default = "brp"
}

variable "github_repo" {
  description = "GitHub \"owner/name\" allowed to deploy via Workload Identity Federation. Leave blank to skip creating the CI identity entirely."
  type        = string
  default     = ""
}
