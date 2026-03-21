"""
POST /api/parse-filled-form

Receives a base64-encoded filled form (PDF or image), extracts both the form
structure (sections + fields) and the filled-in values using Claude, then
attempts to match the structure against existing published templates in the org.

Returns:
  - Extracted template structure (sections, fields)
  - Extracted form data (field_label → value)
  - Template match result (matched_template_id, confidence_level, field_id_map)
  - Suggested site name extracted from the form header (if any)

The frontend uses this to:
  1. Confirm or reject the template match
  2. Assign a site (pick existing or create new)
  3. Show the user a pre-populated DynamicFormRenderer to review and correct
"""

import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from api.limiter import limiter
from api.services.filled_form_parser import (
    PDF_MEDIA_TYPE,
    ALLOWED_IMAGE_TYPES,
    normalize_label,
    parse_filled_form_with_claude,
)
from api.services.template_matcher import match_template

logger = logging.getLogger("archepal.routers.filled_form")

router = APIRouter()

ALLOWED_MEDIA_TYPES = {PDF_MEDIA_TYPE, *ALLOWED_IMAGE_TYPES}


class ParseFilledFormRequest(BaseModel):
    base64_data: str    # base64-encoded PDF or image (no data URI prefix)
    media_type: str     # "application/pdf" | "image/jpeg" | "image/png" | "image/webp"
    file_name: str      # original filename, used for logging only
    org_id: str         # org context for template matching


class ParseFilledFormResponse(BaseModel):
    # Extracted structure
    template_name: str
    site_type: str
    suggested_site_name: str
    sections: list
    fields: list
    # Extracted values (field_label → value)
    form_data: dict
    # Template match result
    matched_template_id: str | None
    matched_template_name: str | None
    confidence: float
    confidence_level: str   # "high" | "possible" | "none"
    # Maps normalized field label → real Firestore field ID (empty if no match)
    field_id_map: dict


@router.post("/parse-filled-form", response_model=ParseFilledFormResponse)
@limiter.limit("5/minute")
async def parse_filled_form(request: Request, body: ParseFilledFormRequest):
    """
    Parse a filled form (PDF or image) and match it against existing templates.
    """
    if not body.base64_data:
        raise HTTPException(status_code=400, detail="base64_data is required")

    if body.media_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported media_type '{body.media_type}'. "
                   f"Allowed: {sorted(ALLOWED_MEDIA_TYPES)}",
        )

    if not body.org_id:
        raise HTTPException(status_code=400, detail="org_id is required")

    logger.info(
        "parse-filled-form called — file=%s org=%s media_type=%s data_size=%d chars",
        body.file_name, body.org_id, body.media_type, len(body.base64_data),
    )

    # Step 1 — Extract structure + values with Claude
    try:
        parsed = parse_filled_form_with_claude(body.base64_data, body.media_type)
    except ValueError as e:
        logger.warning("parse-filled-form validation error: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("parse-filled-form Claude call failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Form parsing failed: {str(e)}")

    sections = parsed["sections"]
    fields = parsed["fields"]
    form_data = parsed["form_data"]

    # Step 2 — Match against existing published templates
    extracted_labels = [f.get("label", "") for f in fields if f.get("label")]

    try:
        match = match_template(body.org_id, extracted_labels)
    except Exception as e:
        # Template matching is non-critical — log and continue with no match
        logger.error(
            "parse-filled-form template matching failed (non-fatal): %s", e, exc_info=True
        )
        match = {
            "matched_template_id": None,
            "matched_template_name": None,
            "confidence": 0.0,
            "confidence_level": "none",
            "field_id_map": {},
        }

    logger.info(
        "parse-filled-form complete — file=%s sections=%d fields=%d "
        "form_data_keys=%d match=%s confidence=%.2f",
        body.file_name,
        len(sections),
        len(fields),
        len(form_data),
        match["matched_template_id"] or "none",
        match["confidence"],
    )

    return ParseFilledFormResponse(
        template_name=parsed["template_name"],
        site_type=parsed["site_type"],
        suggested_site_name=parsed["suggested_site_name"],
        sections=sections,
        fields=fields,
        form_data=form_data,
        matched_template_id=match["matched_template_id"],
        matched_template_name=match["matched_template_name"],
        confidence=match["confidence"],
        confidence_level=match["confidence_level"],
        field_id_map=match["field_id_map"],
    )
