// PROTOTYP (#191) — wspólne klocki okna meczu ze zdarzeniami. Nie do main.
import type { AdminMatch, MatchStatus } from '@tournament/api-client';
import {
  Button,
  ConfirmDeleteDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormDialog,
  Input,
  Label,
  MatchStatusToggle,
  ScoreInputs,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  toast,
} from '@tournament/ui';
import { Info, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { TextField } from '../components/text-field';
import { useVenues } from '../lib/schedule-queries';
import {
  EVENT_TYPES,
  ProtoValidationError,
  ensureSeeded,
  events,
  findPlayer,
  matchEvents,
  roster,
  saveMatch,
  savedStatus,
  scoringValue,
  useProto,
  type EventBody,
  type ProtoEvent,
  type SportCode,
} from './events-store';

// --- Stan okna meczu -----------------------------------------------------------

function toLocalInputValue(iso: string | null): string {
  if (iso === null) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function useMatchForm(match: AdminMatch, sport: SportCode, onClose: () => void) {
  const proto = useProto();
  const saved = (proto.statusOverride[match.id] ?? match.status) as MatchStatus;
  const [status, setStatus] = useState<MatchStatus>(saved);
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? '');
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? '');
  const [kickoffAt, setKickoffAt] = useState(toLocalInputValue(match.kickoffAt));
  const [venueId, setVenueId] = useState(match.venue ? String(match.venue.id) : 'none');
  const [statusError, setStatusError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => ensureSeeded(match, sport), [match, sport]);

  function changeStatus(next: MatchStatus) {
    setStatus(next);
    setStatusError(undefined);
    if (next === 'scheduled') {
      setHomeScore('');
      setAwayScore('');
    } else if (next === 'live') {
      setHomeScore((value) => (value === '' ? '0' : value));
      setAwayScore((value) => (value === '' ? '0' : value));
    }
  }

  async function save() {
    setPending(true);
    try {
      await saveMatch(match, status);
      toast.success('Zapisano mecz.');
      onClose();
    } catch (error) {
      if (error instanceof ProtoValidationError) setStatusError(error.errors.status);
    } finally {
      setPending(false);
    }
  }

  return {
    status,
    saved,
    changeStatus,
    homeScore,
    setHomeScore,
    awayScore,
    setAwayScore,
    kickoffAt,
    setKickoffAt,
    venueId,
    setVenueId,
    statusError,
    pending,
    save,
  };
}

export type MatchForm = ReturnType<typeof useMatchForm>;

export function teamNames(match: AdminMatch) {
  return { home: match.homeTeam?.name ?? 'Do ustalenia', away: match.awayTeam?.name ?? 'Do ustalenia' };
}

/** Wynik i stan — to samo co w prawdziwym oknie. */
export function ScoreBlock({ match, form, compact }: { match: AdminMatch; form: MatchForm; compact?: boolean }) {
  const { home, away } = teamNames(match);
  return (
    <div className={cn('grid gap-3', compact && 'sm:grid-cols-[auto_1fr] sm:items-center')}>
      <ScoreInputs
        homeValue={form.homeScore}
        awayValue={form.awayScore}
        onHomeChange={form.setHomeScore}
        onAwayChange={form.setAwayScore}
        homeLabel={`Wynik ${home}`}
        awayLabel={`Wynik ${away}`}
        disabled={form.pending}
      />
      <div className={cn('grid gap-1', compact ? 'justify-items-start' : 'justify-items-center')}>
        <MatchStatusToggle value={form.status} onChange={form.changeStatus} disabled={form.pending} />
        {form.statusError && <p className="text-sm text-destructive">{form.statusError}</p>}
      </div>
    </div>
  );
}

/** Termin i obiekt — to samo co w prawdziwym oknie. */
export function ScheduleFields({ tournamentId, form }: { tournamentId: number; form: MatchForm }) {
  const venues = useVenues(tournamentId);
  return (
    <div className="grid content-start gap-3 sm:grid-cols-2">
      <TextField
        label="Termin"
        type="datetime-local"
        value={form.kickoffAt}
        hint="Puste pole to „Termin do ustalenia”."
        disabled={form.pending}
        onChange={(event) => form.setKickoffAt(event.target.value)}
      />
      <div className="grid content-start gap-2">
        <Label htmlFor="proto-venue">Obiekt</Label>
        <Select value={form.venueId} onValueChange={form.setVenueId} disabled={form.pending}>
          <SelectTrigger id="proto-venue" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Bez obiektu</SelectItem>
            {(venues.data ?? []).map((venue) => (
              <SelectItem key={venue.id} value={String(venue.id)}>
                {venue.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/**
 * Rama okna bez `<form>`: zdarzenia zapisują się od razu osobnym zasobem, więc
 * Enter w polu zdarzenia nie może wysłać całego meczu.
 */
export function MatchDialogFrame({
  match,
  form,
  onClose,
  width,
  children,
}: {
  match: AdminMatch;
  form: MatchForm;
  onClose: () => void;
  width: string;
  children: ReactNode;
}) {
  const { home, away } = teamNames(match);
  return (
    <Dialog open onOpenChange={(open) => !open && !form.pending && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn('max-h-[92vh] overflow-y-auto', width)}
        // Klik w przełącznik prototypu nie zamyka okna.
        onInteractOutside={(event) => {
          if ((event.target as HTMLElement | null)?.closest('[data-prototype]')) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {home} – {away}
          </DialogTitle>
          <DialogDescription>
            {match.round.name} · mecz {match.matchNumber}
          </DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter className="items-center">
          <p className="mr-auto text-xs text-muted-foreground">Zdarzenia zapisują się od razu. „Zapisz” dotyczy wyniku, stanu, terminu i obiektu.</p>
          <Button type="button" variant="outline" onClick={onClose} disabled={form.pending}>
            Zamknij
          </Button>
          <Button type="button" onClick={() => void form.save()} disabled={form.pending}>
            {form.pending ? 'Zapisywanie…' : 'Zapisz'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Zdarzenia -----------------------------------------------------------------

export function useMatchEvents(match: AdminMatch) {
  const proto = useProto();
  return matchEvents(proto.events, match.id);
}

export function typeOf(sport: SportCode, code: string) {
  return EVENT_TYPES[sport].find((type) => type.code === code);
}

export function playerLabel(playerId: number | null) {
  const player = findPlayer(playerId);
  if (!player) return '—';
  return player.number === null ? player.name : `${player.number}. ${player.name}`;
}

export function minuteLabel(minute: number | null) {
  return minute === null ? '—′' : `${minute}′`;
}

/**
 * Czy sekcję wolno edytować. API patrzy na **zapisany** stan, więc przełącznik
 * „Trwa” bez zapisu jeszcze nie otwiera zdarzeń — to też jest pytanie
 * prototypu.
 */
export function eventsGate(match: AdminMatch, form: MatchForm): { open: boolean; note?: ReactNode } {
  const saved = savedStatus(match);
  if (saved !== 'scheduled') return { open: true };
  if (form.status !== 'scheduled') {
    return {
      open: false,
      note: (
        <>
          Mecz jest jeszcze zapisany jako zaplanowany.{' '}
          <button type="button" className="font-medium underline" onClick={() => void saveMatch(match, form.status)}>
            Zapisz stan „{form.status === 'live' ? 'Trwa' : 'Zakończony'}”
          </button>
          , żeby wpisywać zdarzenia.
        </>
      ),
    };
  }
  return { open: false, note: 'Zdarzenia wpiszesz, gdy mecz się zacznie — przełącz stan na „Trwa”.' };
}

export function GateNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** Podpowiedź zgodności z wynikiem (#188 pkt 11 zostawił ją temu ticketowi). */
export function MismatchHint({ match, form, sport, list }: { match: AdminMatch; form: MatchForm; sport: SportCode; list: ProtoEvent[] }) {
  const proto = useProto();
  if (!proto.mismatchHint || form.homeScore === '' || form.awayScore === '') return null;
  // Samobój liczy się drużynie przeciwnej, choć zdarzenie należy do drużyny strzelca.
  let home = 0;
  let away = 0;
  for (const event of list) {
    const type = typeOf(sport, event.type);
    if (!type) continue;
    const value = scoringValue(sport, type);
    const forHome = event.teamId === match.homeTeam?.id;
    const credited = type.code === 'own_goal' ? !forHome : forHome;
    if (credited) home += value;
    else away += value;
  }
  if (home === Number(form.homeScore) && away === Number(form.awayScore)) return null;
  const what = sport === 'football' ? 'Bramki' : 'Punkty';
  return (
    <p className="text-xs text-muted-foreground">
      {what} ze zdarzeń: {home}:{away} · wynik meczu {form.homeScore}:{form.awayScore}. Wynik wpisujesz osobno.
    </p>
  );
}

/** Zapis zdarzeń z toastami i cofnięciem usunięcia. */
export function useEventActions(match: AdminMatch, sport: SportCode) {
  const [pending, setPending] = useState(false);
  async function run<T>(work: () => Promise<T>): Promise<T> {
    setPending(true);
    try {
      return await work();
    } catch (error) {
      if (!(error instanceof ProtoValidationError) || Object.keys(error.errors).length === 0) {
        toast.error(error instanceof Error ? error.message : 'Nie udało się.');
      }
      throw error;
    } finally {
      setPending(false);
    }
  }
  return {
    pending,
    create: (body: EventBody) =>
      run(() => events.create(match, savedStatus(match), sport, body)).then((event) => {
        const type = typeOf(sport, event.type);
        toast.success(`${minuteLabel(event.minute)} ${type?.label}: ${playerLabel(event.playerId)}`, {
          action: { label: 'Cofnij', onClick: () => void events.remove(savedStatus(match), event.id) },
        });
        return event;
      }),
    update: (id: number, patch: Partial<EventBody>) => run(() => events.update(match, savedStatus(match), sport, id, patch)),
    remove: (event: ProtoEvent) =>
      run(() => events.remove(savedStatus(match), event.id)).then(() => {
        toast.success('Usunięto zdarzenie.', { action: { label: 'Cofnij', onClick: () => events.restore(event) } });
      }),
  };
}

export function TeamToggle({
  match,
  value,
  onChange,
  disabled,
}: {
  match: AdminMatch;
  value: number | null;
  onChange: (teamId: number) => void;
  disabled?: boolean;
}) {
  const teams = [match.homeTeam, match.awayTeam].filter((team) => team !== null);
  return (
    <div role="radiogroup" aria-label="Drużyna" className="inline-flex rounded-md border p-0.5">
      {teams.map((team) => (
        <button
          key={team.id}
          type="button"
          role="radio"
          aria-checked={value === team.id}
          disabled={disabled}
          onClick={() => onChange(team.id)}
          className={cn(
            'max-w-36 truncate rounded px-2.5 py-1 text-sm',
            value === team.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
          )}
        >
          {team.name}
        </button>
      ))}
    </div>
  );
}

export function PlayerSelect({
  teamId,
  value,
  onChange,
  disabled,
  error,
  id,
}: {
  teamId: number | null;
  value: number | null;
  onChange: (playerId: number) => void;
  disabled?: boolean;
  error?: string;
  id: string;
}) {
  return (
    <div className="grid content-start gap-1">
      <Select value={value === null ? '' : String(value)} onValueChange={(v) => onChange(Number(v))} disabled={disabled || teamId === null}>
        <SelectTrigger id={id} aria-label="Zawodnik" className="w-full" aria-invalid={!!error}>
          <SelectValue placeholder="Zawodnik" />
        </SelectTrigger>
        <SelectContent>
          {teamId !== null &&
            roster(teamId).map((player) => (
              <SelectItem key={player.id} value={String(player.id)}>
                {player.number === null ? '—' : player.number}. {player.name}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function TypeSelect({
  sport,
  value,
  onChange,
  disabled,
  error,
}: {
  sport: SportCode;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div className="grid content-start gap-1">
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger aria-label="Typ zdarzenia" className="w-full">
          <SelectValue placeholder="Typ" />
        </SelectTrigger>
        <SelectContent>
          {EVENT_TYPES[sport].map((type) => (
            <SelectItem key={type.code} value={type.code}>
              {type.glyph} {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function MinuteInput({
  value,
  onChange,
  disabled,
  error,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <div className={cn('grid content-start gap-1', className)}>
      <Input
        inputMode="numeric"
        aria-label="Minuta"
        placeholder="min"
        value={value}
        disabled={disabled}
        aria-invalid={!!error}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 3))}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function parseMinute(value: string): number | null {
  return value === '' ? null : Number(value);
}

/** Zdarzenie jako jedna linia: minuta, typ, zawodnik, drużyna, wpływ na klasyfikację. */
export function EventLine({
  match,
  sport,
  event,
  onEdit,
  onDelete,
  disabled,
  showTeam = true,
}: {
  match: AdminMatch;
  sport: SportCode;
  event: ProtoEvent;
  onEdit?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  showTeam?: boolean;
}) {
  const type = typeOf(sport, event.type);
  const team = event.teamId === match.homeTeam?.id ? match.homeTeam : match.awayTeam;
  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/60">
      <span className="w-9 shrink-0 text-right font-mono tabular-nums text-muted-foreground">{minuteLabel(event.minute)}</span>
      <span aria-hidden className="w-5 shrink-0 text-center">
        {type?.glyph}
      </span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{type?.label}</span> · {playerLabel(event.playerId)}
        {showTeam && <span className="text-muted-foreground"> ({team?.name})</span>}
        {type?.stat === null && <span className="ml-1 text-xs text-muted-foreground">— nie wlicza się do klasyfikacji</span>}
      </span>
      {onEdit && (
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Edytuj zdarzenie" onClick={onEdit} disabled={disabled}>
          <Pencil />
        </Button>
      )}
      {onDelete && (
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Usuń zdarzenie" onClick={onDelete} disabled={disabled}>
          <Trash2 />
        </Button>
      )}
    </li>
  );
}

/**
 * Pod-okno dodawania i edycji zdarzenia (wzorzec `FormDialog` z #86): zapis po
 * odpowiedzi, `422` przy polu.
 */
export function EventFormDialog({
  match,
  sport,
  event,
  initial,
  onClose,
  deletable,
}: {
  match: AdminMatch;
  sport: SportCode;
  /** Edytowane zdarzenie; bez niego okno dodaje. */
  event?: ProtoEvent;
  initial?: Partial<EventBody>;
  onClose: () => void;
  /** Wariant E: usuwanie siedzi w oknie edycji, za potwierdzeniem. */
  deletable?: boolean;
}) {
  const actions = useEventActions(match, sport);
  const [confirming, setConfirming] = useState(false);
  const proto = useProto();
  const [type, setType] = useState(event?.type ?? initial?.type ?? EVENT_TYPES[sport][0].code);
  const [teamId, setTeamId] = useState<number | null>(event?.teamId ?? initial?.teamId ?? match.homeTeam?.id ?? null);
  const [playerId, setPlayerId] = useState<number | null>(event?.playerId ?? initial?.playerId ?? null);
  const [minute, setMinute] = useState(
    event ? (event.minute?.toString() ?? '') : savedStatus(match) === 'live' ? String(proto.clock) : '',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit() {
    setErrors({});
    const body = { type, teamId: teamId!, playerId, minute: parseMinute(minute) };
    try {
      if (event) await actions.update(event.id, body);
      else await actions.create(body);
      onClose();
    } catch (error) {
      if (error instanceof ProtoValidationError) setErrors(error.errors);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      title={event ? 'Edytuj zdarzenie' : 'Dodaj zdarzenie'}
      submitLabel={event ? 'Zapisz' : 'Dodaj'}
      pending={actions.pending}
    >
      <div className="grid gap-3">
        <div className="grid gap-2">
          <Label>Typ</Label>
          <TypeSelect sport={sport} value={type} onChange={setType} error={errors.type} />
        </div>
        <div className="grid gap-2">
          <Label>Drużyna</Label>
          <TeamToggle
            match={match}
            value={teamId}
            onChange={(next) => {
              setTeamId(next);
              setPlayerId(null);
            }}
          />
          {errors.teamId && <p className="text-sm text-destructive">{errors.teamId}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
          <div className="grid content-start gap-2">
            <Label htmlFor="proto-event-player">Zawodnik</Label>
            <PlayerSelect id="proto-event-player" teamId={teamId} value={playerId} onChange={setPlayerId} error={errors.playerId} />
          </div>
          <div className="grid content-start gap-2">
            <Label>Minuta</Label>
            <MinuteInput value={minute} onChange={setMinute} error={errors.minute} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Minutę można zostawić pustą i uzupełnić później. Doliczony czas: „90+3” wpisz jako 93.</p>
        {event && deletable && (
          <Button type="button" variant="destructive" className="justify-self-start" disabled={actions.pending} onClick={() => setConfirming(true)}>
            <Trash2 /> Usuń zdarzenie
          </Button>
        )}
      </div>
      {event && confirming && (
        <ConfirmDeleteDialog
          open
          onOpenChange={(open) => !open && setConfirming(false)}
          entity="zdarzenie"
          name={`${minuteLabel(event.minute)} ${typeOf(sport, event.type)?.label} · ${playerLabel(event.playerId)}`}
          pending={actions.pending}
          onConfirm={() => void actions.remove(event).then(onClose)}
        />
      )}
    </FormDialog>
  );
}
