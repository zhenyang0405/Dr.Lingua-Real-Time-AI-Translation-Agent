terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required GCP APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
  ])
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

# Artifact Registry repository for backend Docker images
resource "google_artifact_registry_repository" "dr_lingua" {
  location      = var.region
  repository_id = "dr-lingua"
  format        = "DOCKER"
  description   = "Dr. Lingua backend container images"

  depends_on = [google_project_service.apis["artifactregistry.googleapis.com"]]
}

locals {
  registry_prefix = "${var.region}-docker.pkg.dev/${var.project_id}/dr-lingua"
}
