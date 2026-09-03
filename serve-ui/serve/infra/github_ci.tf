# ---------------------------------------------------------------------------
# Lets GitHub Actions deploy new API code to Cloud Run without a stored key —
# GitHub's own OIDC token is exchanged for a short-lived Google credential,
# scoped to this one repo. Skipped entirely if github_repo is left blank.
# ---------------------------------------------------------------------------

resource "google_iam_workload_identity_pool" "github" {
  count = var.github_repo == "" ? 0 : 1

  workload_identity_pool_id = "${var.name_prefix}-github-pool"
  display_name              = "GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  count = var.github_repo == "" ? 0 : 1

  workload_identity_pool_id          = google_iam_workload_identity_pool.github[0].workload_identity_pool_id
  workload_identity_pool_provider_id = "${var.name_prefix}-github-provider"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
  }

  # Only this repo — without this, any GitHub Actions workflow anywhere could
  # mint a token for it.
  attribute_condition = "attribute.repository == '${var.github_repo}'"
}

resource "google_service_account" "ci_deployer" {
  count = var.github_repo == "" ? 0 : 1

  account_id   = "${var.name_prefix}-ci-deployer"
  display_name = "GitHub Actions deployer for the dashboard API"
}

resource "google_service_account_iam_member" "github_impersonation" {
  count = var.github_repo == "" ? 0 : 1

  service_account_id = google_service_account.ci_deployer[0].name
  role                = "roles/iam.workloadIdentityUser"
  member              = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository/${var.github_repo}"
}

# Deploy new revisions...
resource "google_project_iam_member" "ci_run_admin" {
  count = var.github_repo == "" ? 0 : 1

  project = var.gcp_project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.ci_deployer[0].email}"
}

# ...running as the api_reader service account...
resource "google_service_account_iam_member" "ci_act_as_runtime" {
  count = var.github_repo == "" ? 0 : 1

  service_account_id = google_service_account.api_reader.name
  role                = "roles/iam.serviceAccountUser"
  member              = "serviceAccount:${google_service_account.ci_deployer[0].email}"
}

# ...built and pushed via Cloud Build.
resource "google_project_iam_member" "ci_cloudbuild_editor" {
  count = var.github_repo == "" ? 0 : 1

  project = var.gcp_project_id
  role    = "roles/cloudbuild.builds.editor"
  member  = "serviceAccount:${google_service_account.ci_deployer[0].email}"
}

resource "google_project_iam_member" "ci_storage_admin" {
  count = var.github_repo == "" ? 0 : 1

  project = var.gcp_project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.ci_deployer[0].email}"
}

resource "google_project_iam_member" "ci_artifact_writer" {
  count = var.github_repo == "" ? 0 : 1

  project = var.gcp_project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.ci_deployer[0].email}"
}
