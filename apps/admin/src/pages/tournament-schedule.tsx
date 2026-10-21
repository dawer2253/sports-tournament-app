import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstFieldErrors, isValidationError, type AdminMatch, type Stage, type Team } from '@tournament/api-client';
import {
  Badge,
  Button,
  Card,
  CardContent,
  ChoiceCards,
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
  isKnockoutOnly,
  matchDays,
  toast,
} from '@tournament/ui';
import { CalendarClock, CalendarDays, MoreHorizontal, RefreshCw, Trophy, UserX, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DatesDialog } from '../components/dates-dialog';
import { GroupFilterChips } from '../components/group-filter-chips';
import { MatchDialog } from '../components/match-dialog';
import { SectionActions } from '../components/section-actions';
import { api } from '../lib/api';
import { GROUPS, MATCHES, plural, ROUNDS, ROUNDS_ACCUSATIVE, TEAMS, TEAMS_PLAYING } from '../lib/plural';
import {
  defaultRound,
  groupScheduleSize,
  hasStartedMatches,
  roundRobinSize,
  scheduleRounds,
  teamsWithoutMatches,
  withCollisionTitles,
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
 * Terminarz fazy rozgrywek (#174, wariant D z #162): lista kolejek z boku,
 * mecze wybranej kolejki obok. Obsługuje ligę i fazę grupową (#258) — w fazie
 * grupowej kolejka jest wspólna dla wszystkich grup, więc dochodzi filtr po
 * grupie, a bez filtra wiersz niesie plakietkę swojej grupy. Kolejki, daty
 * i liczniki panel liczy z meczów fazy, bo kontrakt nie ma listy kolejek.
 *
 * Generowanie, rozkład dat (#175) i ponowne generowanie idą w oknach,
 * otwieranych z akcji nagłówka, z pustego stanu albo z komunikatu. Wiersze są
 * tylko do odczytu; okno meczu dochodzi w #176.
 */
export function TournamentSchedulePage() {
  const tournament = useTournament();
  const stages = useStages(tournament.id);
  const stage = stages.data?.find((candidate) => candidate.type === 'league' || candidate.type === 'group');
  const matches = useStageMatches(tournament.id, stage?.id);
  const teams = useTeams(tournament.id);
  const [generating, setGenerating] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [openMatchId, setOpenMatchId] = useState<number | null>(null);
  const [groupFilter, setGroupFilter] = useState<number | null>(null);
  const [, setParams] = useSearchParams();

  const isGroup = stage?.type === 'group';
  const groups = stage?.groups ?? [];
  const started = hasStartedMatches(matches.data ?? []);
  const hasSchedule = (matches.data?.length ?? 0) > 0;
  const selectedMatch = matches.data?.find((match) => match.id === openMatchId);
  const unassigned = (teams.data ?? []).filter((team) => team.groupId === null);
  const groupSizes = groups.map((group) => (teams.data ?? []).filter((team) => team.groupId === group.id).length);
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
  } else if (stages.data && !stage) {
    content = <WithoutScheduleStage tournamentId={tournament.id} stages={stages.data} />;
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
  } else if (isGroup && groups.length === 0) {
    content = (
      <EmptyState
        icon={<Users />}
        title="Najpierw ustal skład grup"
        description="Faza grupowa powstaje z grup. Ich skład ustala karta Grupy."
        action={
          <Button asChild>
            <Link to={`/tournaments/${tournament.id}/groups`}>Przejdź do grup</Link>
          </Button>
        }
      />
    );
  } else if (!hasSchedule) {
    content = (
      <>
        {isGroup && <UnassignedTeamsNotice teams={unassigned} tournamentId={tournament.id} />}
        <EmptySchedule
          isGroup={isGroup}
          tournamentId={tournament.id}
          teamsCount={teams.data?.length}
          groupsCount={groups.length}
          onGenerate={openGenerate}
        />
      </>
    );
  } else {
    const rounds = scheduleRounds(withCollisionTitles(matches.data));
    content = (
      <>
        {isGroup ? (
          <UnassignedTeamsNotice teams={unassigned} tournamentId={tournament.id} />
        ) : (
          <MissingTeamsNotice
            teams={teamsWithoutMatches(teams.data ?? [], matches.data)}
            started={started}
            onGenerate={openGenerate}
          />
        )}
        <WithoutDatesNotice matches={matches.data} onDistribute={openDates} />
        {isGroup && groups.length > 0 && (
          <GroupFilterChips groups={groups} value={groupFilter} onChange={setGroupFilter} className="mb-4" />
        )}
        <RoundsView
          rounds={rounds}
          groups={isGroup ? groups : []}
          groupFilter={isGroup ? groupFilter : null}
          onSelectMatch={openMatch}
        />
      </>
    );
  }

  return (
    <>
      <SectionActions>
        {stage && hasSchedule && (
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
        )}
      </SectionActions>
      {content}
      {generating && stage && (
        <GenerateDialog
          tournamentId={tournament.id}
          stage={stage}
          teamsCount={teams.data?.length ?? 0}
          currentMatches={matches.data?.length ?? 0}
          groupSizes={isGroup ? groupSizes : undefined}
          missingGroup={isGroup ? unassigned[0]?.name : undefined}
          onClose={() => setGenerating(false)}
        />
      )}
      {distributing && stage && matches.data && (
        <DatesDialog
          tournament={tournament}
          stage={stage}
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
          periods={tournament.periods}
          setFormat={tournament.setFormat}
        />
      )}
    </>
  );
}

/**
 * Turniej bez fazy `league` ani `group` nie dostaje żadnej akcji generowania
 * (#157). W pucharze Terminarz zastępuje Drabinka (#227): karta jest
 * w nawigacji nieczynna, a wejście z adresu odsyła tam.
 */
function WithoutScheduleStage({ tournamentId, stages }: { tournamentId: number; stages: Stage[] }) {
  if (isKnockoutOnly(stages)) {
    return (
      <EmptyState
        icon={<Trophy />}
        title="W pucharze terminarzem jest drabinka"
        description="Rundy, pary i daty meczów pucharu są na karcie Drabinka."
        action={
          <Button asChild>
            <Link to={`/tournaments/${tournamentId}/bracket`}>Przejdź do drabinki</Link>
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={<Trophy />}
      title="Ten turniej nie ma terminarza"
      description="Terminarz układa faza ligowa albo grupowa."
    />
  );
}

/**
 * Pusty terminarz fazy: z pustego stanu otwiera się to samo okno generowania
 * co z nagłówka. Liga potrzebuje dwóch drużyn, faza grupowa — ustalonego składu
 * (#258).
 */
function EmptySchedule({
  isGroup,
  tournamentId,
  teamsCount,
  groupsCount,
  onGenerate,
}: {
  isGroup: boolean;
  tournamentId: number;
  teamsCount: number | undefined;
  groupsCount: number;
  onGenerate: () => void;
}) {
  if (isGroup) {
    return (
      <EmptyState
        icon={<CalendarDays />}
        title="Terminarz grup nie jest jeszcze wygenerowany"
        description={`${groupsCount} ${plural(groupsCount, GROUPS)}, każdy z każdym w swojej grupie. Kolejka jest wspólna dla wszystkich grup.`}
        action={
          <Button disabled={teamsCount === undefined} onClick={onGenerate}>
            <RefreshCw className="size-4" /> Wygeneruj terminarz
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={<CalendarDays />}
      title="Terminarz nie jest jeszcze wygenerowany"
      description={
        teamsCount === undefined
          ? undefined
          : teamsCount < 2
            ? 'Liga potrzebuje co najmniej dwóch drużyn. Dodaj je w zakładce Drużyny.'
            : `${teamsCount} ${plural(teamsCount, TEAMS_PLAYING)} każdy z każdym. Najpierw powstaną pary i kolejki, daty rozłożysz potem.`
      }
      action={
        teamsCount !== undefined && teamsCount < 2 ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button disabled>
              <RefreshCw className="size-4" /> Wygeneruj terminarz
            </Button>
            <Button asChild variant="outline">
              <Link to={`/tournaments/${tournamentId}/teams`}>Przejdź do drużyn</Link>
            </Button>
          </div>
        ) : (
          <Button disabled={teamsCount === undefined} onClick={onGenerate}>
            <RefreshCw className="size-4" /> Wygeneruj terminarz
          </Button>
        )
      }
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
 * Drużyna dodana po ustaleniu składu grup nie ma grupy (#258), więc terminarza
 * fazy grupowej nie da się wygenerować. Odnośnik prowadzi do karty Grupy, gdzie
 * organizer zapisuje skład od nowa.
 */
function UnassignedTeamsNotice({ teams, tournamentId }: { teams: Team[]; tournamentId: number }) {
  if (teams.length === 0) return null;
  const names = teams.map((team) => team.name).join(', ');
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
      <UserX aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1">
        {teams.length === 1
          ? `Drużyna ${names} nie ma grupy. Zapisz skład grup od nowa.`
          : `Drużyny ${names} nie mają grupy. Zapisz skład grup od nowa.`}
      </p>
      <Button size="sm" variant="outline" asChild>
        <Link to={`/tournaments/${tournamentId}/groups`}>Przejdź do grup</Link>
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
 *
 * W fazie grupowej dochodzi filtr po grupie (#258): filtruje mecze w kolejce,
 * a bez filtra każdy wiersz niesie plakietkę grupy.
 */
function RoundsView({
  rounds,
  groups,
  groupFilter,
  onSelectMatch,
}: {
  rounds: ScheduleRound[];
  groups: Stage['groups'];
  groupFilter: number | null;
  onSelectMatch: (match: AdminMatch) => void;
}) {
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get(ROUND_PARAM));
  const round = rounds.find((candidate) => candidate.order === requested) ?? defaultRound(rounds);
  if (!round) return null;

  const visible = groupFilter === null ? round.matches : round.matches.filter((match) => match.groupId === groupFilter);
  const oneDay = matchDays(visible.map((match) => match.kickoffAt)).length === 1;
  const namesByGroup = new Map(groups.map((group) => [group.id, group.name]));

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
    <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <RoundList
        rounds={rounds.map((candidate) => candidate.summary)}
        value={round.id}
        onValueChange={select}
        className="lg:sticky lg:top-4"
      />
      <section aria-labelledby="schedule-round" className="min-w-0 space-y-2">
        {/* Poniżej `lg` nazwę i daty kolejki niesie już przycisk listy kolejek. */}
        <div className="hidden flex-wrap items-baseline gap-x-2 lg:flex">
          <Heading level="card" id="schedule-round">
            {round.name}
          </Heading>
          <span className="text-sm text-muted-foreground">{round.summary.dates}</span>
        </div>
        <ul className="space-y-2">
          {visible.map((match) => (
            <li key={match.id} className="flex items-start gap-2">
              {groupFilter === null && match.groupId !== null && namesByGroup.has(match.groupId) && (
                <span className="w-24 shrink-0 pt-2.5">
                  <Badge variant="secondary" className="font-medium">
                    {namesByGroup.get(match.groupId)}
                  </Badge>
                </span>
              )}
              <div className="min-w-0 flex-1">
                <MatchRow match={match} showDate={!oneDay} onSelect={() => onSelectMatch(match)} />
              </div>
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
 * Faza grupowa (#258) liczy kolejki i mecze inaczej niż liga: kolejki to
 * najdłuższa grupa, a mecze to suma par w grupach. Pusty `groupSizes` znaczy
 * ligę.
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
  groupSizes,
  missingGroup,
  onClose,
}: {
  tournamentId: number;
  stage: Stage;
  teamsCount: number;
  currentMatches: number;
  groupSizes: number[] | undefined;
  missingGroup: string | undefined;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [meetings, setMeetings] = useState<1 | 2 | null>(null);
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const replacing = currentMatches > 0;
  const isGroup = groupSizes !== undefined;

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
    const { roundsCount, matchesCount } = groupSizes
      ? groupScheduleSize(groupSizes, value)
      : roundRobinSize(teamsCount, value);
    return {
      value,
      label,
      description: `${roundsCount} ${plural(roundsCount, ROUNDS)}, ${matchesCount} ${plural(matchesCount, MATCHES)}`,
    };
  };

  const title = isGroup
    ? replacing
      ? 'Wygeneruj terminarz grup ponownie'
      : 'Wygeneruj terminarz grup'
    : replacing
      ? 'Wygeneruj terminarz ponownie'
      : 'Wygeneruj terminarz';

  const description = isGroup
    ? `${stage.name}: ${(groupSizes ?? []).length} ${plural((groupSizes ?? []).length, GROUPS)}. Kolejka jest wspólna dla wszystkich grup.`
    : `${stage.name}: ${teamsCount} ${plural(teamsCount, TEAMS)}. Kolejność drużyn jest losowana.`;

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={submit}
      title={title}
      description={description}
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
      {isGroup && missingGroup && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Drużyna „{missingGroup}” nie ma grupy. Zapisz skład grup od nowa.
        </p>
      )}
      {replacing && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {isGroup
            ? `Obecny terminarz grup (${currentMatches} ${plural(currentMatches, MATCHES)}) zniknie razem z terminami i wynikami.`
            : `Obecny terminarz (${currentMatches} ${plural(currentMatches, MATCHES)}) zniknie razem z terminami i obiektami, także poprawionymi ręcznie.`}
        </p>
      )}
      <p className="text-xs text-muted-foreground">Mecze powstaną bez dat.</p>
    </FormDialog>
  );
}
