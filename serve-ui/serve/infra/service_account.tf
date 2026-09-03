# ---------------------------------------------------------------------------
# One service account, used both as the Cloud Run runtime identity and for
# BigQuery access. Deliberately narrow: it can run queries and read the three
# marts. It cannot write, create datasets, or touch the landing zone.
# ---------------------------------------------------------------------------

resource "google_service_account" "api_reader" {
  account_id   = "${var.name_prefix}-api-reader"
  display_name = "Cloud Run identity for the dashboard API"
}

resource "google_project_iam_member" "job_user" {
  project = var.gcp_project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${google_service_account.api_reader.email}"
}

# Cloud Run's default compute service account gets this automatically; a
# custom service account needs it granted explicitly to write to Cloud Logging.
resource "google_project_iam_member" "log_writer" {
  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.api_reader.email}"
}

resource "google_bigquery_dataset_iam_member" "reader" {
  for_each   = var.bq_datasets
  dataset_id = each.value
  role       = "roles/bigquery.dataViewer"
  member     = "serviceAccount:${google_service_account.api_reader.email}"
}

data "google_project" "current" {
  project_id = var.gcp_project_id
}

locals {
  # `gcloud run deploy --source` builds via Cloud Build, which runs as this
  # default compute service account. None of these three roles are granted on
  # a fresh project, and the very first source deploy fails on each one in
  # turn without them — see serve/README.md.
  cloudbuild_default_sa = "serviceAccount:${data.google_project.current.number}-compute@developer.gserviceaccount.com"
}

resource "google_project_iam_member" "cloudbuild_storage_reader" {
  project = var.gcp_project_id
  role    = "roles/storage.objectViewer"
  member  = local.cloudbuild_default_sa
}

resource "google_project_iam_member" "cloudbuild_log_writer" {
  project = var.gcp_project_id
  role    = "roles/logging.logWriter"
  member  = local.cloudbuild_default_sa
}

resource "google_project_iam_member" "cloudbuild_artifact_writer" {
  project = var.gcp_project_id
  role    = "roles/artifactregistry.writer"
  member  = local.cloudbuild_default_sa
}
