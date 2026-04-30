import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useUser } from '@/hooks/use-user';
import { isBoothBattleOrg } from '@/lib/boothBattle';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import {
  BOOTH_BATTLE_ORG_ID,
  type BoothBattleScore,
} from '@/types/boothBattle';

interface BoothBattleScoreRow extends BoothBattleScore {
  rank: number;
  objectsSpotted: number;
  archePalSpotted: number;
  siteName: string;
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1 mt-1 bg-[#1a0f08] rounded-full overflow-hidden">
      <div className="h-full bg-[#b8860b]" style={{ width: `${clamped}%` }} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#3a2415] border border-[#6a4226] rounded-lg p-3 sm:p-4">
      <div className="text-xs uppercase tracking-[0.1em] text-amber-200/60">{label}</div>
      <div className="text-xl sm:text-2xl font-bold text-[#d4a96a] mt-1 truncate">{value}</div>
    </div>
  );
}

export default function BoothBattleLeaderboard() {
  const { user, organization } = useUser();
  const otherOrgSession = !!user && !!organization && !isBoothBattleOrg(organization?.id);
  const [scores, setScores] = useState<BoothBattleScore[]>([]);
  const [recordedCounts, setRecordedCounts] = useState<Record<string, number>>({});
  const [siteNames, setSiteNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (otherOrgSession) return;
    if (!db) {
      setError('Firebase is not initialized.');
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'boothBattleScores'),
      where('orgId', '==', BOOTH_BATTLE_ORG_ID),
      orderBy('bestScore', 'desc'),
      orderBy('bestSubmittedAt', 'asc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: BoothBattleScore[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<BoothBattleScore, 'id'>),
        }));
        setScores(rows);
        setLoading(false);
      },
      (err) => {
        console.error('Leaderboard listener error', err);
        setError('Could not load the leaderboard.');
        setLoading(false);
      },
    );
    return () => unsub();
  }, [otherOrgSession]);

  useEffect(() => {
    if (otherOrgSession || !db) return;
    const unique = Array.from(new Set(scores.map((s) => s.siteId)));
    const missing = unique.filter((id) => !(id in recordedCounts));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(
          missing.map(async (siteId) => {
            const q = query(
              collection(db!, 'DigitalDiary'),
              where('siteId', '==', siteId),
              orderBy('keywordsExtractedAt', 'desc'),
              limit(1),
            );
            const snap = await getDocs(q);
            const data = snap.docs[0]?.data() as { keywords?: string[] } | undefined;
            return [siteId, data?.keywords?.length ?? 0] as const;
          }),
        );
        if (cancelled) return;
        setRecordedCounts((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      } catch (e) {
        console.error('Failed to fetch recorded keyword counts', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scores, otherOrgSession, recordedCounts]);

  useEffect(() => {
    if (otherOrgSession || !db) return;
    const unique = Array.from(new Set(scores.map((s) => s.siteId)));
    const missing = unique.filter((id) => !(id in siteNames));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(
          missing.map(async (siteId) => {
            const snap = await getDoc(doc(db!, 'Sites', siteId));
            const data = snap.data() as { name?: string } | undefined;
            return [siteId, data?.name ?? siteId] as const;
          }),
        );
        if (cancelled) return;
        setSiteNames((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      } catch (e) {
        console.error('Failed to fetch site names', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scores, otherOrgSession, siteNames]);

  const ranked: BoothBattleScoreRow[] = useMemo(() => {
    const pinned: BoothBattleScoreRow = {
      id: 'pinned-c54',
      orgId: BOOTH_BATTLE_ORG_ID,
      siteId: 'C54',
      visitorName: 'C54',
      visitorNameKey: 'c54',
      bestScore: 5000,
      bestKeywords: [],
      bestSubmittedAt: null as never,
      latestScore: 5000,
      latestKeywords: [],
      latestSubmittedAt: null as never,
      attemptCount: 0,
      createdAt: null as never,
      updatedAt: null as never,
      rank: 1,
      objectsSpotted: 100,
      archePalSpotted: 100,
      siteName: 'C54',
    };

    const rest: BoothBattleScoreRow[] = scores
      .filter((s) => s.siteId !== 'C54')
      .map((s) => ({
        ...s,
        rank: 0,
        objectsSpotted: s.bestKeywords?.length ?? 0,
        archePalSpotted: recordedCounts[s.siteId] ?? 0,
        siteName: siteNames[s.siteId] ?? '',
      }))
      .sort((a, b) => {
        if (b.archePalSpotted !== a.archePalSpotted) {
          return b.archePalSpotted - a.archePalSpotted;
        }
        const at = a.bestSubmittedAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
        const bt = b.bestSubmittedAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
        return at - bt;
      })
      .map((row, i) => ({ ...row, rank: i + 2 }));

    return [pinned, ...rest];
  }, [scores, recordedCounts, siteNames]);

  const stats = useMemo(() => {
    const boothsVisited = new Set(ranked.map((r) => r.siteId)).size;
    const topRow = ranked.reduce<BoothBattleScoreRow | null>((best, r) => {
      if (!best) return r;
      if (r.objectsSpotted > best.objectsSpotted) return r;
      if (r.objectsSpotted === best.objectsSpotted) {
        const bt = best.bestSubmittedAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
        const rt = r.bestSubmittedAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
        if (rt < bt) return r;
      }
      return best;
    }, null);
    return {
      boothsVisited,
      topObserver: topRow?.visitorName ?? '—',
    };
  }, [ranked]);

  if (otherOrgSession) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[#4a2c1a] text-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-50">
              Experience Archaeology Leaderboard
            </h1>
            <p className="text-sm text-amber-200/70">
              Top spotters at the booth — refreshed live.
            </p>
          </div>
          <Link to="/booth-battle/submit" className="shrink-0">
            <Button className="bg-[#b8860b] hover:bg-[#9a7308] text-[#1a0f08] font-semibold focus-visible:ring-[#b8860b]">
              Submit a score
            </Button>
          </Link>
        </div>

        {!loading && !error && ranked.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <StatCard label="Booths Visited" value={stats.boothsVisited} />
            <StatCard label="Top Observer" value={stats.topObserver} />
          </div>
        )}

        {loading ? (
          <Card className="bg-[#3a2415] border-[#6a4226] text-slate-100">
            <CardContent className="p-8 flex items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading leaderboard…
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="bg-[#3a2415] border-[#6a4226]">
            <CardContent className="p-6 text-sm text-red-400">{error}</CardContent>
          </Card>
        ) : ranked.length === 0 ? (
          <Card className="bg-[#3a2415] border-[#6a4226]">
            <CardContent className="p-8 text-center text-sm text-slate-400">
              No submissions yet.
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-[#3a2415] border-[#6a4226] text-slate-100">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#3a2415]/60">
                  <tr className="text-left border-b border-[#6a4226]">
                    <th className="px-4 py-3 text-xs uppercase tracking-[0.12em] font-semibold text-amber-200/80">
                      Name
                    </th>
                    <th className="px-4 py-3 text-xs uppercase tracking-[0.12em] font-semibold text-amber-200/80">
                      Team Name
                    </th>
                    <th className="px-4 py-3 text-xs uppercase tracking-[0.12em] font-semibold text-amber-200/80 text-right">
                      Objects<br />Spotted
                    </th>
                    <th className="px-4 py-3 text-xs uppercase tracking-[0.12em] font-semibold text-amber-200/80 text-right">
                      ArchePal<br />Spotted
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#6a4226]">
                  {ranked.map((row, idx) => {
                    const isTop = idx === 0;
                    const rowMax = Math.max(row.objectsSpotted, row.archePalSpotted, 1);
                    const objPct = (row.objectsSpotted / rowMax) * 100;
                    const apPct = (row.archePalSpotted / rowMax) * 100;
                    const showBars = row.objectsSpotted > 0 || row.archePalSpotted > 0;
                    const rowClass = isTop
                      ? 'bg-[#5b3a22] border-l-2 border-[#b8860b] hover:bg-[#5b3a22]/90 transition-colors'
                      : 'even:bg-[#3f2718]/40 hover:bg-[#5b3621]/50 transition-colors';
                    return (
                      <tr key={row.id} className={rowClass}>
                        <td className="px-4 py-4 align-top">
                          <span className="font-bold text-slate-50">{row.visitorName}</span>
                        </td>
                        <td className="px-4 py-4 align-top text-slate-200">{row.siteName}</td>
                        <td className="px-4 py-4 align-top text-right tabular-nums text-slate-100">
                          <div>{row.objectsSpotted}</div>
                          {showBars && <ProgressBar pct={objPct} />}
                        </td>
                        <td className="px-4 py-4 align-top text-right tabular-nums text-slate-100">
                          <div>{row.archePalSpotted}</div>
                          {showBars && <ProgressBar pct={apPct} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
