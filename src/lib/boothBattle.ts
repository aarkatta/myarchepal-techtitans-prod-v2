import { BOOTH_BATTLE_ORG_ID } from '@/types/boothBattle';
import { parseDate } from './utils';

export { BOOTH_BATTLE_ORG_ID };

export function isBoothBattleOrg(orgId: string | undefined | null): boolean {
  return orgId === BOOTH_BATTLE_ORG_ID;
}

export function normalizeKeyword(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugifyName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

const HOUSTON_TZ = 'America/Chicago';

export function formatHoustonTime(
  value: unknown,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  },
): string {
  const date = parseDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: HOUSTON_TZ }).format(date);
}

export function countKeywordMatches(submitted: string[], recorded: string[]): number {
  const recordedSet = new Set(recorded.map(normalizeKeyword).filter(Boolean));
  const seen = new Set<string>();
  let matches = 0;
  for (const raw of submitted) {
    const normalized = normalizeKeyword(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    if (recordedSet.has(normalized)) matches += 1;
  }
  return matches;
}

export function scoreFromMatches(matches: number): number {
  return Math.max(0, Math.min(5, matches)) * 50;
}

export function naturalSiteCompare(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}
