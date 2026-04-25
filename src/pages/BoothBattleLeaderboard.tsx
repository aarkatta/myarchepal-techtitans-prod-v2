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
import { Loader2, Sparkles, Trophy, ArrowUp, Crown, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import {
  BOOTH_BATTLE_ORG_ID,
  type BoothBattleScore,
} from '@/types/boothBattle';
import { formatHoustonTime } from '@/lib/boothBattle';

const PERFECT = 250;

interface BoothBattleScoreRow extends BoothBattleScore {
  rank: number;
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

  if (otherOrgSession) {
    return <Navigate to="/" replace />;
  }

  const ranked: BoothBattleScoreRow[] = useMemo(
    () => scores.map((s, i) => ({ ...s, rank: i + 1 })),
    [scores],
  );

  const stats = useMemo(() => {
    const total = ranked.length;
    const top = ranked[0]?.bestScore ?? 0;
    const perfects = ranked.filter((r) => r.bestScore === PERFECT).length;
    return { total, top, perfects };
  }, [ranked]);

  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Booth Battle
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">Leaderboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live standings for the FLL 2026 World Championship · Houston
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Players" value={stats.total} />
          <StatCard label="Top score" value={stats.top} />
          <StatCard label="Perfect 5/5" value={stats.perfects} />
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading leaderboard…
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : ranked.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No submissions yet — be the first!
              <div className="mt-4">
                <Link to="/booth-battle/submit">
                  <Button>Submit a score</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <Podium rows={podium} />
            {rest.length > 0 && (
              <Card>
                <CardContent className="p-0 divide-y divide-border">
                  {rest.map((row) => (
                    <LeaderboardRow key={row.id} row={row} />
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        <div className="text-center pt-2">
          <Link to="/booth-battle/submit">
            <Button variant="outline">Submit a score</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <div className="text-xl sm:text-2xl font-bold">{value}</div>
        <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </div>
      </CardContent>
    </Card>
  );
}

function Podium({ rows }: { rows: BoothBattleScoreRow[] }) {
  if (rows.length === 0) return null;
  // Render in 2-1-3 visual order so #1 is centered.
  const order = [rows[1], rows[0], rows[2]].filter(Boolean) as BoothBattleScoreRow[];
  return (
    <div className="grid grid-cols-3 gap-2 items-end">
      {order.map((row) => {
        const isFirst = row.rank === 1;
        const heightClass = isFirst ? 'pt-6' : 'pt-3';
        return (
          <Card
            key={row.id}
            className={cn(
              'border',
              isFirst
                ? 'border-yellow-400 dark:border-yellow-500'
                : row.rank === 2
                ? 'border-gray-300 dark:border-gray-500'
                : 'border-amber-700/40',
            )}
          >
            <CardContent className={`p-3 text-center ${heightClass}`}>
              <div className="flex items-center justify-center mb-1">
                {isFirst ? (
                  <Crown className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Trophy
                    className={`w-4 h-4 ${
                      row.rank === 2
                        ? 'text-gray-400'
                        : 'text-amber-700/70'
                    }`}
                  />
                )}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                #{row.rank}
              </div>
              <div className="text-lg font-bold mt-1 truncate" title={row.siteId}>
                {row.bestScore}
              </div>
              <div className="text-xs font-medium truncate" title={row.visitorName}>
                {row.visitorName}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {row.siteId}
              </div>
              {row.bestScore === PERFECT && (
                <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  <Star className="w-2.5 h-2.5" /> PERFECT
                </span>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function LeaderboardRow({ row }: { row: BoothBattleScoreRow }) {
  const isPerfect = row.bestScore === PERFECT;
  const wasRetake = row.attemptCount > 1 && row.latestScore !== row.bestScore;
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="w-8 text-center text-sm font-semibold text-muted-foreground">
        #{row.rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{row.visitorName}</span>
          <span className="text-xs text-muted-foreground">{row.siteId}</span>
          {isPerfect && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <Star className="w-2.5 h-2.5" /> PERFECT
            </span>
          )}
          {wasRetake && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground"
              title="Best score from an earlier attempt"
            >
              <ArrowUp className="w-3 h-3" />
              best
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
          {row.bestKeywords?.slice(0, 5).map((kw, i) => (
            <span
              key={`${row.id}-${i}-${kw}`}
              className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500/60"
              title={kw}
            />
          ))}
          <span className="text-[10px] text-muted-foreground ml-1">
            {formatHoustonTime(row.bestSubmittedAt)}
          </span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-base font-bold tabular-nums">{row.bestScore}</div>
        {wasRetake && (
          <div className="text-[10px] text-muted-foreground tabular-nums">
            latest {row.latestScore}
          </div>
        )}
      </div>
    </div>
  );
}

