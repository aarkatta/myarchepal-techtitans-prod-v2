"""
POST /api/parse-form-image

Receives a base64-encoded photo/scan of a filled paper form plus the template
field definitions, sends it to Claude Sonnet 4.6 (vision), and returns the
extracted field values ready to auto-populate the form in the frontend.
"""

import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from api.limiter import limiter
from api.services.form_image_parser import parse_form_image_with_claude

logger = logging.getLogger("archepal.routers.form_image")

router = APIRouter()


class FieldDef(BaseModel):
    id: str
    label: str
    fieldType: str
    options: list[str] | None = None


class ParseFormImageRequest(BaseModel):
    base64_image: str       # base64-encoded image (no data URI prefix)
    media_type: str         # e.g. "image/jpeg"
    fields: list[FieldDef]  # template field definitions for context


class ParseFormImageResponse(BaseModel):
    formData: dict          # { fieldId: extractedValue }
    fields_found: int       # how many fields were successfully extracted


@router.post("/parse-form-image", response_model=ParseFormImageResponse)
@limiter.limit("10/minute")
async def parse_form_image(request: Request, body: ParseFormImageRequest):
    """
    Extract filled-in values from a photo of a paper form using Claude vision.
    Returns formData ready to merge into the active form submission.
    """
    if not body.base64_image:
        raise HTTPException(status_code=400, detail="base64_image is required")
    if not body.fields:
        raise HTTPException(status_code=400, detail="fields list is required")

    logger.info(
        "parse-form-image called — media_type=%s fields=%d image_size=%d chars",
        body.media_type, len(body.fields), len(body.base64_image),
    )

    try:
        fields_dicts = [f.model_dump() for f in body.fields]
        result = parse_form_image_with_claude(body.base64_image, body.media_type, fields_dicts)
    except ValueError as e:
        logger.warning("parse-form-image validation error: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("parse-form-image failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Image parsing failed: {str(e)}")

    fields_found = len(result)
    logger.info("parse-form-image success — %d fields extracted", fields_found)

    return ParseFormImageResponse(formData=result, fields_found=fields_found)
