def display_translation(
    section_id: str,
    source_text: str,
    translated_text: str,
    target_language: str,
    nuance_notes: str = "",
    key_terms: list[dict] = []
) -> dict:
    """Display a translated section in the annotation panel alongside the source document.

    ALWAYS call this tool when translating any section of text. The translation will be
    displayed visually in the user's annotation panel so they can read along.

    Args:
        section_id: Identifier for the document section (e.g., 'abstract', 'section_2.1', 'conclusion')
        source_text: The original text from the document being translated (first 200 chars is fine for long sections)
        translated_text: The complete translation in the target language
        target_language: ISO language code (e.g., 'zh-CN', 'ja', 'ko', 'es')
        nuance_notes: Optional explanation of translation nuances or cultural context
        key_terms: Optional list of domain-specific terms, each with 'original', 'translated', and 'context' keys

    Returns:
        Confirmation that the translation was displayed
    """
    return {
        "status": "displayed",
        "section_id": section_id,
        "message": f"Translation for '{section_id}' is now displayed in the annotation panel."
    }


def translate_image_region(
    image_description: str,
    labels_found: list[str],
    translated_labels: list[dict],
    target_language: str
) -> dict:
    """Translate text labels found within an image, diagram, figure, or chart on screen.

    Call this when the user asks about visual elements in the document that contain text
    (axis labels, diagram annotations, flowchart boxes, table headers in images, etc.).

    Args:
        image_description: Brief description of the image/diagram being translated
        labels_found: List of original text labels identified in the image
        translated_labels: List of dicts, each with 'original', 'translated', and 'position'
                          (position is a brief description like 'top-left box', 'y-axis', etc.)
        target_language: ISO language code

    Returns:
        Confirmation that the image translation was displayed
    """
    return {
        "status": "displayed",
        "image_description": image_description,
        "message": f"Image translation for '{image_description}' is now displayed."
    }
