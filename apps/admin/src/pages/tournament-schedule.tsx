import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  firstFieldErrors,
  isValidationError,
  type AdminMatch,
  type Stage,
  type Team,
  type Tournament,
} from '@tournament/api-client';
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  FormDialog,
  Heading,
  Label,
  MatchRow,
  RoundList,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  matchDays,
  toast,
} from '@tournament/ui';
import { CalendarClock, CalendarDays, MoreHorizontal, RefreshCw, Trophy, UserX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { ChoiceCards } from '../components/choice-cards';
import { MatchDialog } from '../components/match-dialog';
import { TextField } from '../components/text-field';
import { api } from '../lib/api';
import { COLLISIONS, MATCHES, plural, ROUNDS, ROUNDS_ACCUSATIVE, TEAMS, TEAMS_PLAYING } from '../lib/plural';
import {
  defaultRound,
  hasStartedMatches,
  roundRobinSize,
  scheduledWithDates,
  scheduleRounds,
  startedFromRound,
  teamsWithoutMatches,
  withCollisionTitles,
  type ScheduleRound,
} from '../lib/schedule';
import { scheduleKeys, useStageMatches, useStages, useVenues } from '../lib/schedule-queries';
import { teamKeys, useTeams } from '../lib/team-queries';
import { useTournament } from './tournament-layout';

/** Parametr adresu z wybraną kolejką: jej `order`, czyli numer z nazwy „Kolejka 7”. */
const ROUND_PARAM = 'round';

const GENERATE_FAILED = 'Nie udało się wygenerować terminarza. Spróbuj ponownie.';

const MEETINGS_REQUIRED = 'Wybierz, ile razy grają ze sobą drużyny.';

const DATES_FAILED = 'Nie udało się rozłożyć dat. Spróbuj ponownie.';

const DURATION_FAILED = 'Nie udało się zapisać długości meczu. Spróbuj ponownie.';

/**
 * Terminarz ligi (#174, wariant D z #162): lista kolejek z boku, mecze
 * wybranej kolejki obok. Kolejki, daty i liczniki panel liczy z meczów fazy,
 * bo kontrakt nie ma listy kolejek.
 *
 * Generowanie, rozkład dat (#175) i ponowne generowanie idą w oknach,
 * otwieranych z akcji nagłówka, z pustego stanu albo z komunikatu. Wiersze są
 * tylko do odczytu; okno meczu dochodzi w #176.
 */
export function TournamentSchedulePage() {
  const tournament = useTournament();
  const stages = useStages(tournament.id);
  const league = stages.data?.find((stage) => stage.type === 'league');
  const matches = useStageMatches(tournament.id, league?.id);
  const teams = useTeams(tournament.id);
  const [generating, setGenerating] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [openMatchId, setOpenMatchId] = useState<number | null>(null);
  const [, setParams] = useSearchParams();

  const started = hasStartedMatches(matches.data ?? []);
  const hasSchedule = (matches.data?.length ?? 0) > 0;
  const selectedMatch = matches.data?.find((match) => match.id === openMatchId);
  const openGenerate = () => setGenerating(true);
  const openDates = () => setDistributing(true);

  /**
   * Otwiera okno meczu i przełącza listę kolejek na jego kolejkę (#176) —
   * używane przy kliknięciu wiersza i przy kliknięciu kolizji, która prowadzi
   * do meczu z innej kolejki.
   */
  function openMatch(match: AdminMatch) {
    setOpenMatchId(match.id);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(ROUND_PARAM, String(match.round.order));
        return next;
      },
      { replace: true },
    );
  }

  let content;
  if (stages.isError || matches.isError) {
    const failed = stages.isError ? stages : matches;
    content = (
      <EmptyState
        variant="error"
        title="Nie udało się wczytać terminarza"
        description={failed.error?.message}
        action={
          <Button variant="outline" onClick={() => void failed.refetch()}>
            Spróbuj ponownie
          </Button>
        }
      />
    );
  } else if (stages.data && !league) {
    content = <WithoutLeague stages={stages.data} />;
  } else if (!matches.data) {
    content = (
      <Card aria-busy="true" aria-label="Wczytywanie terminarza">
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  } else if (!hasSchedule) {
    const count = teams.data?.length;
    content = (
      <EmptyState
        icon={<CalendarDays />}
        title="Terminarz nie jest jeszcze wygenerowany"
        description={
          count === undefined
            ? undefined
            : count < 2
              ? 'Liga potrzebuje co najmniej dwóch drużyn. Dodaj je w zakładce Drużyny.'
              : `${count} ${plural(count, TEAMS_PLAYING)} każdy z każdym. Najpierw powstaną pary i kolejki, daty rozłożysz potem.`
        }
        action={
          count !== undefined && count < 2 ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button disabled>
                <RefreshCw className="size-4" /> Wygeneruj terminarz
              </Button>
              <Button asChild variant="outline">
                <Link to={`/tournaments/${tournament.id}/teams`}>Przejdź do drużyn</Link>
              </Button>
            </div>
          ) : (
            <Button disabled={count === undefined} onClick={openGenerate}>
              <RefreshCw className="size-4" /> Wygeneruj terminarz
            </Button>
          )
        }
      />
    );
  } else {
    const rounds = scheduleRounds(withCollisionTitles(matches.data));
    content = (
      <>
        <MissingTeamsNotice
          teams={teamsWithoutMatches(teams.data ?? [], matches.data)}
          started={started}
          onGenerate={openGenerate}
        />
        <WithoutDatesNotice matches={matches.data} onDistribute={openDates} />
        <RoundsView rounds={rounds} onSelectMatch={openMatch} />
      </>
    );
  }

  return (
    <AdminPage
      tournament={tournament}
      section="schedule"
      actions={
        league &&
        hasSchedule && (
          <>
            <Button variant="outline" onClick={openDates}>
              <CalendarClock className="size-4" /> Rozłóż daty
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Więcej akcji terminarza">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                {/* Wyłączona, a nie ukryta: organizer widzi, że akcja istnieje,
                    tylko faza ma już mecze rozpoczęte (#157). */}
                <DropdownMenuItem disabled={started} onSelect={openGenerate}>
                  <RefreshCw /> Wygeneruj ponownie
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )
      }
    >
      {content}
      {generating && league && (
        <GenerateDialog
          tournamentId={tournament.id}
          stage={league}
          teamsCount={teams.data?.length ?? 0}
          currentMatches={matches.data?.length ?? 0}
          onClose={() => setGenerating(false)}
        />
      )}
      {distributing && league && matches.data && (
        <DatesDialog
          tournament={tournament}
          stage={league}
          matches={matches.data}
          rounds={scheduleRounds(withCollisionTitles(matches.data))}
          onClose={() => setDistributing(false)}
        />
      )}
      {selectedMatch && (
        <MatchDialog
          key={selectedMatch.id}
          match={selectedMatch}
          tournamentId={tournament.id}
          matches={matches.data ?? []}
          onOpenMatch={openMatch}
          onClose={() => setOpenMatchId(null)}
          sportCode={tournament.sport.code}
        />
      )}
    </AdminPage>
  );
}

/**
 * Turniej bez fazy `league` nie dostaje żadnej akcji (#157): generowanie
 * działa na razie tylko dla ligi, a drabinkę i grupy dowiozą S4 i S5.
 */
function WithoutLeague({ stages }: { stages: Stage[] }) {
  const knockoutOnly = stages.every((stage) => stage.type === 'knockout');
  return (
    <EmptyState
      icon={<Trophy />}
      title={
        knockoutOnly
          ? 'Terminarz pucharu pojawi się razem z drabinką'
          : 'Terminarz fazy grupowej pojawi się razem z grupami'
      }
      description="Generowanie terminarza działa na razie tylko dla ligi."
    />
  );
}

/**
 * Drużyna dodana po wygenerowaniu terminarza nie ma w nim meczów (#161).
 * Akcja generowania zostaje przy komunikacie, ale przy meczu rozpoczętym jest
 * wyłączona tak samo jak w menu „⋯”.
 */
function MissingTeamsNotice({
  teams,
  started,
  onGenerate,
}: {
  teams: Team[];
  started: boolean;
  onGenerate: () => void;
}) {
  if (teams.length === 0) return null;
  const names = teams.map((team) => team.name).join(', ');
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
      <UserX aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1">
        {teams.length === 1
          ? `Drużyna ${names} nie ma meczów w terminarzu — wygeneruj go ponownie.`
          : `Drużyny ${names} nie mają meczów w terminarzu — wygeneruj go ponownie.`}
      </p>
      <Button size="sm" variant="outline" disabled={started} onClick={onGenerate}>
        Wygeneruj ponownie
      </Button>
    </div>
  );
}

/**
 * Świeżo wygenerowany terminarz nie ma dat (#158). Gdy żaden mecz nie ma
 * terminu, nad listą stoi podpowiedź z tym samym przyciskiem co w nagłówku.
 */
function WithoutDatesNotice({ matches, onDistribute }: { matches: AdminMatch[]; onDistribute: () => void }) {
  if (matches.length === 0 || matches.some((match) => match.kickoffAt !== null)) return null;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
      <CalendarClock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1">
        Terminarz nie ma jeszcze dat. Rozłóż je, żeby mecze dostały terminy i obiekty.
      </p>
      <Button size="sm" variant="outline" onClick={onDistribute}>
        Rozłóż daty
      </Button>
    </div>
  );
}

/**
 * Kolejka z adresu (`?round=7`, po `order`), więc wybór przetrwa
 * odświeżenie. Bez parametru albo z numerem, którego nie ma, otwiera się
 * pierwsza kolejka z meczem niezakończonym (#162, pkt 1).
 */
function RoundsView({
  rounds,
  onSelectMatch,
}: {
  rounds: ScheduleRound[];
  onSelectMatch: (match: AdminMatch) => void;
}) {
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get(ROUND_PARAM));
  const round = rounds.find((candidate) => candidate.order === requested) ?? defaultRound(rounds);
  if (!round) return null;

  const oneDay = matchDays(round.matches.map((match) => match.kickoffAt)).length === 1;

  function select(id: number) {
    const target = rounds.find((candidate) => candidate.id === id);
    if (!target) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(ROUND_PARAM, String(target.order));
        return next;
      },
      { replace: true },
    );
  }

  return (
    <div className="grid items-start gap-4 md:grid-cols-[15rem_minmax(0,1fr)]">
      <RoundList
        rounds={rounds.map((candidate) => candidate.summary)}
        value={round.id}
        onValueChange={select}
        className="md:sticky md:top-4"
      />
      <section aria-labelledby="schedule-round" className="min-w-0 space-y-2">
        {/* Na telefonie nazwę i daty kolejki niesie już przycisk listy kolejek. */}
        <div className="hidden flex-wrap items-baseline gap-x-2 md:flex">
          <Heading level="card" id="schedule-round">
            {round.name}
          </Heading>
          <span className="text-sm text-muted-foreground">{round.summary.dates}</span>
        </div>
        <ul className="space-y-2">
          {round.matches.map((match) => (
            <li key={match.id}>
              <MatchRow match={match} showDate={!oneDay} onSelect={() => onSelectMatch(match)} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * Okno generowania (#162, pkt 8): „raz / dwa razy” bez zaznaczenia na
 * starcie, z liczbą kolejek i meczów przy każdej opcji. Przy istniejącym
 * terminarzu tytuł, ostrzeżenie i przycisk mówią o zastąpieniu, bo API
 * zastępuje bez pytania (#157).
 *
 * `422` siada w oknie: brak wyboru przy polu, odmowa ze stanu fazy (`stage`,
 * `teams`) nad przyciskami. Sukces unieważnia mecze i drużyny (liczniki meczów
 * zaplanowanych), a okno zamyka się dopiero po odświeżeniu listy.
 */
function GenerateDialog({
  tournamentId,
  stage,
  teamsCount,
  currentMatches,
  onClose,
}: {
  tournamentId: number;
  stage: Stage;
  teamsCount: number;
  currentMatches: number;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [meetings, setMeetings] = useState<1 | 2 | null>(null);
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const replacing = currentMatches > 0;

  const generate = useMutation({
    mutationFn: async (value: 1 | 2) => {
      let result;
      try {
        result = await api.POST('/stages/{stage}/schedule', {
          params: { path: { stage: stage.id } },
          body: { meetings: value },
        });
      } catch (cause) {
        // `fetch` bez odpowiedzi (sieć) odrzuca `TypeError`. Inny wyjątek to
        // błąd w kodzie i ma polecieć dalej, a nie udawać padniętej sieci.
        if (cause instanceof TypeError) throw new Error(GENERATE_FAILED);
        throw cause;
      }
      const { data, error, response } = result;
      if (data) return data.data;
      throw response.status === 422 && isValidationError(error) ? error : new Error(GENERATE_FAILED);
    },
    onSuccess: async ({ roundsCount, matchesCount }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleKeys.matches(tournamentId) }),
        queryClient.invalidateQueries({ queryKey: teamKeys.list(tournamentId) }),
      ]);
      toast.success(
        `Wygenerowano ${roundsCount} ${plural(roundsCount, ROUNDS_ACCUSATIVE)}, ${matchesCount} ${plural(matchesCount, MATCHES)}`,
      );
      onClose();
    },
    onError: (error) => {
      if (isValidationError(error)) {
        const { meetings: meetingsError, ...rest } = firstFieldErrors(error);
        setFieldError(meetingsError);
        setFormError(Object.values(rest)[0]);
      } else {
        setFormError(error.message);
      }
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    if (meetings === null) {
      setFieldError(MEETINGS_REQUIRED);
      return;
    }
    setFieldError(undefined);
    generate.mutate(meetings);
  }

  const option = (value: 1 | 2, label: string) => {
    const { roundsCount, matchesCount } = roundRobinSize(teamsCount, value);
    return {
      value,
      label,
      description: `${roundsCount} ${plural(roundsCount, ROUNDS)}, ${matchesCount} ${plural(matchesCount, MATCHES)}`,
    };
  };

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={submit}
      title={replacing ? 'Wygeneruj terminarz ponownie' : 'Wygeneruj terminarz'}
      description={`${stage.name} · ${teamsCount} ${plural(teamsCount, TEAMS)}. Kolejność drużyn jest losowana.`}
      submitLabel={replacing ? 'Zastąp terminarz' : 'Wygeneruj'}
      pending={generate.isPending}
      error={formError}
    >
      <ChoiceCards
        legend="Każdy z każdym"
        name="meetings"
        options={[option(1, 'Raz'), option(2, 'Dwa razy (mecz i rewanż)')]}
        value={meetings}
        onChange={(value) => {
          setMeetings(value);
          setFieldError(undefined);
        }}
        errorMessage={fieldError}
        className="gap-3 lg:grid-cols-2"
      />
      {replacing && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Obecny terminarz ({currentMatches} {plural(currentMatches, MATCHES)}) zniknie razem z terminami
          i obiektami, także poprawionymi ręcznie.
        </p>
      )}
      <p className="text-xs text-muted-foreground">Mecze powstaną bez dat.</p>
    </FormDialog>
  );
}

/** Klucze `422`, które umiemy posadzić przy polu; reszta idzie nad przyciskami. */
const DATES_FIELDS = ['startAt', 'intervalDays', 'dayEndTime', 'venueIds', 'matchDuration', 'fromRound'] as const;

/**
 * Okno rozkładu dat (#175, wkład #158 w #162): tryb „co N dni” albo „ciągiem”,
 * start, odstęp albo koniec dnia, obiekty, długość meczu i „od kolejki”.
 * Strefę bierze z przeglądarki, a `datetime-local` dostaje jej offset przed
 * wysłaniem (ADR-0008), więc backend dostaje jednoznaczny moment.
 *
 * Gdy w zakresie są mecze `scheduled` z datą, okno przechodzi w drugi krok
 * potwierdzenia, bo rozkład nadpisuje także ręczne korekty. Przy zmienionej
 * długości meczu najpierw idzie `PATCH` turnieju, potem rozkład.
 */
function DatesDialog({
  tournament,
  stage,
  matches,
  rounds,
  onClose,
}: {
  tournament: Tournament;
  stage: Stage;
  matches: AdminMatch[];
  rounds: ScheduleRound[];
  onClose: () => void;
}) {
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
      description={`${stage.name} · ${rounds.length} ${plural(rounds.length, ROUNDS)} · strefa ${timeZone}`}
      submitLabel={confirming ? 'Tak, nadpisz terminy' : 'Rozłóż'}
      pending={pending}
      error={formError}
    >
      {confirming ? (
        <div className="space-y-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <p>
            Nadpiszesz terminy i obiekty {overwritten} zaplanowanych meczów od kolejki {from}, także te poprawione
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
              label="Start (pierwsza kolejka)"
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
                ? `${venueIds.length} meczów kolejki naraz, w tej kolejności.`
                : 'Bez obiektów cała kolejka gra o jednej godzinie.'}
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
              <Label htmlFor="from-round">Od kolejki</Label>
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
