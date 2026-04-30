import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useUser } from '@/hooks/use-user';
import { isBoothBattleOrg, normalizeKeyword } from '@/lib/boothBattle';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, ChevronsUpDown, Loader2, Sparkles, PartyPopper, AlertCircle, X } from 'lucide-react';
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

const MAX_KEYWORDS = 100;

const formSchema = z.object({
  siteId: z.string().min(1, 'Pick the booth you visited'),
  visitorName: z
    .string()
    .min(1, 'Enter your team or visitor name')
    .max(80, 'Name is too long'),
  visitorEmail: z
    .string()
    .min(1, 'Enter your email')
    .email('Enter a valid email')
    .max(200, 'Email is too long'),
  keywords: z
    .array(z.string().min(1))
    .min(1, 'Add at least one keyword')
    .max(MAX_KEYWORDS, `Up to ${MAX_KEYWORDS} keywords`),
});

type FormValues = z.infer<typeof formSchema>;

interface KeywordChipInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

function KeywordChipInput({ value, onChange, disabled }: KeywordChipInputProps) {
  const [draft, setDraft] = useState('');

  const addTokens = (raw: string) => {
    const tokens = raw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length === 0) return;
    const seen = new Set(value.map(normalizeKeyword));
    const next = [...value];
    for (const t of tokens) {
      if (next.length >= MAX_KEYWORDS) break;
      const key = normalizeKeyword(t);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      next.push(t);
    }
    onChange(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (draft.trim()) {
        addTokens(draft);
        setDraft('');
      }
      return;
    }
    if (e.key === 'Backspace' && draft.length === 0 && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (draft.trim()) {
      addTokens(draft);
      setDraft('');
    }
  };

  const removeAt = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };

  const atLimit = value.length >= MAX_KEYWORDS;

  return (
    <div className="space-y-2">
      <Input
        autoComplete="off"
        placeholder={
          atLimit
            ? `Limit reached (${MAX_KEYWORDS})`
            : 'Type a keyword, press Enter or use commas'
        }
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={disabled || atLimit}
        className="bg-[#2a1a10] border-[#6a4226] text-slate-100 placeholder:text-amber-200/30 focus-visible:ring-[#b8860b]"
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((kw, i) => (
            <span
              key={`${kw}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-[#b8860b]/20 text-[#d4a96a] border border-[#b8860b]/30 px-2.5 py-1 text-xs font-medium"
            >
              {kw}
              <button
                type="button"
                onClick={() => removeAt(i)}
                disabled={disabled}
                className="rounded-full hover:bg-[#b8860b]/30 p-0.5 transition-colors"
                aria-label={`Remove ${kw}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-[11px] text-amber-200/60">
        {value.length} / {MAX_KEYWORDS} keywords
      </p>
    </div>
  );
}

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
    defaultValues: {
      siteId: '',
      visitorName: '',
      visitorEmail: '',
      keywords: [],
    },
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
        visitorEmail: values.visitorEmail,
        submittedKeywords: values.keywords,
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
      visitorEmail: form.getValues('visitorEmail'),
      keywords: [],
    });
    setView({ kind: 'form' });
  };

  const inputClass =
    'bg-[#2a1a10] border-[#6a4226] text-slate-100 placeholder:text-amber-200/30 focus-visible:ring-[#b8860b]';
  const brassButtonClass =
    'bg-[#b8860b] hover:bg-[#9a7308] text-[#1a0f08] font-semibold focus-visible:ring-[#b8860b]';

  return (
    <div className="min-h-screen bg-[#4a2c1a] text-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-[#d4a96a] mb-1">
            <Sparkles className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Booth Battle
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-50">Score Your Visit</h1>
          <p className="text-sm text-amber-200/70 mt-1">
            Pick the booth you just visited and list the keywords you remember.
          </p>
        </div>

        {view.kind === 'form' && (
          <Card className="bg-[#3a2415] border-[#6a4226]">
            <CardContent className="p-4 sm:p-6 space-y-4">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-amber-100">Booth visited</Label>
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={pickerOpen}
                        disabled={sitesLoading || !!sitesError}
                        className="w-full justify-between font-normal bg-[#2a1a10] border-[#6a4226] text-slate-100 hover:bg-[#5b3621] hover:text-slate-100 focus-visible:ring-[#b8860b]"
                      >
                        {sitesLoading
                          ? 'Loading booths…'
                          : selectedSite
                          ? selectedSite.name
                          : 'Select a booth'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-[#2a1a10] border-[#6a4226]">
                      <Command className="bg-transparent">
                        <CommandInput
                          placeholder="Search booths…"
                          className="text-slate-100 placeholder:text-amber-200/40"
                        />
                        <CommandList>
                          <CommandEmpty className="text-amber-200/60 py-6 text-center text-sm">
                            No booth found.
                          </CommandEmpty>
                          <CommandGroup>
                            {sites.map((s) => (
                              <CommandItem
                                key={s.id}
                                value={s.name}
                                className="text-slate-100 aria-selected:bg-[#5b3621] aria-selected:text-slate-50 cursor-pointer"
                                onSelect={() => {
                                  form.setValue('siteId', s.id, {
                                    shouldValidate: true,
                                  });
                                  setPickerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    'mr-2 h-4 w-4 text-[#b8860b]',
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
                    <p className="text-xs text-red-400">{sitesError}</p>
                  )}
                  {form.formState.errors.siteId && (
                    <p className="text-xs text-red-400">
                      {form.formState.errors.siteId.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visitorName" className="text-amber-100">
                    Your team or name
                  </Label>
                  <Input
                    id="visitorName"
                    autoComplete="off"
                    placeholder="e.g. C42"
                    className={inputClass}
                    {...form.register('visitorName')}
                  />
                  {form.formState.errors.visitorName && (
                    <p className="text-xs text-red-400">
                      {form.formState.errors.visitorName.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="visitorEmail" className="text-amber-100">
                    Email address
                  </Label>
                  <Input
                    id="visitorEmail"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={inputClass}
                    {...form.register('visitorEmail')}
                  />
                  {form.formState.errors.visitorEmail && (
                    <p className="text-xs text-red-400">
                      {form.formState.errors.visitorEmail.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-amber-100">Keywords from the booth</Label>
                  <Controller
                    control={form.control}
                    name="keywords"
                    render={({ field }) => (
                      <KeywordChipInput
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  {form.formState.errors.keywords && (
                    <p className="text-xs text-red-400">
                      {form.formState.errors.keywords.message as string}
                    </p>
                  )}
                </div>

                <Button type="submit" className={`w-full ${brassButtonClass}`}>
                  Submit
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {view.kind === 'submitting' && (
          <Card className="bg-[#3a2415] border-[#6a4226]">
            <CardContent className="p-6 flex items-center justify-center gap-2 text-sm text-amber-200/70">
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending your submission…
            </CardContent>
          </Card>
        )}

        {view.kind === 'thanks' && (
          <Card className="bg-[#3a2415] border-[#6a4226] border-l-2 border-l-[#b8860b]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-slate-50">
                <PartyPopper className="w-5 h-5 text-[#d4a96a]" />
                Thank you for participating!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-amber-200/70">
                Your entry for <strong className="text-slate-50">{view.siteName}</strong> has been
                recorded. Scores will appear on the leaderboard once they’re
                tallied.
              </p>
              <div className="flex flex-col gap-2">
                <Button onClick={handleSubmitAnother} className={`w-full ${brassButtonClass}`}>
                  Submit another
                </Button>
                <Link to="/booth-battle" className="w-full">
                  <Button
                    variant="outline"
                    className="w-full bg-transparent border-[#6a4226] text-slate-100 hover:bg-[#5b3621] hover:text-slate-50 focus-visible:ring-[#b8860b]"
                  >
                    View leaderboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {view.kind === 'error' && (
          <Card className="bg-[#3a2415] border-[#6a4226]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-red-400">
                <AlertCircle className="w-5 h-5" />
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-amber-200/70">{view.message}</p>
              <Button onClick={handleSubmitAnother} className={`w-full ${brassButtonClass}`}>
                Back to form
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Link
            to="/booth-battle"
            className="text-xs text-amber-200/60 hover:text-amber-100 underline-offset-4 hover:underline"
          >
            View leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
