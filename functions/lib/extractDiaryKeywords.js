"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDiaryKeywords = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const firebase_functions_1 = require("firebase-functions");
const admin = __importStar(require("firebase-admin"));
const OPENAI_API_KEY = (0, params_1.defineSecret)("OPENAI_API_KEY");
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
exports.extractDiaryKeywords = (0, firestore_1.onDocumentWritten)({
    document: "DigitalDiary/{diaryId}",
    secrets: [OPENAI_API_KEY],
    region: "us-central1",
}, async (event) => {
    const diaryId = event.params.diaryId;
    const after = event.data?.after.data();
    if (!after) {
        firebase_functions_1.logger.debug(`[${diaryId}] doc deleted — skip`);
        return;
    }
    // Idempotency guard — our own write would otherwise re-trigger.
    if (Array.isArray(after.keywords) && after.keywords.length > 0) {
        firebase_functions_1.logger.debug(`[${diaryId}] keywords already present — skip`);
        return;
    }
    const category = String(after.category ?? "").toLowerCase();
    if (category !== TARGET_CATEGORY) {
        firebase_functions_1.logger.debug(`[${diaryId}] category="${category}" — skip`);
        return;
    }
    const siteId = after.siteId;
    if (!siteId) {
        firebase_functions_1.logger.debug(`[${diaryId}] no siteId — skip`);
        return;
    }
    const db = admin.firestore();
    const siteSnap = await db.collection("Sites").doc(siteId).get();
    if (!siteSnap.exists) {
        firebase_functions_1.logger.warn(`[${diaryId}] linked site ${siteId} not found — skip`);
        return;
    }
    if (siteSnap.data()?.organizationId !== TARGET_ORG_ID) {
        firebase_functions_1.logger.debug(`[${diaryId}] site org mismatch — skip`);
        return;
    }
    const content = after.content ?? "";
    const aiImageSummary = after.aiImageSummary ?? "";
    const sourceText = [content, aiImageSummary]
        .map((s) => s.trim())
        .filter(Boolean)
        .join("\n\n");
    if (!sourceText) {
        firebase_functions_1.logger.debug(`[${diaryId}] no source text — skip`);
        return;
    }
    let keywords;
    try {
        keywords = await callOpenAI(sourceText, OPENAI_API_KEY.value());
    }
    catch (err) {
        firebase_functions_1.logger.error(`[${diaryId}] OpenAI call failed`, err);
        return;
    }
    if (keywords.length === 0) {
        firebase_functions_1.logger.warn(`[${diaryId}] OpenAI returned no keywords`);
        return;
    }
    await event.data.after.ref.update({
        keywords,
        keywordsExtractedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    firebase_functions_1.logger.info(`[${diaryId}] wrote ${keywords.length} keywords`);
});
async function callOpenAI(text, apiKey) {
    const body = {
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
            {
                role: "system",
                content: "Extract exactly 5 distinctive keywords or short phrases from the booth description. " +
                    "Focus on concrete, specific nouns: technical mechanisms, mission themes, materials, " +
                    "team identifiers, mascots, or unique design elements. " +
                    'Avoid generic words like "team", "robot", "lego", "fun", "kids" that would apply ' +
                    "to most FLL booths. Single words preferred over phrases when possible. " +
                    'Return strict JSON of the form {"keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]}.',
            },
            { role: "user", content: text },
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
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed.keywords) ? parsed.keywords : [];
    return arr
        .map((k) => String(k).trim())
        .filter((k) => k.length > 0)
        .slice(0, 5);
}
//# sourceMappingURL=extractDiaryKeywords.js.map