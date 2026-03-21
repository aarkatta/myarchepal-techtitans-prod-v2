"""
POST /api/sites/create-from-upload

Creates a minimal Sites document on behalf of a MEMBER (or any authenticated user).
MEMBERs cannot create Sites via Firestore client rules, so this endpoint uses the
Firebase Admin SDK to bypass client-side rules and write the document directly.

Called from the Upload Filled Form wizard (Step 4 — Site Assignment) when the user
chooses "Create new site" instead of picking an existing one.
"""

import logging

from fastapi import APIRouter, HTTPException, Request
from firebase_admin import firestore as fb_firestore
from pydantic import BaseModel

from api.limiter import limiter
from api.services.fb_admin import get_db, verify_id_token

logger = logging.getLogger("archepal.routers.sites")

router = APIRouter()


class CreateSiteFromUploadRequest(BaseModel):
    site_name: str
    site_type: str
    id_token: str   # Firebase ID token — used to verify identity and look up orgId


class CreateSiteResponse(BaseModel):
    site_id: str


@router.post("/sites/create-from-upload", response_model=CreateSiteResponse)
@limiter.limit("20/minute")
async def create_site_from_upload(request: Request, body: CreateSiteFromUploadRequest):
    """
    Create a minimal site document as any authenticated user.
    Looks up the caller's organizationId from Firestore and scopes the site to it.
    """
    if not body.site_name.strip():
        raise HTTPException(status_code=400, detail="site_name is required")
    if not body.site_type.strip():
        raise HTTPException(status_code=400, detail="site_type is required")
    if not body.id_token:
        raise HTTPException(status_code=400, detail="id_token is required")

    # Verify the caller's identity
    try:
        decoded = verify_id_token(body.id_token)
    except Exception as e:
        logger.warning("create-site-from-upload: invalid id_token — %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired ID token")

    uid = decoded["uid"]
    db = get_db()

    # Look up the caller's organizationId
    user_doc = db.collection("users").document(uid).get()
    if not user_doc.exists:
        raise HTTPException(status_code=403, detail="User not found in organization")

    org_id = user_doc.to_dict().get("organizationId")
    if not org_id:
        raise HTTPException(status_code=403, detail="User is not assigned to an organization")

    # Create the minimal Sites document using Admin SDK (bypasses client rules)
    site_ref = db.collection("Sites").document()
    user_data = user_doc.to_dict()
    site_ref.set({
        "name": body.site_name.strip(),
        "siteType": body.site_type.strip(),
        "organizationId": org_id,
        "status": "draft",
        "createdBy": uid,
        "assignedConsultantId": uid,
        "assignedConsultantEmail": user_data.get("email", ""),
        "createdAt": fb_firestore.SERVER_TIMESTAMP,
        "updatedAt": fb_firestore.SERVER_TIMESTAMP,
    })

    logger.info(
        "create-site-from-upload — site_id=%s name=%s type=%s org=%s uid=%s",
        site_ref.id, body.site_name, body.site_type, org_id, uid,
    )

    return CreateSiteResponse(site_id=site_ref.id)
