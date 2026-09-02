# ---------------------------------------------------------------------------
# Workload Identity Federation: the Lambda's AWS role is exchanged directly for
# a short-lived Google token. No service account JSON key exists, so none can
# leak — this is the piece that answers the "no real access controls" note in
# the project README.
# ---------------------------------------------------------------------------

resource "google_service_account" "api_reader" {
  account_id   = "${var.name_prefix}-api-reader"
  display_name = "Read-only BigQuery access for the dashboard API"
}

# Deliberately narrow: the API runs queries and reads marts. It cannot write,
# create datasets, or touch the landing zone.
resource "google_project_iam_member" "job_user" {
  project = var.gcp_project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.api_reader.email}"
}

resource "google_bigquery_dataset_iam_member" "reader" {
  for_each   = var.bq_datasets
  dataset_id = each.value
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${google_service_account.api_reader.email}"
}

resource "google_iam_workload_identity_pool" "aws" {
  workload_identity_pool_id = "${var.name_prefix}-aws-pool"
  display_name              = "AWS Lambda federation"
}

resource "google_iam_workload_identity_pool_provider" "aws" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.aws.workload_identity_pool_id
  workload_identity_pool_provider_id = "${var.name_prefix}-aws-provider"

  aws {
    account_id = data.aws_caller_identity.current.account_id
  }

  attribute_mapping = {
    "google.subject"     = "assertion.arn"
    "attribute.aws_role" = "assertion.arn.extract('assumed-role/{role}/')"
    "attribute.aws_account" = "assertion.account"
  }

  # Without this condition, any principal in the AWS account could mint a
  # Google token. Scope it to the one Lambda role.
  attribute_condition = "attribute.aws_role == '${aws_iam_role.api.name}'"
}

data "aws_caller_identity" "current" {}

resource "google_service_account_iam_member" "impersonation" {
  service_account_id = google_service_account.api_reader.name
  role               = "roles/iam.workloadIdentityUser"
  member = join("", [
    "principalSet://iam.googleapis.com/",
    google_iam_workload_identity_pool.aws.name,
    "/attribute.aws_role/",
    aws_iam_role.api.name,
  ])
}
