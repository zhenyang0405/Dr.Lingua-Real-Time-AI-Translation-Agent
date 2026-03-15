# Dedicated service account for Cloud Run backend services
resource "google_service_account" "cloudrun_sa" {
  account_id   = "dr-lingua-cloudrun"
  display_name = "Dr. Lingua Cloud Run Service Account"
}

# Firestore read/write access
resource "google_project_iam_member" "firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# Cloud Storage object admin (upload, download, signed URLs)
resource "google_project_iam_member" "gcs" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# Secret Manager access for API keys
resource "google_project_iam_member" "secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# Sign blobs for GCS signed URLs (required without service account key file)
resource "google_project_iam_member" "token_creator" {
  project = var.project_id
  role    = "roles/iam.serviceAccountTokenCreator"
  member  = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}

# Firebase Auth token verification
resource "google_project_iam_member" "firebase_auth" {
  project = var.project_id
  role    = "roles/firebase.sdkAdminServiceAgent"
  member  = "serviceAccount:${google_service_account.cloudrun_sa.email}"
}
