"""
POST /api/notify-consultant

Called fire-and-forget from siteAssignments.ts after a consultant is assigned.
Looks up the site name and consultant display name from Firestore, then sends
an assignment email via aiosmtplib.

Body: { siteId, consultantId, consultantEmail }
"""

import logging
import os

from fastapi import APIRouter, Request
from pydantic import BaseModel

from api.limiter import limiter
from api.services.crashvault import capture_exception, log_info, log_warning

logger = logging.getLogger("archepal.routers.notify")

router = APIRouter()


class NotifyRequest(BaseModel):
    siteId: str
    consultantId: str
    consultantEmail: str


@router.post("/notify-consultant")
@limiter.limit("10/minute")
async def notify_consultant(request: Request, body: NotifyRequest):
    """
    Send an email notification to the assigned consultant.
    Returns { ok: true } regardless — the frontend is fire-and-forget.
    """
    logger.info("notify-consultant called — site=%s consultant=%s email=%s",
                body.siteId, body.consultantId, body.consultantEmail)

    # Look up site name and consultant display name from Firestore
    site_name = "Assigned Site"
    consultant_name = body.consultantEmail

    try:
        from api.services.fb_admin import get_db

        db = get_db()

        site_doc = db.collection("Sites").document(body.siteId).get()
        if site_doc.exists:
            site_name = site_doc.to_dict().get("name", site_name)

        user_doc = db.collection("users").document(body.consultantId).get()
        if user_doc.exists:
            consultant_name = user_doc.to_dict().get("displayName", consultant_name)
    except Exception as e:
        logger.warning("Could not fetch Firestore data for notification: %s", e)
        capture_exception(e, tags=["notify", "firestore"], context={"siteId": body.siteId}, source="api.routers.notify")

    # Build email content
    app_url = os.environ.get("APP_URL", "http://localhost:8080")
    deep_link = f"{app_url}/#/form/{body.siteId}"
    subject = f"New Form Assignment — {site_name}"

    body_text = (
        f"Hi {consultant_name},\n\n"
        f"You have been assigned a new archaeological site form to complete:\n"
        f"  {site_name}\n\n"
        f"Open the form here:\n  {deep_link}\n\n"
        f"— ArchePal\n"
        f"NC Archaeology Site Management Platform"
    )

    body_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1e3a5f;padding:20px 24px;">
        <h2 style="color:#ffffff;margin:0;">ArchePal</h2>
        <p style="color:#a8c4e0;margin:4px 0 0;">NC Archaeology Site Management</p>
      </div>
      <div style="padding:24px;">
        <p>Hi {consultant_name},</p>
        <p>You have been assigned a new archaeological site form to complete:</p>
        <p style="font-size:18px;font-weight:bold;color:#1e3a5f;">{site_name}</p>
        <p style="margin-top:24px;">
          <a href="{deep_link}"
             style="display:inline-block;padding:12px 24px;background:#1e3a5f;
                    color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;">
            Open Form
          </a>
        </p>
        <p style="color:#666;font-size:13px;">
          Or copy this link:<br/>
          <a href="{deep_link}" style="color:#1e3a5f;">{deep_link}</a>
        </p>
      </div>
      <div style="background:#f5f5f5;padding:12px 24px;text-align:center;">
        <p style="color:#999;font-size:11px;margin:0;">
          Sent by ArchePal · NC Archaeology Site Management Platform
        </p>
      </div>
    </div>
    """

    try:
        await _send_email(
            to=body.consultantEmail,
            subject=subject,
            body_text=body_text,
            body_html=body_html,
        )
        logger.info("Notification email sent — to=%s site=%s", body.consultantEmail, site_name)
        log_info(
            f"Email sent to {body.consultantEmail} for site '{site_name}'",
            tags=["notify", "email"],
            context={"siteId": body.siteId, "consultantId": body.consultantId},
            source="api.routers.notify",
        )
    except Exception as e:
        logger.error("Email send failed — to=%s: %s", body.consultantEmail, e, exc_info=True)
        capture_exception(e, tags=["notify", "email"], context={"siteId": body.siteId, "to": body.consultantEmail}, source="api.routers.notify")

    return {"ok": True}


class NotifyAdminTemplateReviewRequest(BaseModel):
    template_id: str
    template_name: str
    uploaded_by_uid: str
    site_name: str
    org_id: str


@router.post("/notify-admin-template-review")
@limiter.limit("20/minute")
async def notify_admin_template_review(
    request: Request, body: NotifyAdminTemplateReviewRequest
):
    """
    Send a template-review notification to all ORG_ADMINs in the organization.
    Called fire-and-forget from UploadFilledForm.tsx when a new template is auto-generated.
    Returns { ok: true } regardless.
    """
    logger.info(
        "notify-admin-template-review called — template=%s org=%s uploaded_by=%s",
        body.template_id, body.org_id, body.uploaded_by_uid,
    )

    admin_emails: list[str] = []
    uploader_name = "A field consultant"

    try:
        from api.services.fb_admin import get_db

        db = get_db()

        # Look up uploader display name
        uploader_doc = db.collection("users").document(body.uploaded_by_uid).get()
        if uploader_doc.exists:
            uploader_name = uploader_doc.to_dict().get("displayName", uploader_name)

        # Find all ORG_ADMINs in the org
        admins_snap = (
            db.collection("users")
            .where("organizationId", "==", body.org_id)
            .where("role", "==", "ORG_ADMIN")
            .stream()
        )
        for admin_doc in admins_snap:
            email = admin_doc.to_dict().get("email", "")
            if email:
                admin_emails.append(email)
    except Exception as e:
        logger.warning("notify-admin-template-review: Firestore lookup failed — %s", e)

    if not admin_emails:
        logger.info("notify-admin-template-review: no admin emails found for org=%s", body.org_id)
        return {"ok": True}

    app_url = os.environ.get("APP_URL", "http://localhost:8080")
    review_link = f"{app_url}/#/templates/{body.template_id}/edit"
    subject = f"New form template needs review — {body.template_name}"

    body_text = (
        f"Hi,\n\n"
        f"{uploader_name} uploaded a filled paper form for site '{body.site_name}'.\n"
        f"A draft template was automatically generated from the form and needs your review.\n\n"
        f"Template: {body.template_name}\n"
        f"Review it here:\n  {review_link}\n\n"
        f"Once you publish the template, the consultant can submit their form.\n\n"
        f"— ArchePal\n"
        f"NC Archaeology Site Management Platform"
    )

    body_html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1e3a5f;padding:20px 24px;">
        <h2 style="color:#ffffff;margin:0;">ArchePal</h2>
        <p style="color:#a8c4e0;margin:4px 0 0;">NC Archaeology Site Management</p>
      </div>
      <div style="padding:24px;">
        <p>Hi,</p>
        <p>
          <strong>{uploader_name}</strong> uploaded a filled paper form for site
          <strong>{body.site_name}</strong>. A draft template was automatically generated
          and needs your review before the consultant can submit.
        </p>
        <p style="font-size:18px;font-weight:bold;color:#1e3a5f;">{body.template_name}</p>
        <p style="margin-top:24px;">
          <a href="{review_link}"
             style="display:inline-block;padding:12px 24px;background:#1e3a5f;
                    color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;">
            Review Template
          </a>
        </p>
        <p style="color:#666;font-size:13px;margin-top:16px;">
          Review the generated fields, make corrections, then publish to unlock the submission.
        </p>
      </div>
      <div style="background:#f5f5f5;padding:12px 24px;text-align:center;">
        <p style="color:#999;font-size:11px;margin:0;">
          Sent by ArchePal · NC Archaeology Site Management Platform
        </p>
      </div>
    </div>
    """

    for email in admin_emails:
        try:
            await _send_email(
                to=email,
                subject=subject,
                body_text=body_text,
                body_html=body_html,
            )
            logger.info("notify-admin-template-review: email sent to %s", email)
        except Exception as e:
            logger.error(
                "notify-admin-template-review: email to %s failed — %s", email, e, exc_info=True
            )

    return {"ok": True}


async def _send_email(
    to: str, subject: str, body_text: str, body_html: str
) -> None:
    """Send an email via aiosmtplib using SMTP_* environment variables."""
    import aiosmtplib
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText

    smtp_host = os.environ.get("SMTP_HOST", "")
    if not smtp_host:
        logger.warning("SMTP_HOST not configured — skipping email to %s", to)
        log_warning("SMTP not configured — email skipped", tags=["notify", "smtp"], context={"to": to}, source="api.routers.notify")
        return

    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")
    email_from = os.environ.get("EMAIL_FROM", "noreply@archepal.com")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = email_from
    msg["To"] = to
    msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    await aiosmtplib.send(
        msg,
        hostname=smtp_host,
        port=smtp_port,
        username=smtp_user,
        password=smtp_pass,
        start_tls=True,
    )
