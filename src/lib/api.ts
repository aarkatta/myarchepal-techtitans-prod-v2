import { Capacitor } from '@capacitor/core';

/**
 * Base URL for web — empty string so all /api/* paths remain relative.
 * Works via Vite proxy in dev and Vercel routing in production.
 */
const WEB_API_BASE = '';

/**
 * Base URL for native mobile (iOS / Android via Capacitor).
 * Capacitor loads the app from a local scheme with no proxy, so API calls
 * must be absolute and point to the production Vercel deployment.
 */
const MOBILE_API_BASE = 'https://myarchepal.vercel.app';

/**
 * Returns the full URL for a backend API path.
 * Use this instead of bare fetch('/api/...') so calls work on both web and native mobile.
 *
 * @example
 *   fetch(apiUrl('/api/parse-pdf'), { method: 'POST', ... })
 */
export function apiUrl(path: string): string {
  return (Capacitor.isNativePlatform() ? MOBILE_API_BASE : WEB_API_BASE) + path;
}
