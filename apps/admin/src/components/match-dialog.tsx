import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isValidationError, type AdminMatch, type MatchStatus } from '@tournament/api-client';
import {
  FormDialog,
  Label,
  MatchStatusToggle,
  ScoreInputs,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  collisionLabel,
  formatKickoff,
  toast,
} from '@tournament/ui';
import { TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { TextField } from '../components/text-field';
import { api } from '../lib/api';
import { applyApiError } from '../lib/form-errors';
import { scheduleKeys, useVenues } from '../lib/schedule-queries';

const SAVE_FAILED = 'Nie udało się zapisać meczu. Spróbuj ponownie.';

/** Wartość „bez obiektu” w `Select`; pusty napis `Select` traktuje jak brak wyboru. */
const NO_VENUE = 'none';

/**
 * Pola, których `422` umiemy posadzić przy polu (#159): cała para wyników pod
 * blokiem `__ : __` (kontrakt sadza błędy pary pod `homeScore`, a błąd zakresu
 * pod swoim polem), termin i obiekt przy swoich polach. Reszta idzie nad
 * przyciskami.
 */
const FIELDS = ['homeScore', 'awayScore', 'kickoffAt', 'venueId'] as const;

/**
 * `datetime-local` trzyma czas lokalny bez offsetu, a API wymaga momentu
 * z offsetem (ADR-0008). Zamieniamy więc wartość pola na ISO w UTC; strefę
 * bierze przeglądarka, tak jak przy rozkładzie dat.
 */
function toOffsetIso(localValue: string): string {
  return new Date(localValue).toISOString();
}

/** Termin z API (UTC) na wartość `datetime-local` w strefie przeglądarki. */
function toLocalInputValue(iso: string | null): string {
  if (iso === null) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface MatchDialogProps {
  match: AdminMatch;
  tournamentId: number;
  /** Mecze turnieju, żeby opis kolizji mógł wskazać drugą stronę (`collisions` zna tylko `matchId`). */
  matches: AdminMatch[];
  /** Kliknięcie kolizji: otwiera okno tamtego meczu (panel przełącza też kolejkę). */
  onOpenMatch: (match: AdminMatch) => void;
  onClose: () => void;
}

/**
 * Okno meczu (#176): wynik i stan (#159) oraz termin i obiekt (#158) w jednym
 * `PATCH`-u. Reguła przełącznika stanu: „Trwa” na meczu bez wyniku wstawia
 * `0:0`, a „Zaplanowany” czyści oba pola i wysyła jawne `null` — API nie gubi
 * wyniku po cichu.
 *
 * Edycja meczu `finished` idzie bez ostrzeżenia i bez potwierdzenia: tabela
 * liczy się przy odczycie, więc zmiana wyniku jest bezpieczna.
 */
export function MatchDialog({ match, tournamentId, matches, onOpenMatch, onClose }: MatchDialogProps) {
  const queryClient = useQueryClient();
  const venues = useVenues(tournamentId);
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? '');
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? '');
  const [kickoffAt, setKickoffAt] = useState(toLocalInputValue(match.kickoffAt));
  const [venueId, setVenueId] = useState(match.venue ? String(match.venue.id) : NO_VENUE);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string>();

  const home = match.homeTeam?.name ?? 'Do ustalenia';
  const away = match.awayTeam?.name ?? 'Do ustalenia';

  const save = useMutation({
    mutationFn: async () => {
      const result = await api.PATCH('/matches/{match}', {
        params: { path: { match: match.id } },
        body: {
          status,
          homeScore: homeScore === '' ? null : Number(homeScore),
          awayScore: awayScore === '' ? null : Number(awayScore),
          kickoffAt: kickoffAt === '' ? null : toOffsetIso(kickoffAt),
          venueId: venueId === NO_VENUE ? null : Number(venueId),
        },
      });
      if (result.data) return result.data.data;
      throw result.response.status === 422 && isValidationError(result.error) ? result.error : new Error(SAVE_FAILED);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleKeys.matches(tournamentId) }),
        queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId, 'standings'] }),
      ]);
      toast.success('Zapisano mecz.');
      onClose();
    },
    onError: (error) => {
      setFieldErrors({});
      setFormError(undefined);
      applyApiError(
        error,
        FIELDS,
        (field, { message }) => {
          if (field === 'root') setFormError(message);
          // Para wyników dzieli jeden komunikat pod blokiem `__ : __`.
          else if (field === 'homeScore' || field === 'awayScore') setFieldErrors((current) => ({ ...current, homeScore: message }));
          else setFieldErrors((current) => ({ ...current, [field]: message }));
        },
        SAVE_FAILED,
      );
    },
  });

  function changeStatus(next: MatchStatus) {
    setStatus(next);
    if (next === 'scheduled') {
      setHomeScore('');
      setAwayScore('');
    } else if (next === 'live') {
      // Mecz trwający potrzebuje obu wyników: puste pole dostaje zero, a wpisane
      // przez organizera zostaje (`0:0` na meczu bez wyniku).
      setHomeScore((value) => (value === '' ? '0' : value));
      setAwayScore((value) => (value === '' ? '0' : value));
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(undefined);
    save.mutate();
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={submit}
      title={`${home} – ${away}`}
      description={`${match.round.name} · mecz ${match.matchNumber}`}
      submitLabel="Zapisz"
      pending={save.isPending}
      error={formError}
    >
      <div className="grid gap-4">
        <ScoreInputs
          homeValue={homeScore}
          awayValue={awayScore}
          onHomeChange={setHomeScore}
          onAwayChange={setAwayScore}
          homeLabel={`Wynik ${home}`}
          awayLabel={`Wynik ${away}`}
          error={fieldErrors.homeScore}
          disabled={save.isPending}
        />
        <MatchStatusToggle
          value={status}
          onChange={changeStatus}
          disabled={save.isPending}
          className="justify-self-center"
        />

        <div className="grid content-start gap-3 sm:grid-cols-2">
          <TextField
            label="Termin"
            type="datetime-local"
            value={kickoffAt}
            error={fieldErrors.kickoffAt}
            hint="Puste pole to „Termin do ustalenia”."
            disabled={save.isPending}
            onChange={(event) => setKickoffAt(event.target.value)}
          />
          <div className="grid content-start gap-2">
            <Label htmlFor="match-venue">Obiekt</Label>
            <Select value={venueId} onValueChange={setVenueId} disabled={save.isPending}>
              <SelectTrigger id="match-venue" aria-label="Obiekt" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VENUE}>Bez obiektu</SelectItem>
                {(venues.data ?? []).map((venue) => (
                  <SelectItem key={venue.id} value={String(venue.id)}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.venueId && <p className="text-sm text-destructive">{fieldErrors.venueId}</p>}
          </div>
        </div>

        <CollisionList match={match} matches={matches} onOpenMatch={onOpenMatch} />
      </div>
    </FormDialog>
  );
}

/**
 * Kolizje terminu tego meczu (#158). Kontrakt zna tylko `matchId`, więc opis
 * drugiej strony dokłada panel. Kolizja nie blokuje zapisu; kliknięcie otwiera
 * okno tamtego meczu, żeby organizator mógł od razu poprawić termin.
 */
function CollisionList({
  match,
  matches,
  onOpenMatch,
}: {
  match: AdminMatch;
  matches: AdminMatch[];
  onOpenMatch: (match: AdminMatch) => void;
}) {
  const collisions = match.collisions ?? [];
  if (collisions.length === 0) return null;

  return (
    <div className="grid content-start gap-1">
      <p className="text-sm font-medium">Kolizje</p>
      <ul className="space-y-1">
        {collisions.map((collision, index) => {
          const other = matches.find((candidate) => candidate.id === collision.matchId);
          const type = collisionLabel(collision.type);
          if (!other) {
            return (
              <li key={`${collision.type}-${index}`} className="flex items-center gap-2 px-2 text-sm">
                <TriangleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
                <span>{type} z meczem innej fazy</span>
              </li>
            );
          }
          const description = `${other.homeTeam?.name ?? 'Do ustalenia'} – ${other.awayTeam?.name ?? 'Do ustalenia'} (${other.round.name}, ${formatKickoff(other.kickoffAt)})`;
          return (
            <li key={`${collision.type}-${index}`}>
              <button
                type="button"
                onClick={() => onOpenMatch(other)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
              >
                <TriangleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
                <span className="min-w-0">
                  {type}: {description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-2 text-xs text-muted-foreground">Kolizja nie blokuje zapisu.</p>
    </div>
  );
}
