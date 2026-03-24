/**
 * Detect the language of a text string and return a short badge label.
 */
export function detectLanguageBadge(text: string): string {
  if (!text) return "";
  // CJK Unified Ideographs
  if (/[\u4e00-\u9fff]/.test(text)) {
    // Check if predominantly Japanese (has hiragana/katakana)
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "JP";
    return "中文";
  }
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "JP";
  if (/[\uac00-\ud7af]/.test(text)) return "KO";
  if (/[\u0600-\u06ff]/.test(text)) return "AR";
  if (/[\u0400-\u04ff]/.test(text)) return "RU";
  if (/[\u0e00-\u0e7f]/.test(text)) return "TH";
  if (/[\u3130-\u318f]/.test(text)) return "KO";
  // Latin-based — try to distinguish
  if (/[a-zA-Z]/.test(text)) return "EN";
  return "";
}
