import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useUser } from '@/hooks/use-user';
import { isBoothBattleOrg } from '@/lib/boothBattle';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, ChevronsUpDown, Loader2, Sparkles, PartyPopper, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  BoothBattleService,
  type BoothBattleSiteOption,
} from '@/services/boothBattle';

const formSchema = z.object({
  siteId: z.string().min(1, 'Pick the booth you visited'),
  visitorName: z
    .string()
    .min(1, 'Enter your team or visitor name')
    .max(80, 'Name is too long'),
  k0: z.string().min(1, 'Required'),
  k1: z.string().min(1, 'Required'),
  k2: z.string().min(1, 'Required'),
  k3: z.string().min(1, 'Required'),
  k4: z.string().min(1, 'Required'),
});

type FormValues = z.infer<typeof formSchema>;

type ViewState =
  | { kind: 'form' }
  | { kind: 'submitting' }
  | { kind: 'thanks'; siteName: string }
  | { kind: 'error'; message: string };

export default function BoothBattleSubmit() {
  const { user, organization } = useUser();
  const otherOrgSession = !!user && !!organization && !isBoothBattleOrg(organization?.id);
  const [sites, setSites] = useState<BoothBattleSiteOption[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [sitesError, setSitesError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [view, setView] = useState<ViewState>({ kind: 'form' });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { siteId: '', visitorName: '', k0: '', k1: '', k2: '', k3: '', k4: '' },
  });

  const siteId = form.watch('siteId');
  const selectedSite = useMemo(
    () => sites.find((s) => s.id === siteId) ?? null,
    [sites, siteId],
  );

  useEffect(() => {
    let cancelled = false;
    setSitesLoading(true);
    BoothBattleService.listSites()
      .then((rows) => {
        if (!cancelled) setSites(rows);
      })
      .catch((err) => {
        console.error('Failed to load booth list', err);
        if (!cancelled) setSitesError('Could not load booths. Please refresh.');
      })
      .finally(() => {
        if (!cancelled) setSitesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = form.handleSubmit(async (values) => {
    setView({ kind: 'submitting' });
    const siteName =
      sites.find((s) => s.id === values.siteId)?.name ?? values.siteId;
    try {
      await BoothBattleService.submitAttempt({
        siteId: values.siteId,
        visitorName: values.visitorName,
        submittedKeywords: [values.k0, values.k1, values.k2, values.k3, values.k4],
      });
      setView({ kind: 'thanks', siteName });
    } catch (err) {
      console.error('Submit failed', err);
      setView({
        kind: 'error',
        message:
          err instanceof Error ? err.message : 'Could not submit. Please try again.',
      });
    }
  });

  if (otherOrgSession) {
    return <Navigate to="/" replace />;
  }

  const handleSubmitAnother = () => {
    form.reset({
      siteId: '',
      visitorName: form.getValues('visitorName'),
      k0: '',
      k1: '',
      k2: '',
      k3: '',
      k4: '',
    });
    setView({ kind: 'form' });
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Booth Battle
            </span>
          </div>
          <h1 className="text-2xl font-bold">Score Your Visit</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick the booth you just visited and list 5 keywords you remember.
          </p>
        </div>

        {view.kind === 'form' && (
          <Card>
            <CardContent className="p-4 sm:p-6 space-y-4">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Booth visited</Label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={pickerOpen}
                        disabled={sitesLoading || !!sitesError}
                        className="w-full justify-between font-normal"
                      >
                        {sitesLoading
                          ? 'Loading booths…'
                          : selectedSite
                          ? selectedSite.name
                          : 'Select a booth'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Search booths…" />
                        <CommandList>
                          <CommandEmpty>No booth found.</CommandEmpty>
                          <CommandGroup>
                            {sites.map((s) => (
                              <CommandItem
                                key={s.id}
                                value={s.name}
                                onSelect={() => {
                                  form.setValue('siteId', s.id, {
                                    shouldValidate: true,
                                  });
                                  setPickerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4',
                                    s.id === siteId ? 'opacity-100' : 'opacity-0',
                                  )}
                                />
                                {s.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {sitesError && (
                    <p className="text-xs text-destructive">{sitesError}</p>
                  )}
                  {form.formState.errors.siteId && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.siteId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visitorName">Your team or name</Label>
                  <Input
                    id="visitorName"
                    autoComplete="off"
                    placeholder="e.g. C42"
                    {...form.register('visitorName')}
                  />
                  {form.formState.errors.visitorName && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.visitorName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>5 keywords from the booth</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {(['k0', 'k1', 'k2', 'k3', 'k4'] as const).map((name, i) => {
                      const err = form.formState.errors[name];
                      return (
                        <div key={name}>
                          <Input
                            autoComplete="off"
                            placeholder={`Keyword ${i + 1}`}
                            {...form.register(name)}
                          />
                          {err && (
                            <p className="text-[10px] text-destructive mt-0.5">
                              {err.message}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Submit
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {view.kind === 'submitting' && (
          <Card>
            <CardContent className="p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending your submission…
            </CardContent>
          </Card>
        )}

        {view.kind === 'thanks' && (
          <Card className="border-emerald-200 dark:border-emerald-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PartyPopper className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                Thank you for participating!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Your entry for <strong>{view.siteName}</strong> has been
                recorded. Scores will appear on the leaderboard once they’re
                tallied.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={handleSubmitAnother} className="w-full">
                  Submit another
                </Button>
                <Link to="/booth-battle" className="w-full">
                  <Button variant="outline" className="w-full">
                    View leaderboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {view.kind === 'error' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive text-base">
                <AlertCircle className="w-5 h-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{view.message}</p>
              <Button onClick={handleSubmitAnother} className="w-full">
                Back to form
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Link
            to="/booth-battle"
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            View leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
