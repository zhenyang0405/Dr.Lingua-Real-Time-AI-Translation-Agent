# Module-level store for active document per session
# Maps session_id → doc_name
active_documents: dict[str, str] = {}
