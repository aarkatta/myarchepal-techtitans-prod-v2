import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const TARGET_ORG_ID = "vD4x5sGreTsscAp66FgA";
const TARGET_CATEGORY = "site"; // diary category is stored lowercase
const OPENAI_MODEL = "gpt-5.4-mini";

/**
 * Triggered on writes to DigitalDiary/{diaryId}.
 *
 * Extracts keywords from `content` + `aiImageSummary` via OpenAI when:
 *   - the doc still exists (not deleted),
 *   - category === "site",
 *   - the linked Site belongs to org vD4x5sGreTsscAp66FgA,
 *   - keywords have not already been extracted (idempotent — prevents loop
 *     when this function writes them back),
 *   - there is non-empty source text.
 */
export const extractDiaryKeywords = onDocumentWritten(
  {
    document: "DigitalDiary/{diaryId}",
    secrets: [OPENAI_API_KEY],
    region: "us-central1",
  },
  async (event) => {
    const diaryId = event.params.diaryId;
    const after = event.data?.after.data();

    if (!after) {
      logger.debug(`[${diaryId}] doc deleted — skip`);
      return;
    }

    // Idempotency guard — our own write would otherwise re-trigger.
    if (Array.isArray(after.keywords) && after.keywords.length > 0) {
      logger.debug(`[${diaryId}] keywords already present — skip`);
      return;
    }

    const category = String(after.category ?? "").toLowerCase();
    if (category !== TARGET_CATEGORY) {
      logger.debug(`[${diaryId}] category="${category}" — skip`);
      return;
    }

    const siteId: string | undefined = after.siteId;
    if (!siteId) {
      logger.debug(`[${diaryId}] no siteId — skip`);
      return;
    }

    const db = admin.firestore();
    const siteSnap = await db.collection("Sites").doc(siteId).get();
    if (!siteSnap.exists) {
      logger.warn(`[${diaryId}] linked site ${siteId} not found — skip`);
      return;
    }
    if (siteSnap.data()?.organizationId !== TARGET_ORG_ID) {
      logger.debug(`[${diaryId}] site org mismatch — skip`);
      return;
    }

    const content: string = after.content ?? "";
    const aiImageSummary: string = after.aiImageSummary ?? "";
    const sourceText = [content, aiImageSummary]
      .map((s) => s.trim())
      .filter(Boolean)
      .join("\n\n");

    if (!sourceText) {
      logger.debug(`[${diaryId}] no source text — skip`);
      return;
    }

    let keywords: string[];
    try {
      keywords = await callOpenAI(sourceText, OPENAI_API_KEY.value());
    } catch (err) {
      logger.error(`[${diaryId}] OpenAI call failed`, err);
      return;
    }

    if (keywords.length === 0) {
      logger.warn(`[${diaryId}] OpenAI returned no keywords`);
      return;
    }

    await event.data!.after.ref.update({
      keywords,
      keywordsExtractedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`[${diaryId}] wrote ${keywords.length} keywords`);
  }
);

async function callOpenAI(text: string, apiKey: string): Promise<string[]> {
  const body = {
    model: OPENAI_MODEL,
    response_format: { type: "json_object" as const },
    temperature: 0.2,
    messages: [
      {
        role: "system" as const,
        content:
          "Extract every distinctive keyword or short phrase from the booth description. " +
          "Include all concrete, specific nouns you can find: technical mechanisms, mission " +
          "themes, materials, team identifiers, mascots, unique design elements, tools, " +
          "techniques, and notable details. Be thorough — capture anything a visitor might " +
          "remember about this booth. " +
          'Avoid only the most generic words like "team", "robot", "lego", "fun", "kids" that ' +
          "would apply to most FLL booths. Single words preferred over phrases when possible. " +
          "Do not invent keywords that are not supported by the source text. " +
          'Return strict JSON of the form {"keywords": ["keyword1", "keyword2", ...]} ' +
          "with as many keywords as the description supports.",
      },
      { role: "user" as const, content: text },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText}`);
  }

  const json: any = await res.json();
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);
  const arr = Array.isArray(parsed.keywords) ? parsed.keywords : [];
  return arr
    .map((k: unknown) => String(k).trim())
    .filter((k: string) => k.length > 0);
}
