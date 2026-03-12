// Messages sent TO the backend
export type UpstreamMessage =
  | { type: "auth"; token: string }
  | { type: "audio"; data: string } // base64 PCM 16kHz
  | { type: "screen_frame"; data: string } // base64 JPEG
  | { type: "text"; content: string };

// Messages received FROM the backend
export type DownstreamMessage =
  | { type: "auth_success"; uid: string }
  | { type: "audio"; data: string } // base64 PCM 24kHz
  | { type: "tool_call"; name: string; args: Record<string, any> }
  | { type: "transcription"; role: "user" | "agent"; text: string }
  | { type: "turn_complete" }
  | { type: "interrupted" }
  | { type: "error"; message: string };

// Tool call argument types
export interface DisplayTranslationArgs {
  section_id: string;
  source_text: string;
  translated_text: string;
  target_language: string;
  nuance_notes?: string;
  key_terms?: Array<{
    original: string;
    translated: string;
    context: string;
  }>;
}

export interface TranslateImageRegionArgs {
  image_description: string;
  labels_found: string[];
  translated_labels: Array<{
    original: string;
    translated: string;
    position: string;
  }>;
  target_language: string;
}

// Annotation item (rendered in AnnotationPanel)
export interface AnnotationItem {
  id: string;
  timestamp: number;
  type: "translation" | "image_translation";
  args: DisplayTranslationArgs | TranslateImageRegionArgs;
}
