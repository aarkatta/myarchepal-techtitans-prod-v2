# iOS vs Android PDF Upload Feature Review

## Summary
The dynamic form template feature with PDF upload uses a unified API routing system through `src/lib/api.ts` that handles both web and native platform calls. Both iOS and Android should work the same way, but there are several potential issues on Android that need investigation.

## How API Routing Works (Current Implementation)

### `src/lib/api.ts` — The Key File
```typescript
const WEB_API_BASE = '';  // For web: uses relative paths (/api/...), proxied by Vite
const MOBILE_API_BASE = 'https://myarchepal.vercel.app';  // For native: absolute Vercel URL

export function apiUrl(path: string): string {
  return (Capacitor.isNativePlatform() ? MOBILE_API_BASE : WEB_API_BASE) + path;
}
```

This is used in `src/services/pdfParser.ts`:
```typescript
const res = await fetch(apiUrl('/api/parse-pdf'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... }),
});
```

**On iOS:** Works ✅ (you confirmed it's working)
**On Android:** Not working ❌

### Capacitor Configuration
`capacitor.config.ts` defines:
- `android: { allowMixedContent: true }` — allows HTTP on Android (but we use HTTPS)
- `server.allowNavigation` includes Firebase domains, but **NOT the Vercel domain**

## Potential Issues on Android

### 1. **Missing Vercel Domain in allowNavigation** 🔴 HIGH PRIORITY
**File:** `capacitor.config.ts` (lines 16-23)

**Current:**
```typescript
allowNavigation: [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'firebaseio.com',
  '*.firebaseio.com',
  '*.googleapis.com',
  '*.google.com'
]
```

**Issue:** `myarchepal.vercel.app` is NOT in the allowNavigation list. Android's Capacitor WebView may be blocking the cross-domain fetch.

**Fix:** Add to allowNavigation:
```typescript
allowNavigation: [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'firebaseio.com',
  '*.firebaseio.com',
  '*.googleapis.com',
  '*.google.com',
  'myarchepal.vercel.app',  // ADD THIS
  'vercel.app',              // OR this wildcard
]
```

---

### 2. **Android Network Security Config Missing** 🟡 MEDIUM PRIORITY
**Location:** `android/app/src/main/res/xml/`

**Current:** Only `config.xml` (Cordova) and `file_paths.xml` exist. No `network_security_config.xml`.

**Why it matters:**
- Android 9+ (API 28+) requires explicit security domains for cleartext AND HTTPS
- Even though we use HTTPS, Android may need an explicit domain configuration
- Different from iOS which trusts system roots by default

**Recommended Fix:** Create `android/app/src/main/res/xml/network_security_config.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">myarchepal.vercel.app</domain>
    <pin-set expiration="2026-12-31">
      <!-- Let Vercel handle certificate pinning -->
    </pin-set>
  </domain-config>
  
  <!-- Trust system CAs for all other domains -->
  <trust-anchors>
    <certificates src="system" />
  </trust-anchors>
</network-security-config>
```

Then reference in `AndroidManifest.xml`:
```xml
<application
  ...
  android:networkSecurityConfig="@xml/network_security_config"
  ...
>
```

---

### 3. **CORS Headers on Vercel FastAPI** 🟡 MEDIUM PRIORITY
**File:** `api/index.py` (lines 62-77)

**Current Status:** ✅ CORS is configured, but there's a potential issue with the wildcard pattern.

**Current Config:**
```python
allow_origins=[
    "http://localhost:8080",        # ✅ Vite dev
    "http://localhost:5173",        # ✅ Vite dev (default)
    "http://localhost:4173",        # ✅ Vite preview
    "https://*.vercel.app",         # ⚠️ Wildcard may not work with FastAPI-CORS
    "capacitor://localhost",        # ✅ iOS Capacitor
    "https://localhost",            # ✅ Android Capacitor
    "ionic://localhost",            # ✅ Ionic compatibility
]
```

**Issue:** The `https://*.vercel.app` wildcard pattern may not expand properly in FastAPI's CORSMiddleware. Wildcards in origin patterns are often treated literally, not as regex.

**Fix:** Replace the wildcard with your specific domain:
```python
allow_origins=[
    "http://localhost:8080",
    "http://localhost:5173",
    "http://localhost:4173",
    "https://myarchepal.vercel.app",  # Explicit domain instead of wildcard
    "capacitor://localhost",
    "https://localhost",
    "ionic://localhost",
]
```

---

### 4. **Firebase Auth Token on Native** 🟡 MEDIUM PRIORITY
**File:** `src/services/pdfParser.ts`

**Issue:** The API endpoint `POST /api/parse-pdf` may require Firebase authentication headers on production.

**Current code doesn't include auth token.** Check if:
- The `/api/parse-pdf` endpoint expects `Authorization: Bearer <token>`
- You need to add this before the fetch call

**Recommended approach:**
```typescript
import { getAuth } from 'firebase/auth';

export async function parsePdfTemplate(file: File, orgId: string): Promise<ParsedTemplate> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  
  const res = await fetch(apiUrl('/api/parse-pdf'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    body: JSON.stringify({
      base64_pdf: base64Pdf,
      file_name: file.name,
      org_id: orgId,
    }),
  });
  // ...
}
```

---

### 5. **Base64 Encoding on Large PDFs** 🟡 MEDIUM PRIORITY
**File:** `src/services/pdfParser.ts` (line 12-23)

**Issue:** Large PDFs (>5MB) may fail when encoded to base64 and sent as JSON. Base64 increases size by ~33%.

**Check:**
- Are you testing with large PDFs?
- Does a small PDF (< 1MB) work on Android?

**If large PDFs fail:** Consider uploading to Firebase Storage first, then passing Storage URL to the backend instead of base64.

---

## Debugging Steps for You

### 1. Enable Chrome DevTools on Android
```bash
# On Mac, with Android Studio open:
adb forward tcp:9222 localabstract:chrome_devtools_remote
# Then open: chrome://inspect in Chrome
```

### 2. Check the Network Tab
- Does the `POST /api/parse-pdf` request even leave the app?
- What HTTP status do you see? (e.g., 403, 504, ERR_CLEARTEXT_NOT_PERMITTED)

### 3. Check Firebase Console
- Is the user authenticated?
- Does their document exist in Firestore?

### 4. Test with curl on Your Mac
```bash
# Verify the Vercel backend is responding
curl -X POST https://myarchepal.vercel.app/api/parse-pdf \
  -H 'Content-Type: application/json' \
  -d '{"base64_pdf":"", "file_name":"test.pdf", "org_id":"YOUR_ORG_ID"}'
```

---

## Checklist for Fixes

- [ ] **Fix #1 (HIGH):** Add `myarchepal.vercel.app` to `capacitor.config.ts` allowNavigation
- [ ] **Fix #2 (MEDIUM):** Create Android network security config file
- [ ] **Fix #3 (MEDIUM):** Verify/add CORS middleware in `api/index.py`
- [ ] **Fix #4 (MEDIUM):** Add Firebase auth token to PDF parser fetch call
- [ ] **Fix #5 (LOW):** Test with multiple PDF sizes

---

## Platform Differences Identified

| Feature | iOS | Android | Status |
|---------|-----|---------|--------|
| API Routing (Vercel URL) | ✅ | ❌ Network/CORS issue | Needs fixing |
| Capacitor Core | ✅ | ✅ | OK |
| Firebase Auth | ✅ | ✅ | OK (but token not sent to API) |
| Network Stack | Native URLSession | WebView fetch | Different behavior |
| CORS Enforcement | Lenient | Strict | ⚠️ |
| Domain Whitelist | Not needed | ⚠️ Missing | Needs config |

---

## Next Steps

1. Apply Fix #1 immediately (it's the most likely culprit)
2. Run `npm run android` and test PDF upload
3. If still failing, apply Fix #2 + #3
4. Debug using Chrome DevTools (see above)
5. Report back with the network error you see in DevTools

---

## Files to Review

**Core routing:**
- `src/lib/api.ts` — API URL resolver

**PDF parsing:**
- `src/services/pdfParser.ts` — Fetch call to Vercel
- `src/pages/TemplateImportPDF.tsx` — UI that calls pdfParser

**Backend:**
- `api/index.py` — FastAPI CORS setup
- `api/routers/pdf.py` — PDF parsing endpoint

**Native config:**
- `capacitor.config.ts` — allowNavigation list
- `android/app/src/main/AndroidManifest.xml` — May need to reference network config

---

**Status:** Analysis complete. Awaiting your feedback on which fixes to apply.
