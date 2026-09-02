terraform {
  required_version = ">= 1.6"

  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 5.70" }
    google  = { source = "hashicorp/google", version = "~> 6.10" }
    archive = { source = "hashicorp/archive", version = "~> 2.6" }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "google" {
  project = var.gcp_project_id
}
