import { useQueryClient } from '@tanstack/react-query';
import { firstFieldErrors, isValidationError, type AdminMatch, type Stage, type Tournament } from '@tournament/api-client';
import {
  Button,
  Checkbox,
  FormDialog,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@tournament/ui';
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { COLLISIONS, MATCHES, plural } from '../lib/plural';
import { scheduledWithDates, startedFromRound } from '../lib/schedule';
import { scheduleKeys, useVenues } from '../lib/schedule-queries';
import { ChoiceCards } from './choice-cards';
import { TextField } from './text-field';

const DATES_FAILED = 'Nie udało się rozłożyć dat. Spróbuj ponownie.';

const DURATION_FAILED = 'Nie udało się zapisać długości meczu. Spróbuj ponownie.';

/** Klucze `422`, które umiemy posadzić przy polu; reszta idzie nad przyciskami. */
const DATES_FIELDS = ['startAt', 'intervalDays', 'dayEndTime', 'venueIds', 'matchDuration', 'fromRound'] as const;

/**
 * Słowa okna, które zależą od fazy: w lidze „kolejka”, w drabince „runda”
 * (`Round` w `CONTEXT.md`). Pola są te same, zmieniają się tylko podpisy.
 */
const UNIT_WORDS = {
  kolejka: {
    start: 'Start (pierwsza kolejka)',
    from: 'Od kolejki',
    fromGenitive: 'od kolejki',
    genitive: 'kolejki',
    nominative: 'cała kolejka',
    plural: ['kolejka', 'kolejki', 'kolejek'],
  },
  runda: {
    start: 'Start (pierwsza runda)',
    from: 'Od rundy',
    fromGenitive: 'od rundy',
    genitive: 'rundy',
    nominative: 'cała runda',
    plural: ['runda', 'rundy', 'rund'],
  },
} as const;

/** Kolejka albo runda do wyboru w „od kolejki / od rundy”. */
export interface DatesRound {
  id: number;
  name: string;
  order: number;
}

/**
 * Okno rozkładu dat (#175, wkład #158 w #162): tryb „co N dni” albo „ciągiem”,
 * start, odstęp albo koniec dnia, obiekty, długość meczu i „od kolejki”.
 * Strefę bierze z przeglądarki, a `datetime-local` dostaje jej offset przed
 * wysłaniem (ADR-0008), więc backend dostaje jednoznaczny moment.
 *
 * Gdy w zakresie są mecze `scheduled` z datą, okno przechodzi w drugi krok
 * potwierdzenia, bo rozkład nadpisuje także ręczne korekty. Przy zmienionej
 * długości meczu najpierw idzie `PATCH` turnieju, potem rozkład.
 *
 * Wspólne dla Terminarza ligi i Drabinki pucharu (#227): `unit` zmienia tylko
 * podpisy („od kolejki” albo „od rundy”), a pola i wysyłka zostają te same.
 */
export function DatesDialog({
  tournament,
  stage,
  matches,
  rounds,
  unit = 'kolejka',
  onClose,
}: {
  tournament: Tournament;
  stage: Stage;
  matches: AdminMatch[];
  rounds: DatesRound[];
  unit?: keyof typeof UNIT_WORDS;
  onClose: () => void;
}) {
  const words = UNIT_WORDS[unit];
  const queryClient = useQueryClient();
  const venues = useVenues(tournament.id);
  const [mode, setMode] = useState<'interval' | 'continuous'>('interval');
  const [startAt, setStartAt] = useState('');
  const [intervalDays, setIntervalDays] = useState('7');
  const [dayEndTime, setDayEndTime] = useState('');
  const [venueIds, setVenueIds] = useState<number[]>([]);
  const [duration, setDuration] = useState(String(tournament.matchDuration));
  const [fromRound, setFromRound] = useState('first');
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string>();

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const from = fromRound === 'first' ? 1 : Number(fromRound);
  const overwritten = scheduledWithDates(matches, from).length;
  const kept = startedFromRound(matches, from);

  function toggleVenue(id: number, checked: boolean) {
    setVenueIds((current) => (checked ? [...current, id] : current.filter((venueId) => venueId !== id)));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);

    if (!startAt) {
      setFieldErrors({ startAt: 'Podaj datę i godzinę startu.' });
      return;
    }
    if (mode === 'interval' && (!intervalDays || Number(intervalDays) < 1)) {
      setFieldErrors({ intervalDays: 'Podaj odstęp to co najmniej jeden dzień.' });
      return;
    }
    setFieldErrors({});

    // Drugi krok: rozkład nadpisze istniejące terminy w zakresie.
    if (overwritten > 0 && !confirming) {
      setConfirming(true);
      return;
    }

    void distribute();
  }

  async function distribute() {
    setPending(true);
    setFormError(undefined);
    try {
      if (Number(duration) !== tournament.matchDuration) {
        const saved = await api.PATCH('/tournaments/{tournament}', {
          params: { path: { tournament: tournament.id } },
          body: { matchDuration: Number(duration) },
        });
        if (!saved.data) throw apiFailure(saved.error, saved.response.status, DURATION_FAILED);
      }

      const result = await api.POST('/stages/{stage}/schedule/dates', {
        params: { path: { stage: stage.id } },
        body: {
          mode,
          startAt: new Date(startAt).toISOString(),
          timeZone,
          intervalDays: mode === 'interval' ? Number(intervalDays) : null,
          dayEndTime: mode === 'continuous' && dayEndTime ? dayEndTime : null,
          venueIds,
          fromRound: fromRound === 'first' ? null : Number(fromRound),
        },
      });

      if (!result.data) throw apiFailure(result.error, result.response.status, DATES_FAILED);

      const { matchesCount, collisionsCount } = result.data.data;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleKeys.matches(tournament.id) }),
        queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] }),
      ]);
      toast.success(
        `Rozłożono ${matchesCount} ${plural(matchesCount, MATCHES)}${collisionsCount > 0 ? `, ${collisionsCount} ${plural(collisionsCount, COLLISIONS)}` : ', bez kolizji'}`,
      );
      onClose();
    } catch (cause) {
      if (cause instanceof TypeError) {
        setFormError(DATES_FAILED);
        setConfirming(false);
        return;
      }
      if (isValidationError(cause)) {
        const errors = firstFieldErrors(cause);
        setFieldErrors(Object.fromEntries(DATES_FIELDS.map((field) => [field, errors[field]])));
        setFormError(errors.stage ?? errors.mode ?? errors.venueIds);
        setConfirming(false);
        return;
      }
      setFormError(cause instanceof Error ? cause.message : DATES_FAILED);
      setConfirming(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={submit}
      title="Rozłóż daty"
      description={`${stage.name} · ${rounds.length} ${plural(rounds.length, words.plural)} · strefa ${timeZone}`}
      submitLabel={confirming ? 'Tak, nadpisz terminy' : 'Rozłóż'}
      pending={pending}
      error={formError}
    >
      {confirming ? (
        <div className="space-y-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <p>
            Nadpiszesz terminy i obiekty {overwritten} zaplanowanych meczów {words.fromGenitive} {from}, także te poprawione
            ręcznie.
          </p>
          {kept > 0 && <p>Mecze trwające i zakończone ({kept}) zachowają swój termin.</p>}
          <Button type="button" variant="link" className="h-auto p-0" onClick={() => setConfirming(false)}>
            Wróć do formularza
          </Button>
        </div>
      ) : (
        <>
          <ChoiceCards
            legend="Tryb rozkładu"
            name="mode"
            options={[
              { value: 'interval', label: 'Co N dni', description: 'Liga sezonowa: kolejka co tydzień' },
              { value: 'continuous', label: 'Ciągiem', description: 'Turniej jedno-, dwudniowy: mecz za meczem' },
            ]}
            value={mode}
            onChange={(value) => {
              setMode(value);
              setFieldErrors({});
            }}
            className="gap-3 lg:grid-cols-2"
          />
          <div className="grid content-start gap-3 sm:grid-cols-2">
            <TextField
              label={words.start}
              type="datetime-local"
              value={startAt}
              error={fieldErrors.startAt}
              onChange={(event) => setStartAt(event.target.value)}
            />
            {mode === 'interval' ? (
              <TextField
                label="Co ile dni"
                type="number"
                min={1}
                value={intervalDays}
                error={fieldErrors.intervalDays}
                onChange={(event) => setIntervalDays(event.target.value)}
              />
            ) : (
              <TextField
                label="Koniec dnia (opcjonalnie)"
                type="time"
                value={dayEndTime}
                error={fieldErrors.dayEndTime}
                onChange={(event) => setDayEndTime(event.target.value)}
              />
            )}
          </div>
          <fieldset className="grid content-start gap-2">
            <legend className="text-sm font-medium">Obiekty</legend>
            <div className="flex flex-wrap gap-2">
              {(venues.data ?? []).map((venue) => (
                <Label key={venue.id} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-normal">
                  <Checkbox
                    checked={venueIds.includes(venue.id)}
                    onCheckedChange={(checked) => toggleVenue(venue.id, checked === true)}
                  />
                  {venue.name}
                </Label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {venueIds.length > 0
                ? `${venueIds.length} meczów ${words.genitive} naraz, w tej kolejności.`
                : `Bez obiektów ${words.nominative} gra o jednej godzinie.`}
            </p>
            {fieldErrors.venueIds && <p className="text-sm text-destructive">{fieldErrors.venueIds}</p>}
          </fieldset>
          <div className="grid content-start gap-3 sm:grid-cols-2">
            <TextField
              label="Długość meczu (min)"
              type="number"
              min={10}
              max={600}
              value={duration}
              error={fieldErrors.matchDuration}
              onChange={(event) => setDuration(event.target.value)}
              hint="Zmieni długość meczu w całym turnieju."
            />
            <div className="grid content-start gap-2">
              <Label htmlFor="from-round">{words.from}</Label>
              <Select value={fromRound} onValueChange={setFromRound}>
                <SelectTrigger id="from-round">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first">od pierwszej</SelectItem>
                  {rounds.map((round) => (
                    <SelectItem key={round.id} value={String(round.order)}>
                      {round.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.fromRound && <p className="text-sm text-destructive">{fieldErrors.fromRound}</p>}
            </div>
          </div>
        </>
      )}
    </FormDialog>
  );
}

/** `422` z walidacji trzyma komunikaty pod polami, reszta dostaje komunikat ogólny. */
function apiFailure(error: unknown, status: number, fallback: string): unknown {
  return status === 422 && isValidationError(error) ? error : new Error(fallback);
}
