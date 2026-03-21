"""
Template matcher — fuzzy label overlap against existing Firestore templates.

Compares the field labels extracted from a filled form against all published
templates in the organization, and returns the best match (if any).

Matching algorithm:
  1. Load all published siteTemplates for the org from Firestore
  2. For each template, load its fields/ subcollection
  3. Normalize all labels (lowercase, strip punctuation)
  4. Compute overlap: len(intersection) / len(extracted_labels)
  5. Return the best-scoring template with a confidence level:
       "high"     — score >= 0.80  (auto-confirm in UI)
       "possible" — score >= 0.50  (show user a choice)
       "none"     — score <  0.50  (treat as new template)

Also returns field_id_map: { normalized_label -> field_id } for the matched
template so the frontend can remap form_data keys to real Firestore field IDs.
"""

import logging
from typing import Any

from api.services.fb_admin import get_db
from api.services.filled_form_parser import normalize_label

logger = logging.getLogger("archepal.services.template_matcher")

HIGH_THRESHOLD = 0.80
POSSIBLE_THRESHOLD = 0.50


def match_template(
    org_id: str,
    extracted_labels: list[str],
) -> dict[str, Any]:
    """
    Find the best-matching published template for the given extracted field labels.

    Args:
        org_id:           Firestore organizationId to scope the search
        extracted_labels: Raw field labels from the parsed form (not yet normalized)

    Returns:
        {
          "matched_template_id":   str | None,
          "matched_template_name": str | None,
          "confidence":            float,        # 0.0 – 1.0
          "confidence_level":      str,          # "high" | "possible" | "none"
          "field_id_map":          dict,         # { normalized_label: field_id }
        }
    """
    normalized_extracted = {normalize_label(lbl) for lbl in extracted_labels if lbl}

    if not normalized_extracted:
        logger.info("match_template — no extracted labels, skipping")
        return _no_match()

    db = get_db()

    # Load all published templates for this org
    templates_snap = (
        db.collection("siteTemplates")
        .where("orgId", "==", org_id)
        .where("status", "==", "published")
        .stream()
    )
    templates = [{"id": doc.id, **doc.to_dict()} for doc in templates_snap]

    if not templates:
        logger.info("match_template — no published templates found for org=%s", org_id)
        return _no_match()

    best_score = 0.0
    best_template: dict | None = None
    best_field_id_map: dict[str, str] = {}

    for tmpl in templates:
        tmpl_id = tmpl["id"]

        # Load the fields subcollection for this template
        fields_snap = (
            db.collection("siteTemplates")
            .document(tmpl_id)
            .collection("fields")
            .stream()
        )
        field_docs = [{"id": fdoc.id, **fdoc.to_dict()} for fdoc in fields_snap]

        if not field_docs:
            continue

        # Build a map of normalized_label → field_id for this template
        tmpl_label_map: dict[str, str] = {}
        for fld in field_docs:
            raw_label = fld.get("label", "")
            if raw_label:
                tmpl_label_map[normalize_label(raw_label)] = fld["id"]

        tmpl_normalized = set(tmpl_label_map.keys())

        # Overlap score: fraction of extracted labels present in this template
        intersection = normalized_extracted & tmpl_normalized
        score = len(intersection) / len(normalized_extracted) if normalized_extracted else 0.0

        logger.debug(
            "match_template — template=%s name=%s score=%.2f intersection=%d/%d",
            tmpl_id, tmpl.get("name", "?"), score, len(intersection), len(normalized_extracted),
        )

        if score > best_score:
            best_score = score
            best_template = tmpl
            # field_id_map only includes labels that actually matched
            best_field_id_map = {lbl: tmpl_label_map[lbl] for lbl in intersection}

    if best_template is None or best_score < POSSIBLE_THRESHOLD:
        logger.info(
            "match_template — no match (best_score=%.2f, threshold=%.2f)",
            best_score, POSSIBLE_THRESHOLD,
        )
        return _no_match()

    confidence_level = "high" if best_score >= HIGH_THRESHOLD else "possible"

    logger.info(
        "match_template — matched template=%s name=%s score=%.2f level=%s",
        best_template["id"], best_template.get("name", "?"), best_score, confidence_level,
    )

    return {
        "matched_template_id": best_template["id"],
        "matched_template_name": best_template.get("name", ""),
        "confidence": round(best_score, 4),
        "confidence_level": confidence_level,
        "field_id_map": best_field_id_map,
    }


def _no_match() -> dict[str, Any]:
    return {
        "matched_template_id": None,
        "matched_template_name": None,
        "confidence": 0.0,
        "confidence_level": "none",
        "field_id_map": {},
    }
