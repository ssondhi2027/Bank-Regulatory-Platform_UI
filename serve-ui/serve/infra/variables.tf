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

variable "scorecard_password" {
  description = <<-EOT
    Password required to view the Control scorecard page specifically. Unlike
    api_key, this is never shipped in the Netlify build — the front end asks
    for it at runtime, so it's real access control. Leave blank to disable
    the check (the page is open to anyone, same as the rest of the site).
  EOT
  type        = string
  default     = ""
  sensitive   = true
}

variable "gemini_api_key" {
  description = <<-EOT
    Google AI Studio API key (ai.google.dev), used server-side only to
    generate the plain-language dashboard summaries. Leave blank to disable
    /insights/* entirely -- they return 503 rather than failing the app.
  EOT
  type        = string
  default     = ""
  sensitive   = true
}

variable "gemini_model" {
  description = "Gemini model for insight generation. Check ai.google.dev for the current free-tier model if this one's been retired."
  type        = string
  default     = "gemini-3.6-flash"
}

variable "insights_cache_ttl_seconds" {
  description = "How long a generated insight is reused before calling Gemini again. Protects the free tier's rate limit; the marts don't change intraday anyway."
  type        = number
  default     = 3600
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
