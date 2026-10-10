// PROTOTYP (#162) — kawałki wspólne dla wariantów: formatowanie, plakietki,
// edytor wyniku (reguły z #159), pola terminu, okna generowania i rozkładu dat.
// Warianty różnią się układem, nie tymi kawałkami. Nie do main.
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  FormDialog,
  Input,
  Label,
  cn,
  toast,
} from '@tournament/ui';
import { AlertTriangle, CalendarClock, CalendarDays, Check, MoreHorizontal, RefreshCw, Trophy, UserX } from 'lucide-react';
import { useState } from 'react';
import {
  distributeDates,
  generate,
  hasPlayed,
  patchMatch,
  patchMatchDuration,
  teamsWithoutMatches,
  toLocalInput,
  useScheduleState,
  type AdminMatch,
  type ApiErr,
  type MatchPatch,
  type MatchStatus,
} from './schedule-store';

// ——— Formatowanie (Intl ze strefą przeglądarki, ADR 0008) ———

const dayFmt = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });
export const fmtDay = (iso: string) => dayFmt.format(new Date(iso));
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso));
export const fmtKickoff = (iso: string | null) => (iso ? `${fmtDay(iso)}, ${fmtTime(iso)}` : 'Termin do ustalenia');

/** „ndz. 6 wrz” albo „sob. 5 – ndz. 6 wrz” — zakres dat kolejki. */
export function roundDates(matches: AdminMatch[]): string {
  const dated = matches.filter((m) => m.kickoffAt).map((m) => m.kickoffAt!).sort();
  if (dated.length === 0) return matches.length ? 'bez terminu' : '';
  const first = fmtDay(dated[0]);
  const last = fmtDay(dated[dated.length - 1]);
  const missing = dated.length < matches.length ? ` · ${matches.length - dated.length} bez terminu` : '';
  return (first === last ? first : `${first} – ${last}`) + missing;
}

/** Godzina w wierszu; data tylko wtedy, gdy kolejka nie mieści się w jednym dniu. */
export function rowWhen(m: AdminMatch, round: AdminMatch[]): string {
  if (!m.kickoffAt) return 'Termin do ustalenia';
  const days = new Set(round.filter((x) => x.kickoffAt).map((x) => fmtDay(x.kickoffAt!)));
  return days.size === 1 ? fmtTime(m.kickoffAt) : fmtKickoff(m.kickoffAt);
}

// ——— Plakietki ———

export const STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: 'Zaplanowany',
  live: 'Trwa',
  finished: 'Zakończony',
};

export function StatusBadge({ status }: { status: MatchStatus }) {
  if (status === 'finished')
    return (
      <Badge variant="default">
        <Check /> Zakończony
      </Badge>
    );
  if (status === 'live')
    return (
      <Badge variant="destructive">
        <span className="size-1.5 animate-pulse rounded-full bg-destructive" /> Trwa
      </Badge>
    );
  return <Badge variant="secondary">Zaplanowany</Badge>;
}

export function Score({ match, className }: { match: AdminMatch; className?: string }) {
  return match.homeScore !== null ? (
    <span className={cn('rounded-md bg-foreground px-2.5 py-1 text-sm font-semibold tabular-nums text-background', match.status === 'live' && 'bg-destructive', className)}>
      {match.homeScore} : {match.awayScore}
    </span>
  ) : (
    <span className={cn('rounded-md border px-2.5 py-1 text-sm tabular-nums text-muted-foreground', className)}>– : –</span>
  );
}

/** Opis drugiej strony kolizji, np. „Kolizja boiska: Lwy – Żubry, 10:00”. */
export function collisionText(match: AdminMatch, all: AdminMatch[]): string[] {
  return match.collisions.map((c) => {
    const other = all.find((m) => m.id === c.matchId);
    const kind = c.type === 'team' ? 'Kolizja drużyny' : 'Kolizja boiska';
    return other ? `${kind}: ${other.homeTeam.name} – ${other.awayTeam.name} (${other.round.name}, ${fmtKickoff(other.kickoffAt)})` : kind;
  });
}

export function CollisionBadges({ match, all }: { match: AdminMatch; all: AdminMatch[] }) {
  const types = [...new Set(match.collisions.map((c) => c.type))];
  if (types.length === 0) return null;
  return (
    <>
      {types.map((t) => (
        <Badge key={t} variant="destructive" title={collisionText(match, all).join('\n')}>
          <AlertTriangle /> {t === 'team' ? 'Kolizja drużyny' : 'Kolizja boiska'}
        </Badge>
      ))}
    </>
  );
}

// ——— Edytor wyniku i stanu (#159) ———

export type MatchDraft = { home: string; away: string; status: MatchStatus; kickoff: string; venueId: string };

export function draftOf(m: AdminMatch): MatchDraft {
  return {
    home: m.homeScore?.toString() ?? '',
    away: m.awayScore?.toString() ?? '',
    status: m.status,
    kickoff: m.kickoffAt ? toLocalInput(new Date(m.kickoffAt)) : '',
    venueId: m.venue?.id.toString() ?? '',
  };
}

/** Kliknięcie stanu: „Trwa” na pustym wyniku wstawia 0:0, „Zaplanowany” czyści oba pola (#159). */
export function withStatus(d: MatchDraft, status: MatchStatus): MatchDraft {
  if (status === 'scheduled') return { ...d, status, home: '', away: '' };
  if (d.home === '' && d.away === '' && status === 'live') return { ...d, status, home: '0', away: '0' };
  return { ...d, status };
}

const num = (v: string) => (v === '' ? null : Number(v));
export const resultBody = (d: MatchDraft): MatchPatch => ({ homeScore: num(d.home), awayScore: num(d.away), status: d.status });
export const termBody = (d: MatchDraft): MatchPatch => ({
  kickoffAt: d.kickoff ? new Date(d.kickoff).toISOString() : null,
  venueId: d.venueId ? Number(d.venueId) : null,
});

/** Zapis meczu: 422 pod `homeScore` idzie pod blok wyniku, reszta przy polach albo nad przyciskami. */
export function useSaveMatch() {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function save(match: AdminMatch, body: MatchPatch, what = 'wynik') {
    setPending(true);
    setErrors({});
    try {
      const saved = await patchMatch(match.id, body);
      toast.success(
        what === 'wynik'
          ? `Zapisano: ${saved.homeTeam.name} ${saved.homeScore ?? '–'}:${saved.awayScore ?? '–'} ${saved.awayTeam.name}`
          : `Zapisano termin: ${saved.homeTeam.name} – ${saved.awayTeam.name}`,
      );
      if (saved.collisions.length) toast.warning(`Mecz koliduje z ${saved.collisions.length} innym(i). Zapis nie jest blokowany.`);
      return true;
    } catch (e) {
      const err = e as ApiErr;
      const fieldErrors = Object.fromEntries(Object.entries(err.errors ?? {}).map(([k, v]) => [k, v[0]]));
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { root: err.message });
      return false;
    } finally {
      setPending(false);
    }
  }
  return { save, pending, errors, setErrors };
}

export function StatusPills({ value, onChange, size = 'md' }: { value: MatchStatus; onChange: (s: MatchStatus) => void; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label="Stan meczu" className="inline-flex rounded-lg border p-0.5">
      {(['scheduled', 'live', 'finished'] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(s)}
          className={cn(
            'rounded-md font-medium transition-colors',
            size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
            value === s ? (s === 'live' ? 'bg-destructive text-white' : 'bg-foreground text-background') : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

/** Blok `__ : __`. Jeden komunikat błędu pod całym blokiem (wszystko z `homeScore`). */
export function ScoreInputs({
  match,
  draft,
  onChange,
  error,
  size = 'lg',
}: {
  match: AdminMatch;
  draft: MatchDraft;
  onChange: (d: MatchDraft) => void;
  error?: string;
  size?: 'lg' | 'sm';
}) {
  const cls = size === 'lg' ? 'h-16 w-20 text-center text-3xl font-bold' : 'h-8 w-12 px-1 text-center font-semibold';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          max={999}
          value={draft.home}
          onChange={(e) => onChange({ ...draft, home: e.target.value })}
          aria-label={`Wynik ${match.homeTeam.name}`}
          aria-invalid={error ? true : undefined}
          className={cls}
        />
        <span className={cn('font-bold text-muted-foreground', size === 'lg' ? 'text-3xl' : '')}>:</span>
        <Input
          type="number"
          min={0}
          max={999}
          value={draft.away}
          onChange={(e) => onChange({ ...draft, away: e.target.value })}
          aria-label={`Wynik ${match.awayTeam.name}`}
          aria-invalid={error ? true : undefined}
          className={cls}
        />
      </div>
      {error && <p className="max-w-64 text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function TermFields({ draft, onChange, errors }: { draft: MatchDraft; onChange: (d: MatchDraft) => void; errors: Record<string, string> }) {
  const { venues } = useScheduleState();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="grid content-start gap-1.5">
        <Label htmlFor="kickoff">Termin</Label>
        <Input id="kickoff" type="datetime-local" value={draft.kickoff} onChange={(e) => onChange({ ...draft, kickoff: e.target.value })} />
        <p className="text-xs text-muted-foreground">Puste = termin do ustalenia.</p>
        {errors.kickoffAt && <p className="text-sm text-destructive">{errors.kickoffAt}</p>}
      </div>
      <div className="grid content-start gap-1.5">
        <Label htmlFor="venue">Obiekt</Label>
        <select
          id="venue"
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
          value={draft.venueId}
          onChange={(e) => onChange({ ...draft, venueId: e.target.value })}
        >
          <option value="">— bez obiektu —</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        {errors.venueId && <p className="text-sm text-destructive">{errors.venueId}</p>}
      </div>
    </div>
  );
}

// ——— Akcje terminarza: generowanie i rozkład dat ———

type OpenDialog = 'generate' | 'dates' | null;

/** Akcje w nagłówku ekranu: „Rozłóż daty” + menu z „Wygeneruj ponownie”. */
export function ScheduleActions() {
  const s = useScheduleState();
  const [open, setOpen] = useState<OpenDialog>(null);
  if (s.stage.type !== 'league' || s.rounds.length === 0) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen('dates')}>
        <CalendarClock className="size-4" /> Rozłóż daty
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Więcej akcji terminarza">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={hasPlayed(s)}
            onSelect={() => setOpen('generate')}
            title={hasPlayed(s) ? 'Faza ma rozegrane mecze' : undefined}
          >
            <RefreshCw /> Wygeneruj ponownie
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {open === 'generate' && <GenerateDialog onClose={() => setOpen(null)} />}
      {open === 'dates' && <DatesDialog onClose={() => setOpen(null)} />}
    </>
  );
}

export function GenerateDialog({ onClose }: { onClose: () => void }) {
  const s = useScheduleState();
  const [meetings, setMeetings] = useState<1 | 2 | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const replacing = s.matches.length > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!meetings) return setError('Wybierz, ile razy grają ze sobą drużyny.');
    setPending(true);
    try {
      const r = await generate(meetings);
      toast.success(`Wygenerowano ${r.roundsCount} kolejek, ${r.matchesCount} meczów`);
      onClose();
    } catch (err) {
      setError((err as ApiErr).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && !pending && onClose()}
      onSubmit={(e) => void submit(e)}
      title={replacing ? 'Wygeneruj terminarz ponownie' : 'Wygeneruj terminarz'}
      description={`${s.stage.name} · ${s.teams.length} drużyn. Kolejność drużyn jest losowana.`}
      submitLabel={replacing ? 'Zastąp terminarz' : 'Wygeneruj'}
      pending={pending}
      error={error}
    >
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Każdy z każdym</legend>
        {([1, 2] as const).map((m) => (
          <label key={m} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3', meetings === m && 'border-primary bg-primary/5')}>
            <input type="radio" name="meetings" className="mt-1" checked={meetings === m} onChange={() => setMeetings(m)} />
            <span>
              <span className="block font-medium">{m === 1 ? 'Raz' : 'Dwa razy (mecz i rewanż)'}</span>
              <span className="text-sm text-muted-foreground">
                {roundsFor(s.teams.length, m)} kolejek, {(s.teams.length * (s.teams.length - 1) * m) / 2} meczów
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      {replacing && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Obecny terminarz ({s.matches.length} meczów) zniknie razem z terminami i obiektami, także poprawionymi ręcznie.
        </p>
      )}
      <p className="text-xs text-muted-foreground">Mecze powstaną bez dat. Daty rozłożysz w następnym kroku.</p>
    </FormDialog>
  );
}
const roundsFor = (n: number, m: number) => (n % 2 ? n : n - 1) * m;

export function DatesDialog({ onClose }: { onClose: () => void }) {
  const s = useScheduleState();
  const [mode, setMode] = useState<'interval' | 'continuous'>('interval');
  const [startAt, setStartAt] = useState('');
  const [intervalDays, setIntervalDays] = useState('7');
  const [dayEndTime, setDayEndTime] = useState('');
  const [venueIds, setVenueIds] = useState<number[]>(s.venues.slice(0, 2).map((v) => v.id));
  const [duration, setDuration] = useState(String(s.matchDuration));
  const [fromRound, setFromRound] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const from = Number(fromRound || 1);
  const overwritten = s.matches.filter((m) => m.status === 'scheduled' && m.kickoffAt && m.round.order >= from).length;
  const kept = s.matches.filter((m) => m.status !== 'scheduled' && m.round.order >= from).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (overwritten > 0 && !confirming) return setConfirming(true);
    setPending(true);
    setErrors({});
    try {
      if (Number(duration) !== s.matchDuration) await patchMatchDuration(Number(duration));
      const r = await distributeDates({
        mode,
        startAt,
        intervalDays: mode === 'interval' ? Number(intervalDays) : null,
        dayEndTime: mode === 'continuous' && dayEndTime ? dayEndTime : null,
        venueIds,
        fromRound: fromRound ? Number(fromRound) : null,
      });
      toast.success(`Rozłożono ${r.matchesCount} meczów${r.collisionsCount ? `, ${r.collisionsCount} z kolizją` : ', bez kolizji'}`);
      onClose();
    } catch (err) {
      const apiErr = err as ApiErr;
      setConfirming(false);
      setErrors(apiErr.errors ? Object.fromEntries(Object.entries(apiErr.errors).map(([k, v]) => [k, v[0]])) : { root: apiErr.message });
    } finally {
      setPending(false);
    }
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && !pending && onClose()}
      onSubmit={(e) => void submit(e)}
      title="Rozłóż daty"
      description={`${s.stage.name} · ${s.rounds.length} kolejek · strefa ${tz}`}
      submitLabel={confirming ? 'Tak, nadpisz terminy' : 'Rozłóż'}
      pending={pending}
      error={errors.root ?? errors.stage}
    >
      {confirming ? (
        <div className="space-y-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <p>
            Nadpiszesz terminy i obiekty {overwritten} zaplanowanych meczów od kolejki {from}, także te poprawione ręcznie.
          </p>
          {kept > 0 && <p>Mecze trwające i zakończone ({kept}) zachowają swój termin.</p>}
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => setConfirming(false)}>
            Wróć do formularza
          </Button>
        </div>
      ) : (
        <>
          <fieldset className="grid grid-cols-2 gap-2">
            {(
              [
                ['interval', 'Co N dni', 'Liga sezonowa: kolejka co tydzień'],
                ['continuous', 'Ciągiem', 'Turniej jednodniowy: mecz za meczem'],
              ] as const
            ).map(([value, label, hint]) => (
              <label key={value} className={cn('cursor-pointer rounded-lg border p-3', mode === value && 'border-primary bg-primary/5')}>
                <input type="radio" name="mode" className="sr-only" checked={mode === value} onChange={() => setMode(value)} />
                <span className="block font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid content-start gap-1.5">
              <Label htmlFor="startAt">Start (pierwsza kolejka)</Label>
              <Input id="startAt" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              {errors.startAt && <p className="text-sm text-destructive">{errors.startAt}</p>}
            </div>
            {mode === 'interval' ? (
              <div className="grid content-start gap-1.5">
                <Label htmlFor="intervalDays">Co ile dni</Label>
                <Input id="intervalDays" type="number" min={1} value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
                {errors.intervalDays && <p className="text-sm text-destructive">{errors.intervalDays}</p>}
              </div>
            ) : (
              <div className="grid content-start gap-1.5">
                <Label htmlFor="dayEnd">Koniec dnia (opcjonalnie)</Label>
                <Input id="dayEnd" type="time" value={dayEndTime} onChange={(e) => setDayEndTime(e.target.value)} />
              </div>
            )}
          </div>
          <fieldset className="grid content-start gap-1.5">
            <legend className="mb-1 text-sm font-medium">Obiekty</legend>
            <div className="flex flex-wrap gap-2">
              {s.venues.map((v) => (
                <label key={v.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={venueIds.includes(v.id)}
                    onChange={(e) => setVenueIds(e.target.checked ? [...venueIds, v.id] : venueIds.filter((x) => x !== v.id))}
                  />
                  {v.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {venueIds.length ? `${venueIds.length} mecze kolejki naraz.` : 'Bez obiektów cała kolejka gra o jednej godzinie.'}
            </p>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid content-start gap-1.5">
              <Label htmlFor="duration">Długość meczu (min)</Label>
              <Input id="duration" type="number" min={10} max={600} value={duration} onChange={(e) => setDuration(e.target.value)} />
              <p className="text-xs text-muted-foreground">Zmieni długość meczu w całym turnieju.</p>
              {errors.matchDuration && <p className="text-sm text-destructive">{errors.matchDuration}</p>}
            </div>
            <div className="grid content-start gap-1.5">
              <Label htmlFor="fromRound">Od kolejki</Label>
              <select id="fromRound" className="h-9 rounded-md border bg-transparent px-2 text-sm" value={fromRound} onChange={(e) => setFromRound(e.target.value)}>
                <option value="">od pierwszej</option>
                {s.rounds.map((r) => (
                  <option key={r.id} value={r.order}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
    </FormDialog>
  );
}

// ——— Stany ekranu poza listą meczów ———

/**
 * Wszystko, co ekran pokazuje zamiast listy (puchar, brak terminarza) albo nad
 * nią (drużyny bez meczów). Zwraca `content`, gdy lista ma się nie pokazać.
 */
export function ScheduleGate({ children }: { children: React.ReactNode }) {
  const s = useScheduleState();
  const [generating, setGenerating] = useState(false);
  const orphans = teamsWithoutMatches(s);

  if (s.stage.type !== 'league')
    return (
      <EmptyState
        icon={<Trophy />}
        title="Terminarz pucharu pojawi się razem z drabinką"
        description="Generowanie działa na razie tylko dla ligi."
      />
    );

  if (s.rounds.length === 0)
    return (
      <>
        <EmptyState
          icon={<CalendarDays />}
          title="Terminarz nie jest jeszcze wygenerowany"
          description={
            s.teams.length < 2
              ? 'Liga potrzebuje co najmniej dwóch drużyn. Dodaj je w zakładce Drużyny.'
              : `${s.teams.length} drużyn gra każdy z każdym. Najpierw powstaną pary i kolejki, daty rozłożysz potem.`
          }
          action={
            <Button disabled={s.teams.length < 2} onClick={() => setGenerating(true)}>
              <RefreshCw className="size-4" /> Wygeneruj terminarz
            </Button>
          }
        />
        {generating && <GenerateDialog onClose={() => setGenerating(false)} />}
      </>
    );

  return (
    <>
      {orphans.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <UserX className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div className="flex-1">
            {orphans.length === 1 ? (
              <>
                Drużyna <b>{orphans[0].name}</b> nie ma meczów w terminarzu — wygeneruj go ponownie.
              </>
            ) : (
              <>Drużyny {orphans.map((t) => t.name).join(', ')} nie mają meczów w terminarzu — wygeneruj go ponownie.</>
            )}
          </div>
          {!hasPlayed(s) && (
            <Button size="sm" variant="outline" onClick={() => setGenerating(true)}>
              Wygeneruj ponownie
            </Button>
          )}
        </div>
      )}
      {s.matches.every((m) => !m.kickoffAt) && <NoDatesHint />}
      {children}
      {generating && <GenerateDialog onClose={() => setGenerating(false)} />}
    </>
  );
}

function NoDatesHint() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 flex items-center gap-3 rounded-lg border border-dashed p-3 text-sm">
      <CalendarClock className="size-4 text-muted-foreground" />
      <span className="flex-1">Mecze nie mają jeszcze dat. Rozłóż je co tydzień albo ciągiem, na wybranych obiektach.</span>
      <Button size="sm" onClick={() => setOpen(true)}>
        Rozłóż daty
      </Button>
      {open && <DatesDialog onClose={() => setOpen(false)} />}
    </div>
  );
}
