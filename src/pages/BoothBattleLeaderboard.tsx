import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useUser } from '@/hooks/use-user';
import { isBoothBattleOrg } from '@/lib/boothBattle';
import {
  collection,
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
}

export default function BoothBattleLeaderboard() {
  const { user, organization } = useUser();
  const otherOrgSession = !!user && !!organization && !isBoothBattleOrg(organization?.id);
  const [scores, setScores] = useState<BoothBattleScore[]>([]);
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
    };

    const rest: BoothBattleScoreRow[] = scores
      .filter((s) => s.siteId !== 'C54')
      .map((s) => ({
        ...s,
        rank: 0,
        objectsSpotted: s.bestKeywords?.length ?? 0,
        archePalSpotted: Math.round((s.bestScore ?? 0) / 50),
      }))
      .sort((a, b) => {
        if (b.objectsSpotted !== a.objectsSpotted) {
          return b.objectsSpotted - a.objectsSpotted;
        }
        const at = a.bestSubmittedAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
        const bt = b.bestSubmittedAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
        return at - bt;
      })
      .map((row, i) => ({ ...row, rank: i + 2 }));

    return [pinned, ...rest];
  }, [scores]);

  if (otherOrgSession) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-50">
          Experience Archaeology Leaderboard
        </h1>

        {loading ? (
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardContent className="p-8 flex items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading leaderboard…
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6 text-sm text-red-400">{error}</CardContent>
          </Card>
        ) : ranked.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-8 text-center text-sm text-slate-400">
              No submissions yet.
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/60">
                  <tr className="text-left text-slate-400 border-b border-slate-800">
                    <th className="px-4 py-3 font-normal w-16">Rank</th>
                    <th className="px-4 py-3 font-normal">Name</th>
                    <th className="px-4 py-3 font-normal">FW Team #</th>
                    <th className="px-4 py-3 font-normal">Team Name</th>
                    <th className="px-4 py-3 font-normal text-right">
                      Objects<br />Spotted
                    </th>
                    <th className="px-4 py-3 font-normal text-right">
                      ArchePal<br />Spotted
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {ranked.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-4 align-top text-base font-semibold text-slate-100">
                        {row.rank}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-bold text-slate-50">{row.visitorName}</div>
                        <div className="text-slate-400">
                          {row.visitorName}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-slate-400">
                        &nbsp;
                      </td>
                      <td className="px-4 py-4 align-top text-slate-200">{row.siteId}</td>
                      <td className="px-4 py-4 align-top text-right tabular-nums text-slate-100">
                        {row.objectsSpotted}
                      </td>
                      <td className="px-4 py-4 align-top text-right tabular-nums text-slate-100">
                        {row.archePalSpotted}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <div className="text-center pt-2">
          <Link to="/booth-battle/submit">
            <Button
              variant="outline"
              className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-slate-50"
            >
              Submit a score
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
