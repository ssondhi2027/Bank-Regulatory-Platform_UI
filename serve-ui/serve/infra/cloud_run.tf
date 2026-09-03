# ---------------------------------------------------------------------------
# The API, running as a Cloud Run service in the same project as the BigQuery
# marts it reads — no cross-cloud credential exchange needed, unlike the AWS
# Lambda version this replaced.
#
# Terraform owns the service shell and its IAM; it never builds or pushes
# code. Ship code with `gcloud run deploy --source api/` (see README) — the
# lifecycle block below stops Terraform from reverting that image back to the
# placeholder on the next apply.
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "api" {
  name     = "${var.name_prefix}-api"
  location = var.gcp_region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.api_reader.email

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      env {
        name  = "GCP_PROJECT_ID"
        value = var.gcp_project_id
      }
      env {
        name  = "BQ_LOCATION"
        value = var.bq_location
      }
      env {
        name  = "BQ_DATASET_CORE"
        value = var.bq_datasets["core"]
      }
      env {
        name  = "BQ_DATASET_FINANCE"
        value = var.bq_datasets["finance"]
      }
      env {
        name  = "BQ_DATASET_CONTROLS"
        value = var.bq_datasets["controls"]
      }
      env {
        name  = "CONTROL_RUN_TS_COLUMN"
        value = var.control_run_ts_column
      }
      env {
        name  = "BQ_MAX_BYTES_BILLED"
        value = "500000000"
      }
      env {
        name  = "CACHE_TTL_SECONDS"
        value = "0"
      }
      env {
        name  = "CORS_ALLOW_ORIGIN"
        value = var.cors_allow_origin
      }
      env {
        name  = "API_KEY"
        value = var.api_key
      }
      env {
        name  = "SCORECARD_PASSWORD"
        value = var.scorecard_password
      }
      env {
        name  = "GEMINI_API_KEY"
        value = var.gemini_api_key
      }
      env {
        name  = "GEMINI_MODEL"
        value = var.gemini_model
      }
      env {
        name  = "INSIGHTS_CACHE_TTL_SECONDS"
        value = tostring(var.insights_cache_ttl_seconds)
      }

      resources {
        limits = {
          memory = "512Mi"
          cpu    = "1"
        }
      }
    }

    scaling {
      min_instance_count = 0 # Scale to zero when idle — no baseline cost.
      max_instance_count = 5
    }
  }

  lifecycle {
    # `gcloud run deploy --source` (see README) stamps its own client info,
    # build provenance, and manual scaling fields on the live resource —
    # none of that is something Terraform's config declares, so ignore it
    # rather than fighting the drift on every apply.
    ignore_changes = [
      client,
      client_version,
      scaling,
      template[0].containers[0].image,
    ]
  }
}

# Read-only public filing data — no auth gate at the platform level. The
# optional x-api-key header (API_KEY above) is a scraper filter, not real
# access control. See serve/README.md.
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = google_cloud_run_v2_service.api.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
