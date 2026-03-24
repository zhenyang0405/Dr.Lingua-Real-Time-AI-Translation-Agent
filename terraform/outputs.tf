output "api_url" {
  description = "REST API Cloud Run URL"
  value       = google_cloud_run_v2_service.api.uri
}

output "streaming_url" {
  description = "Streaming WebSocket Cloud Run URL"
  value       = google_cloud_run_v2_service.streaming.uri
}

output "visual_noun_url" {
  description = "Visual Noun WebSocket Cloud Run URL"
  value       = google_cloud_run_v2_service.visual_noun.uri
}

output "registry_prefix" {
  description = "Artifact Registry prefix for docker push"
  value       = local.registry_prefix
}
