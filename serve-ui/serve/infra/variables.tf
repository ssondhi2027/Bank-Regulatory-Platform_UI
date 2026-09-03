variable "aws_region" {
  description = "AWS region for the Lambda. ca-central-1 keeps Canadian filing data in Canada."
  type        = string
  default     = "ca-central-1"
}

variable "gcp_project_id" {
  description = "GCP project holding the BigQuery marts."
  type        = string
}

variable "gcp_project_number" {
  description = "Numeric GCP project number. Needed to build the workload identity audience."
  type        = string
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
  description = "Origin allowed to call the Function URL. Set this to the deployed site, not '*'."
  type        = string
  default     = "*"
}

variable "api_key" {
  description = <<-EOT
    Shared secret required in the x-api-key header. It ships inside the public
    Netlify build (as VITE_API_KEY), so it is not real access control — it only
    filters out bots and scrapers that hit the Function URL directly without
    loading the site. Leave blank to disable the check entirely.
  EOT
  type        = string
  default     = ""
  sensitive   = true
}

variable "name_prefix" {
  type    = string
  default = "brp"
}
