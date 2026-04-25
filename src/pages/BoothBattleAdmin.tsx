import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { Loader2, Pencil, Trash2, ArrowLeft, RotateCcw, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { useUser } from '@/hooks/use-user';
import { isBoothBattleOrg, formatHoustonTime } from '@/lib/boothBattle';
import {
  BOOTH_BATTLE_ORG_ID,
  type BoothBattleScore,
} from '@/types/boothBattle';
import { BoothBattleService } from '@/services/boothBattle';

export default function BoothBattleAdmin() {
  const navigate = useNavigate();
  const { organization, isSuperAdmin } = useUser();
  const allowed = isSuperAdmin || isBoothBattleOrg(organization?.id);

  const [scores, setScores] = useState<BoothBattleScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<BoothBattleScore | null>(null);
  const [editName, setEditName] = useState('');
  const [editKeywords, setEditKeywords] = useState<string[]>(['', '', '', '', '']);
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BoothBattleScore | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [reprocessing, setReprocessing] = useState(false);

  useEffect(() => {
    if (!db || !allowed) {
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
        setScores(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<BoothBattleScore, 'id'>),
          })),
        );
        setLoading(false);
      },
      (err) => {
        console.error('Admin leaderboard listener error', err);
        setError('Could not load scores.');
        setLoading(false);
      },
    );
    return () => unsub();
  }, [allowed]);

  const totals = useMemo(
    () => ({
      players: scores.length,
      perfects: scores.filter((s) => s.bestScore === 250).length,
    }),
    [scores],
  );

  if (!allowed) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-md text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Booth Battle admin is only available to admins of the FLL Houston
            organization.
          </p>
          <Button variant="outline" onClick={() => navigate('/')}>
            Back home
          </Button>
        </div>
      </div>
    );
  }

  const openEdit = (row: BoothBattleScore) => {
    setEditing(row);
    setEditName(row.visitorName);
    const k = [...(row.bestKeywords ?? [])];
    while (k.length < 5) k.push('');
    setEditKeywords(k.slice(0, 5));
  };

  const closeEdit = () => {
    if (editSaving) return;
    setEditing(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editName.trim()) {
      toast.error('Visitor name is required');
      return;
    }
    if (editKeywords.some((k) => !k.trim())) {
      toast.error('All 5 keywords are required');
      return;
    }
    setEditSaving(true);
    try {
      await BoothBattleService.adminEditScore(
        editing.id,
        editName.trim(),
        editKeywords.map((k) => k.trim()),
      );
      toast.success('Saved — re-scoring…');
      setEditing(null);
    } catch (err) {
      console.error('Edit failed', err);
      toast.error(
        err instanceof Error ? err.message : 'Failed to save edit',
      );
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await BoothBattleService.adminDeleteScore(deleteTarget.id);
      toast.success(`Removed ${deleteTarget.visitorName}`);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const result = await BoothBattleService.adminReprocessPending();
      const total = result.total ?? 0;
      if (total === 0) {
        toast.success('No pending submissions to reprocess.');
      } else {
        toast.success(
          `Reprocessed ${total}: ${result.scored ?? 0} scored, ${
            result.rejected ?? 0
          } rejected, ${result.skipped ?? 0} skipped.`,
        );
      }
    } catch (err) {
      console.error('Reprocess failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to reprocess');
    } finally {
      setReprocessing(false);
    }
  };

  const confirmReset = async () => {
    setResetting(true);
    try {
      const result = await BoothBattleService.adminResetAll();
      toast.success(
        `Reset complete — removed ${result.scoresDeleted ?? 0} scores and ${
          result.submissionsDeleted ?? 0
        } submissions.`,
      );
      setResetOpen(false);
    } catch (err) {
      console.error('Reset failed', err);
      toast.error(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReprocess}
              disabled={reprocessing}
            >
              {reprocessing ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1" />
              )}
              Reprocess pending
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw className="w-4 h-4 mr-1" /> Reset all
            </Button>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold">Booth Battle — Host Controls</h1>
          <p className="text-sm text-muted-foreground">
            {totals.players} players · {totals.perfects} perfect 5/5
          </p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : scores.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              No scores yet.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {scores.map((row, i) => (
                <div
                  key={row.id}
                  className="flex items-center gap-3 p-3"
                >
                  <div className="w-8 text-center text-sm font-semibold text-muted-foreground">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">
                        {row.visitorName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {row.siteId}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {row.attemptCount}× attempts
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {row.bestKeywords?.map((kw, ix) => (
                        <span
                          key={`${row.id}-${ix}-${kw}`}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      best at {formatHoustonTime(row.bestSubmittedAt)}
                    </div>
                  </div>
                  <div className="text-right pr-1">
                    <div className="text-base font-bold tabular-nums">
                      {row.bestScore}
                    </div>
                    {row.latestScore !== row.bestScore && (
                      <div className="text-[10px] text-muted-foreground tabular-nums">
                        latest {row.latestScore}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(row)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
            <DialogDescription>
              Replaces the score with a re-scored submission. Attempt count
              resets to 1.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="adm-name">Visitor name</Label>
              <Input
                id="adm-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Keywords (5)</Label>
              {editKeywords.map((k, i) => (
                <Input
                  key={i}
                  value={k}
                  onChange={(e) => {
                    const next = [...editKeywords];
                    next[i] = e.target.value;
                    setEditKeywords(next);
                  }}
                  placeholder={`Keyword ${i + 1}`}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.visitorName} ({deleteTarget?.siteId}) — best score{' '}
              {deleteTarget?.bestScore}. This deletes the leaderboard row but
              preserves the submission history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={resetOpen}
        onOpenChange={(open) => !resetting && setResetOpen(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the entire Booth Battle?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes every score and every submission. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmReset();
              }}
              disabled={resetting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {resetting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Reset everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
