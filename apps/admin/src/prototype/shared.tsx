// PROTOTYP (#217) — wspólne kawałki wariantów drabinki. Nie do main.
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  FormDialog,
  Label,
  MatchStatusBadge,
  MatchStatusToggle,
  ScoreInputs,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
  formatKickoff,
  toast,
} from '@tournament/ui';
import { ArrowDown, ArrowUp, CalendarClock, ChevronDown, Info, MoreHorizontal, RefreshCw, Shuffle, TriangleAlert, UserX } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { TextField } from '../components/text-field';
import { MATCHES, plural } from '../lib/plural';
import {
  advanceNotes,
  api,
  byeSlots,
  hasStarted,
  isThirdPlace,
  matchLabel,
  showsPenalties,
  teamsOutsideBracket,
  useBracket,
  VENUE_LIST,
  winnerSide,
  type ApiErr,
  type BMatch,
  type MatchStatus,
  type Slot,
  type Team,
} from './bracket-store';

export const ROUNDS_ACC = ['rundę', 'rundy', 'rund'] as const;

export function shuffle<T>(list: T[]): T[] {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function scoreText(m: BMatch): string {
  if (m.homeScore === null || m.awayScore === null) return '–';
  const pens = m.homePenalties !== null ? ` (k. ${m.homePenalties}:${m.awayPenalties})` : '';
  return `${m.homeScore}:${m.awayScore}${pens}`;
}

/** Kto przyjdzie do pustego slotu: „Zwycięzca Ćwierćfinał 2”, „Przegrany Półfinał 1”. */
export function slotSource(m: BMatch, side: Slot, matches: BMatch[]): string {
  const w = matches.find((x) => x.winnerToMatchId === m.id && x.advancesToSlot === side);
  if (w) return `Zwycięzca: ${matchLabel(w, matches)}`;
  const l = matches.find((x) => x.loserToMatchId === m.id && x.advancesToSlot === side);
  if (l) return `Przegrany: ${matchLabel(l, matches)}`;
  return 'Do ustalenia';
}

function TeamLine({ match, side, matches, dense }: { match: BMatch; side: Slot; matches: BMatch[]; dense?: boolean }) {
  const team = side === 'home' ? match.homeTeam : match.awayTeam;
  const score = side === 'home' ? match.homeScore : match.awayScore;
  const pens = side === 'home' ? match.homePenalties : match.awayPenalties;
  const w = winnerSide(match);
  const bye = byeSlots(match, matches).includes(side);
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5',
        dense ? 'py-1' : 'py-1.5',
        w && (w === side ? 'font-semibold' : 'text-muted-foreground'),
      )}
    >
      <span className={cn('min-w-0 flex-1 truncate', !team && 'text-xs italic text-muted-foreground')}>
        {team?.name ?? slotSource(match, side, matches)}
      </span>
      {bye && team && <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">wolny los</span>}
      {pens !== null && <span className="text-[10px] tabular-nums text-muted-foreground">({pens})</span>}
      <span className="w-6 text-right tabular-nums">{score ?? ''}</span>
    </div>
  );
}

/** Karta meczu w drabince: etykieta pozycji, stan, dwie drużyny. */
export function MatchCard({
  match,
  matches,
  onSelect,
  dense,
  highlight,
  className,
}: {
  match: BMatch;
  matches: BMatch[];
  onSelect?: (m: BMatch) => void;
  dense?: boolean;
  highlight?: boolean;
  className?: string;
}) {
  const final = match.round.name === 'Finał' && !isThirdPlace(match, matches);
  return (
    <button
      type="button"
      onClick={() => onSelect?.(match)}
      className={cn(
        'block w-full overflow-hidden rounded-lg border bg-card text-left text-sm transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        final && 'ring-2 ring-primary',
        highlight && 'ring-2 ring-amber-500',
        match.status === 'live' && 'border-destructive',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-2.5 py-0.5 text-[11px] text-muted-foreground">
        <span className="truncate">{matchLabel(match, matches)}</span>
        {match.status !== 'scheduled' ? (
          <MatchStatusBadge status={match.status} />
        ) : (
          <span className="truncate">{match.kickoffAt ? formatKickoff(match.kickoffAt) : 'bez terminu'}</span>
        )}
      </div>
      <TeamLine match={match} side="home" matches={matches} dense={dense} />
      <div className="border-t" />
      <TeamLine match={match} side="away" matches={matches} dense={dense} />
    </button>
  );
}

/** Akcje nagłówka: rozkład dat i „⋯ Wygeneruj ponownie” (wyłączone po pierwszym meczu). */
export function BracketActions({ onRegenerate, extra }: { onRegenerate: () => void; extra?: ReactNode }) {
  const s = useBracket();
  if (s.matches.length === 0) return null;
  return (
    <>
      {extra}
      <DatesButton />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Więcej akcji drabinki">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem disabled={hasStarted(s.matches)} onSelect={onRegenerate}>
            <RefreshCw /> Wygeneruj ponownie
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function DatesButton({ size }: { size?: 'sm' }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="outline"
      size={size}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const count = await api.distributeDates();
        setPending(false);
        toast.success(`Rozłożono ${count} ${plural(count, MATCHES)} (atrapa okna z terminarza ligi)`);
      }}
    >
      <CalendarClock className="size-4" /> Rozłóż daty
    </Button>
  );
}

/** Podpowiedzi nad drabinką: drużyna spoza drabinki i brak dat. */
export function BracketNotices({ onRegenerate }: { onRegenerate: () => void }) {
  const s = useBracket();
  const outside = teamsOutsideBracket(s);
  const noDates = s.matches.length > 0 && s.matches.every((m) => m.kickoffAt === null);
  return (
    <>
      {outside.length > 0 && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
          <UserX aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1">
            {outside.map((t) => t.name).join(', ')} {outside.length === 1 ? 'jest' : 'są'} w turnieju, ale nie w drabince —{' '}
            {hasStarted(s.matches)
              ? 'puchar już się zaczął, więc drabinki nie da się wygenerować ponownie.'
              : 'wygeneruj ją ponownie.'}
          </p>
          <Button size="sm" variant="outline" disabled={hasStarted(s.matches)} onClick={onRegenerate}>
            Wygeneruj ponownie
          </Button>
        </div>
      )}
      {noDates && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
          <CalendarClock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1">Drabinka nie ma jeszcze dat. Rozłóż je, żeby mecze dostały terminy i obiekty.</p>
          <DatesButton size="sm" />
        </div>
      )}
    </>
  );
}

// ——— Rozstawienie ———

/** Lista rozstawienia z ↑/↓ (#163). `locked` — ile pierwszych pozycji nie miesza „Wymieszaj”. */
export function SeedingList({
  value,
  onChange,
  locked = 0,
  dense,
  maxHeight = 'max-h-80',
}: {
  value: Team[];
  onChange: (next: Team[]) => void;
  locked?: number;
  dense?: boolean;
  maxHeight?: string;
}) {
  function move(from: number, to: number) {
    const next = [...value];
    const [t] = next.splice(from, 1);
    next.splice(to, 0, t);
    onChange(next);
  }
  return (
    <ol className={cn('space-y-1 overflow-y-auto pr-1', maxHeight)}>
      {value.map((team, i) => (
        <li
          key={team.id}
          className={cn('flex items-center gap-2 rounded-md border px-2', dense ? 'py-0.5' : 'py-1', i < locked && 'border-primary/50 bg-primary/5')}
        >
          <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
          <span className="min-w-0 flex-1 truncate text-sm">{team.name}</span>
          <Button type="button" size="icon" variant="ghost" className="size-7" disabled={i === 0} aria-label={`Przesuń ${team.name} wyżej`} onClick={() => move(i, i - 1)}>
            <ArrowUp className="size-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            disabled={i === value.length - 1}
            aria-label={`Przesuń ${team.name} niżej`}
            onClick={() => move(i, i + 1)}
          >
            <ArrowDown className="size-3.5" />
          </Button>
        </li>
      ))}
    </ol>
  );
}

export function ShuffleButton({ value, onChange, locked = 0, label = 'Wymieszaj' }: { value: Team[]; onChange: (next: Team[]) => void; locked?: number; label?: string }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value.slice(0, locked), ...shuffle(value.slice(locked))])}>
      <Shuffle className="size-4" /> {label}
    </Button>
  );
}

export function ThirdPlaceSwitch({ teamsCount, value, onChange }: { teamsCount: number; value: boolean; onChange: (v: boolean) => void }) {
  const disabled = teamsCount < 4;
  return (
    <Label className={cn('flex items-start gap-3 rounded-md border p-3 font-normal', disabled && 'opacity-60')}>
      <Switch checked={value && !disabled} disabled={disabled} onCheckedChange={onChange} className="mt-0.5" />
      <span>
        <span className="block text-sm font-medium">Mecz o 3. miejsce</span>
        <span className="block text-xs text-muted-foreground">
          {disabled ? 'Wymaga co najmniej czterech drużyn.' : 'Grają przegrani półfinałów, w rundzie finału, przed finałem.'}
        </span>
      </span>
    </Label>
  );
}

/** Wysyłka generowania i rozkład `422` na pola — wspólne dla wszystkich okien generowania. */
export function useGenerate(onDone: () => void) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  async function run(teamIds: number[], thirdPlace: boolean) {
    setPending(true);
    setErrors({});
    try {
      const { roundsCount, matchesCount } = await api.generate(teamIds, thirdPlace);
      toast.success(`Wygenerowano drabinkę: ${roundsCount} ${plural(roundsCount, ROUNDS_ACC)}, ${matchesCount} ${plural(matchesCount, MATCHES)}`);
      onDone();
    } catch (e) {
      const err = e as ApiErr;
      const first = Object.fromEntries(Object.entries(err.errors ?? {}).map(([k, v]) => [k, v[0]]));
      setErrors(err.status === 422 ? { ...first, form: first.stage ?? first.teams ?? first.teamIds } : { form: 'Nie udało się wygenerować drabinki. Spróbuj ponownie.' });
    } finally {
      setPending(false);
    }
  }
  return { pending, errors, run };
}

/** Ostrzeżenie w oknie generowania, gdy drabinka już jest (#215: zastępuje całą, z datami). */
export function ReplaceWarning() {
  const s = useBracket();
  if (s.matches.length === 0) return null;
  return (
    <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
      Obecna drabinka ({s.matches.length} {plural(s.matches.length, MATCHES)}) zniknie razem z terminami i obiektami, także
      poprawionymi ręcznie.
    </p>
  );
}

// ——— Okno meczu ———

const NO_VENUE = 'none';

function toLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Okno meczu pucharowego: to samo co w lidze (#176) plus karne i notka
 * przed zapisem (#216). `light` — lżejsza wersja (wariant B): sam wynik,
 * stan i karne; termin i obiekt pod rozwinięciem „Więcej”.
 */
export function BracketMatchDialog({ match, onClose, light }: { match: BMatch; onClose: () => void; light?: boolean }) {
  const s = useBracket();
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [home, setHome] = useState(match.homeScore?.toString() ?? '');
  const [away, setAway] = useState(match.awayScore?.toString() ?? '');
  const [homePen, setHomePen] = useState(match.homePenalties?.toString() ?? '');
  const [awayPen, setAwayPen] = useState(match.awayPenalties?.toString() ?? '');
  const [kickoff, setKickoff] = useState(toLocal(match.kickoffAt));
  const [venue, setVenue] = useState(match.venue ? String(match.venue.id) : NO_VENUE);
  const [more, setMore] = useState(!light && match.status === 'scheduled');
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const num = (v: string) => (v === '' ? null : Number(v));
  const penaltiesVisible = showsPenalties(s.sport, { status, homeScore: num(home), awayScore: num(away) });
  const draft: BMatch = {
    ...match,
    status,
    homeScore: num(home),
    awayScore: num(away),
    homePenalties: penaltiesVisible ? num(homePen) : null,
    awayPenalties: penaltiesVisible ? num(awayPen) : null,
  };
  const notes = advanceNotes(match, draft, s.matches);
  const missingTeams = !match.homeTeam || !match.awayTeam;
  const homeName = match.homeTeam?.name ?? slotSource(match, 'home', s.matches);
  const awayName = match.awayTeam?.name ?? slotSource(match, 'away', s.matches);

  function changeStatus(next: MatchStatus) {
    setStatus(next);
    if (next === 'scheduled') {
      setHome('');
      setAway('');
    } else if (next === 'live') {
      setHome((v) => (v === '' ? '0' : v));
      setAway((v) => (v === '' ? '0' : v));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      await api.patchMatch(match.id, {
        status,
        homeScore: draft.homeScore,
        awayScore: draft.awayScore,
        // Pola znikają → formularz wysyła jawne `null` (#216).
        homePenalties: draft.homePenalties,
        awayPenalties: draft.awayPenalties,
        kickoffAt: kickoff === '' ? null : new Date(kickoff).toISOString(),
        venueId: venue === NO_VENUE ? null : Number(venue),
      });
      toast.success('Zapisano mecz.');
      onClose();
    } catch (e) {
      const err = e as ApiErr;
      const first = Object.fromEntries(Object.entries(err.errors ?? {}).map(([k, v]) => [k, v[0]]));
      if (err.status !== 422) setErrors({ form: 'Nie udało się zapisać meczu. Spróbuj ponownie.' });
      else if (first.homePenalties && !penaltiesVisible) setErrors({ form: first.homePenalties });
      else setErrors({ ...first, form: first.status });
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      onSubmit={submit}
      title={`${match.homeTeam?.name ?? '?'} – ${match.awayTeam?.name ?? '?'}`}
      description={`${matchLabel(match, s.matches)}${match.kickoffAt ? ` · ${formatKickoff(match.kickoffAt)}` : ''}`}
      submitLabel="Zapisz"
      pending={pending}
      error={errors.form}
      contentClassName={cn('max-h-[92vh] overflow-y-auto', light ? 'sm:max-w-md' : 'sm:max-w-2xl')}
      aside={
        !light && (
          <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            Zdarzenia meczu — ta sama sekcja co w lidze (#200), poza zakresem prototypu.
          </div>
        )
      }
    >
      <div className="grid gap-4">
        {missingTeams && (
          <p className="flex gap-2 rounded-md bg-muted p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0" />
            Mecz czeka na rywali z poprzedniej rundy. Do tego czasu ustawisz mu tylko termin i obiekt.
          </p>
        )}
        <div className="flex flex-wrap items-start gap-3">
          <ScoreInputs
            homeValue={home}
            awayValue={away}
            onHomeChange={setHome}
            onAwayChange={setAway}
            homeLabel={`Wynik ${homeName}`}
            awayLabel={`Wynik ${awayName}`}
            error={errors.homeScore}
            disabled={pending || missingTeams}
          />
          <MatchStatusToggle value={status} onChange={changeStatus} disabled={pending || missingTeams} />
        </div>
        {penaltiesVisible && (
          <div className="grid gap-1.5 rounded-md border border-amber-500/50 bg-amber-500/5 p-3">
            <span className="text-sm font-medium">Rzuty karne</span>
            <ScoreInputs
              homeValue={homePen}
              awayValue={awayPen}
              onHomeChange={setHomePen}
              onAwayChange={setAwayPen}
              homeLabel={`Karne ${homeName}`}
              awayLabel={`Karne ${awayName}`}
              error={errors.homePenalties}
              disabled={pending}
            />
            <span className="text-xs text-muted-foreground">Remis w meczu pucharowym rozstrzygają karne.</span>
          </div>
        )}
        {notes.length > 0 && (
          <ul className="space-y-1">
            {notes.map((n) => (
              <li
                key={n.text}
                className={cn(
                  'flex gap-2 rounded-md p-2 text-sm',
                  n.tone === 'block' ? 'bg-destructive/10 text-destructive' : 'bg-primary/5',
                )}
              >
                {n.tone === 'block' ? <TriangleAlert className="mt-0.5 size-4 shrink-0" /> : <Info className="mt-0.5 size-4 shrink-0" />}
                {n.text}
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          aria-expanded={more}
          onClick={() => setMore(!more)}
          className="flex items-center gap-1 justify-self-start text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronDown aria-hidden className={cn('size-4 transition-transform', !more && '-rotate-90')} />
          {light ? 'Więcej: termin i obiekt' : 'Termin i obiekt'}
        </button>
        <div hidden={!more} className="grid content-start gap-3 sm:grid-cols-2">
          <TextField label="Termin" type="datetime-local" value={kickoff} hint="Puste pole to „Termin do ustalenia”." onChange={(e) => setKickoff(e.target.value)} />
          <div className="grid content-start gap-2">
            <Label>Obiekt</Label>
            <Select value={venue} onValueChange={setVenue}>
              <SelectTrigger aria-label="Obiekt" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VENUE}>Bez obiektu</SelectItem>
                {VENUE_LIST.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </FormDialog>
  );
}

/** Mistrz pod drabinką / w kolumnie po finale. */
export function ChampionBadge({ team }: { team: Team | null }) {
  if (!team) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg bg-brand p-3 text-brand-foreground">
      <span className="text-2xl" aria-hidden>
        🏆
      </span>
      <div className="min-w-0">
        <div className="truncate font-bold">{team.name}</div>
        <div className="text-xs opacity-80">Zwycięzca pucharu</div>
      </div>
    </div>
  );
}
