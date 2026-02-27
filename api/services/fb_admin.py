"""
Firebase Admin SDK — shared singleton instance.

Reads FIREBASE_SERVICE_ACCOUNT_JSON from the environment (full JSON string,
never a file path — Vercel filesystem is ephemeral).

Used by export.py and notify.py.
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env for local dev (two levels up from api/services/ → project root)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

import firebase_admin
from firebase_admin import auth as fb_auth, credentials
from firebase_admin import firestore as fb_firestore

_initialized = False


def _ensure_initialized() -> None:
    global _initialized
    if _initialized:
        return

    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if not sa_json:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. "
            "Add the full service-account JSON as a single-line string in your "
            "api/.env file (local) or Vercel Environment Variables (production)."
        )

    cred_dict = json.loads(sa_json)
    cred = credentials.Certificate(cred_dict)
    firebase_admin.initialize_app(
        cred,
        {"storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", "")},
    )
    _initialized = True


def get_db():
    """Return a Firestore Admin client."""
    _ensure_initialized()
    return fb_firestore.client()


def verify_id_token(token: str) -> dict:
    """
    Verify a Firebase ID token.
    Returns the decoded token claims dict (includes 'uid').
    Raises firebase_admin.auth.InvalidIdTokenError on failure.
    """
    _ensure_initialized()
    return fb_auth.verify_id_token(token)
