# ---------------------------------------------------------------------------
# The API: one Node 20 Lambda behind a Function URL. No API Gateway — this
# needs neither throttling plans nor request transformation, and the Function
# URL handles CORS natively.
# ---------------------------------------------------------------------------

locals {
  fn_name = "${var.name_prefix}-api"
}

data "archive_file" "api" {
  type        = "zip"
  source_dir  = "${path.module}/../api/dist"
  output_path = "${path.module}/.build/lambda.zip"
}

resource "aws_iam_role" "api" {
  name = "${local.fn_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "api_logs" {
  role       = aws_iam_role.api.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Created explicitly so the retention period is set. Left to Lambda, log groups
# are created on first invocation and never expire.
resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${local.fn_name}"
  retention_in_days = 14
}

resource "aws_lambda_function" "api" {
  function_name = local.fn_name
  role          = aws_iam_role.api.arn
  handler       = "index.handler"
  runtime       = "nodejs20.x"

  filename         = data.archive_file.api.output_path
  source_code_hash = data.archive_file.api.output_base64sha256

  # Every request round-trips to BigQuery, so the timeout has to cover a cold
  # start plus a real query. Memory is set well above what the code needs
  # because Lambda scales CPU with memory, and the token exchange on a cold
  # start is CPU-bound.
  timeout     = 30
  memory_size = 1024

  environment {
    variables = {
      GCP_PROJECT_ID            = var.gcp_project_id
      GCP_PROJECT_NUMBER        = var.gcp_project_number
      GCP_WIF_POOL_ID           = google_iam_workload_identity_pool.aws.workload_identity_pool_id
      GCP_WIF_PROVIDER_ID       = google_iam_workload_identity_pool_provider.aws.workload_identity_pool_provider_id
      GCP_SERVICE_ACCOUNT_EMAIL = google_service_account.api_reader.email

      BQ_LOCATION            = var.bq_location
      BQ_DATASET_CORE        = var.bq_datasets["core"]
      BQ_DATASET_FINANCE     = var.bq_datasets["finance"]
      BQ_DATASET_CONTROLS    = var.bq_datasets["controls"]
      CONTROL_RUN_TS_COLUMN  = var.control_run_ts_column
      BQ_MAX_BYTES_BILLED    = "500000000"
      CACHE_TTL_SECONDS      = "0"
      CORS_ALLOW_ORIGIN      = var.cors_allow_origin
      NODE_OPTIONS           = "--enable-source-maps"
    }
  }

  depends_on = [aws_cloudwatch_log_group.api]
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE" # Read-only public marts; there is nothing here to gate.

  cors {
    allow_origins = [var.cors_allow_origin]
    allow_methods = ["GET"]
    allow_headers = ["content-type"]
    max_age       = 3600
  }
}
