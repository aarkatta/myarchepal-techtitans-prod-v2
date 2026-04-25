# iOS vs Android: PDF Upload Feature Parity Analysis

## Executive Summary

Your PDF upload feature works on **iOS but not Android** due to a **WebView security restriction** on Android. The Capacitor WebView on Android requires explicit domain allowlisting in `capacitor.config.ts`.

---

## How the Feature Works (Both Platforms)

### 1. **Unified API Routing** (`src/lib/api.ts`)
Both iOS and Android use the same routing mechanism:

```typescript
const MOBILE_API_BASE = 'https://myarchepal.vercel.app';

export function apiUrl(path: string): string {
  return (Capacitor.isNativePlatform() ? MOBILE_API_BASE : WEB_API_BASE) + path;
}
```

When running natively (iOS/Android), this prepends `https://myarchepal.vercel.app` to all `/api/*` paths.

### 2. **PDF Upload Flow**
```
User selects PDF
  → TemplateImportPDF.tsx calls parsePdfTemplate()
    → pdfParser.ts: fetch(apiUrl('/api/parse-pdf'), {...})
      → (Web) Vite proxy → localhost:8000/api/parse-pdf
      → (Native) Direct → https://myarchepal.vercel.app/api/parse-pdf
        → FastAPI processes, calls OpenAI GPT-4o
        → Returns parsed template (sections, fields)
```

---

## Why iOS Works But Android Doesn't

### iOS WebView (`WKWebView`)
- **Permissive network rules:** Allows requests to external domains by default
- **Trust model:** Uses system certificate authorities
- **No domain allowlisting needed:** Works out of the box for HTTPS domains

### Android WebView (`AndroidWebView`)
- **Restrictive security by default:** Blocks cross-domain requests unless explicitly allowed
- **Requires `allowNavigation` config:** Must whitelist any external domains
- **Strict CORS enforcement:** Applies CORS rules more aggressively than browsers

---

## The Fix Applied

### Fix #1: Add Vercel Domain to `allowNavigation` (capacitor.config.ts)
```typescript
allowNavigation: [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'firebaseio.com',
  '*.firebaseio.com',
  '*.googleapis.com',
  '*.google.com',
  'myarchepal.vercel.app',  // ← ADDED: Allow PDF parsing API calls
]
```

**Why:** Android's Capacitor WebView checks this list before allowing fetch/XMLHttpRequest to external domains. Without it, requests are silently blocked.

### Fix #2: Use Explicit Domain in CORS Config (api/index.py)
```python
allow_origins=[
    "http://localhost:8080",
    "https://myarchepal.vercel.app",  # ← Changed from wildcard "https://*.vercel.app"
    "capacitor://localhost",
    "https://localhost",
]
```

**Why:** FastAPI's CORSMiddleware may not properly expand wildcard patterns. Explicit domains are more reliable.

---

## Testing the Fix

### Step 1: Rebuild and Deploy
```bash
npm run build
# Deploy to Vercel (if using automated CI/CD) or manually via:
vercel
```

### Step 2: Rebuild Android App
```bash
npm run android
# This will:
# 1. Build React (npm run build)
# 2. Sync Capacitor (npx cap sync android)
# 3. Open Android Studio
```

### Step 3: Test PDF Upload
1. Open app on Android device
2. Navigate to Template List → "New Template" → "Upload PDF"
3. Select a PDF file
4. Click "Extract Form Now"

**Expected behavior:**
- ✅ "Analyzing PDF..." skeleton shows for 30-45 seconds
- ✅ Review page loads with parsed sections/fields
- ✅ Save as Draft works

**If still failing:**
- Check Android Studio's Logcat for network errors
- Enable Chrome DevTools debugging (see ANDROID_REVIEW.md)

---

## Platform-Specific Implementation Details

| Aspect | iOS | Android | Notes |
|--------|-----|---------|-------|
| **WebView Type** | WKWebView | AndroidWebView | Different engines |
| **Network Restrictions** | Permissive | Restrictive | Requires allowNavigation |
| **CORS Enforcement** | Lenient | Strict | Android WebView applies CORS checks |
| **Certificate Validation** | System CAs | System CAs | Both verify SSL/TLS |
| **Domain Allowlist** | None (uses default) | `capacitor.config.ts` allowNavigation | Android only |
| **API Routing** | Same: `src/lib/api.ts` | Same: `src/lib/api.ts` | Unified code |
| **Fetch API** | ✅ Works | ✅ Works (with allowNavigation) | Both use standard fetch |

---

## Key Takeaway

The PDF upload feature uses **identical code** on both platforms via `src/lib/api.ts`. The difference is that **Android's WebView requires explicit security configuration** to allow outbound requests to the Vercel backend domain. iOS doesn't require this because its WKWebView is more permissive by default.

---

## Files Modified

1. ✅ `capacitor.config.ts` — Added `myarchepal.vercel.app` to allowNavigation
2. ✅ `api/index.py` — Updated CORS to use explicit domain instead of wildcard

---

## Next Steps

1. Run `npm run android` to rebuild and test
2. Verify PDF upload works on Android
3. If issues persist, enable Chrome DevTools debugging (documented in ANDROID_REVIEW.md)
4. Report any network errors back to me

---

## Additional Resources

- **Capacitor Security Docs:** https://capacitorjs.com/docs/basics/configuring-your-app#server
- **Android WebView CORS:** https://developer.android.com/develop/ui/views/layout/webapps/same-origin-policy
- **Firebase Connectivity:** Your allowNavigation already covers Firebase domains (googleapis.com, firebaseio.com)
