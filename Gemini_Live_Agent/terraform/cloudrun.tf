# =============================================================================
# Cloud Run: API Service (REST)
# =============================================================================
resource "google_cloud_run_v2_service" "api" {
  name     = "dr-lingua-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloudrun_sa.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    containers {
      image = "${local.registry_prefix}/api:${var.image_tag}"

      ports {
        container_port = 8080
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GCS_BUCKET"
        value = var.gcs_bucket
      }
      env {
        name = "GOOGLE_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_api_key.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        startup_cpu_boost = true
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        timeout_seconds       = 5
        failure_threshold     = 10
      }
    }
  }

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_secret_manager_secret_version.google_api_key,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "api_public" {
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# =============================================================================
# Cloud Run: Streaming Service (WebSocket - Gemini Live Audio)
# =============================================================================
resource "google_cloud_run_v2_service" "streaming" {
  name     = "dr-lingua-streaming"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloudrun_sa.email

    scaling {
      min_instance_count = 0
      max_instance_count = 4
    }

    # Long timeout for WebSocket streaming sessions
    timeout = "3600s"

    containers {
      image = "${local.registry_prefix}/streaming:${var.image_tag}"

      ports {
        container_port = 8080
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GCS_BUCKET"
        value = var.gcs_bucket
      }
      env {
        name  = "GOOGLE_GENAI_USE_VERTEXAI"
        value = "FALSE"
      }
      env {
        name = "GOOGLE_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_api_key.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
        startup_cpu_boost = true
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        timeout_seconds       = 5
        failure_threshold     = 10
      }
    }
  }

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_secret_manager_secret_version.google_api_key,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "streaming_public" {
  name     = google_cloud_run_v2_service.streaming.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# =============================================================================
# Cloud Run: Visual Noun Service (WebSocket)
# =============================================================================
resource "google_cloud_run_v2_service" "visual_noun" {
  name     = "dr-lingua-visual-noun"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloudrun_sa.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    # Long timeout for WebSocket sessions
    timeout = "3600s"

    containers {
      image = "${local.registry_prefix}/visual-noun:${var.image_tag}"

      ports {
        container_port = 8080
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GCS_BUCKET"
        value = var.gcs_bucket
      }
      env {
        name  = "GOOGLE_GENAI_USE_VERTEXAI"
        value = "FALSE"
      }
      env {
        name = "GOOGLE_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.google_api_key.secret_id
            version = "latest"
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
        startup_cpu_boost = true
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        timeout_seconds       = 5
        failure_threshold     = 10
      }
    }
  }

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_secret_manager_secret_version.google_api_key,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "visual_noun_public" {
  name     = google_cloud_run_v2_service.visual_noun.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
