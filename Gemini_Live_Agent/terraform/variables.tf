variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run"
  type        = string
  default     = "us-central1"
}

variable "google_api_key" {
  description = "Gemini API key"
  type        = string
  sensitive   = true
}

variable "gcs_bucket" {
  description = "GCS bucket name"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag for backend services"
  type        = string
  default     = "latest"
}
