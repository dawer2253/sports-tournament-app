import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstFieldErrors, isValidationError, type Stage, type Team } from '@tournament/api-client';
import {
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  FormDialog,
  Heading,
  MatchRow,
  RoundList,
  Skeleton,
  matchDays,
  toast,
} from '@tournament/ui';
import { CalendarDays, MoreHorizontal, RefreshCw, Trophy, UserX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { ChoiceCards } from '../components/choice-cards';
import { api } from '../lib/api';
import { MATCHES, plural, ROUNDS, ROUNDS_ACCUSATIVE, TEAMS, TEAMS_PLAYING } from '../lib/plural';
import {
  defaultRound,
  hasStartedMatches,
  roundRobinSize,
  scheduleRounds,
  teamsWithoutMatches,
  type ScheduleRound,
} from '../lib/schedule';
import { scheduleKeys, useStageMatches, useStages } from '../lib/schedule-queries';
import { teamKeys, useTeams } from '../lib/team-queries';
import { useTournament } from './tournament-layout';

/** Parametr adresu z wybraną kolejką: jej `order`, czyli numer z nazwy „Kolejka 7”. */
const ROUND_PARAM = 'round';

const GENERATE_FAILED = 'Nie udało się wygenerować terminarza. Spróbuj ponownie.';

const MEETINGS_REQUIRED = 'Wybierz, ile razy grają ze sobą drużyny.';

/**
 * Terminarz ligi (#174, wariant D z #162): lista kolejek z boku, mecze
 * wybranej kolejki obok. Kolejki, daty i liczniki panel liczy z meczów fazy,
 * bo kontrakt nie ma listy kolejek.
 *
 * Generowanie i ponowne generowanie idą w jednym oknie (`GenerateDialog`),
 * otwieranym z pustego stanu, z menu „⋯” w nagłówku albo z komunikatu
 * o drużynie bez meczów. Wiersze są tylko do odczytu; okno meczu dochodzi
 * w #176.
 */
export function TournamentSchedulePage() {
  const tournament = useTournament();
  const stages = useStages(tournament.id);
  const league = stages.data?.find((stage) => stage.type === 'league');
  const matches = useStageMatches(tournament.id, league?.id);
  const teams = useTeams(tournament.id);
  const [generating, setGenerating] = useState(false);

  const started = hasStartedMatches(matches.data ?? []);
  const hasSchedule = (matches.data?.length ?? 0) > 0;
  const openGenerate = () => setGenerating(true);

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
    content = (
      <>
        <MissingTeamsNotice
          teams={teamsWithoutMatches(teams.data ?? [], matches.data)}
          started={started}
          onGenerate={openGenerate}
        />
        <RoundsView rounds={scheduleRounds(matches.data)} />
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
 * Kolejka z adresu (`?round=7`, po `order`), więc wybór przetrwa
 * odświeżenie. Bez parametru albo z numerem, którego nie ma, otwiera się
 * pierwsza kolejka z meczem niezakończonym (#162, pkt 1).
 */
function RoundsView({ rounds }: { rounds: ScheduleRound[] }) {
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
              <MatchRow match={match} showDate={!oneDay} />
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
      } catch {
        // `fetch` bez odpowiedzi (sieć) odrzuca `TypeError`.
        throw new Error(GENERATE_FAILED);
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
