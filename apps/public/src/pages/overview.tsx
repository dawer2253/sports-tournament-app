import type { Match } from '@tournament/api-client';
import {
  LoadError,
  OverviewLoading,
  OverviewScreen,
  TeamsShowcase,
  overviewBracketStage,
  overviewRounds,
  type Loadable,
  type OverviewMode,
  type OverviewSchedule,
} from '@tournament/ui/public';
import { useNavigate } from 'react-router';
import { useFixtures, useLeaderboard, useResults, useStandings, useTeams } from '../lib/queries';
import { useRounds } from './match-rounds';
import { matchHref, useTabNav, useTournament } from './tournament-layout';
import { useBracket } from './use-bracket';
import { useGroups } from './use-groups';

/** Zapytanie w tym zakresie, w jakim czyta je Przegląd. */
interface QueryLike<T> {
  data: T | undefined;
  error: Error | null;
  refetch: () => unknown;
}

/** Stan zapytania dla sekcji ekranu: dane wygrywają z błędem odświeżenia w tle. */
function loadable<T, R>(query: QueryLike<T>, map: (data: T) => R): Loadable<R> {
  if (query.data !== undefined) return { status: 'ready', data: map(query.data) };
  if (query.error) return { status: 'error', message: query.error.message, onRetry: () => void query.refetch() };
  return { status: 'loading' };
}

/**
 * Przegląd (#296): strona tylko pobiera dane i podaje je ekranowi
 * `OverviewScreen` z `@tournament/ui/public`.
 *
 * - Liga i faza grupowa: pas etapu i następna kolejka z `/fixtures`
 *   i `/results` (te same kolejki co na Terminarzu i Wynikach), w miejscu
 *   tabeli tabela z formą albo tabele grup z `qualifiers` po `groupId`.
 * - Puchar i grupy po wygenerowaniu drabinki (playoff): pas i najbliższe mecze
 *   z kompletu meczów fazy pucharowej (`/matches?stageId=`, strzelcy meczu
 *   trwającego z `/fixtures`), w miejscu tabeli drabinka. Puchar o tabelę nie
 *   pyta.
 * - Bez terminarza (liga i grupy bez kolejek, puchar bez drabinki): sama
 *   prezentacja drużyn z `/teams`; o drużyny strona pyta tylko wtedy.
 *
 * Zapytania stoją niezależnie: sekcja z jednego źródła pokazuje się, gdy ono
 * dotrze, a jego błąd nie zdejmuje pozostałych. Szkielet całego ekranu stoi
 * tylko do pierwszej odpowiedzi źródeł, z których widać stan turnieju.
 */
export function OverviewPage() {
  const tournament = useTournament();
  const { slug } = tournament;
  const navigate = useNavigate();
  const tabNav = useTabNav(slug);
  const { cup, matches: knockout, withBracket } = useBracket();
  const { groupStage, groupTables } = useGroups();
  const fixtures = useFixtures(slug);
  const results = useResults(slug);
  // Grupy czekają na mecze playoffu: dopiero one mówią, czy drabinka już jest.
  const bracketKnown = (!cup && !groupStage) || knockout.data !== undefined || knockout.error !== null;
  const playoff = groupStage && (knockout.data?.length ?? 0) > 0;
  // Tabela tylko w lidze i w fazie grupowej: w pucharze i playoffie ekran jej
  // nie pokazuje, więc grupy pytają o nią dopiero po meczach playoffu.
  const standings = useStandings(slug, !cup && bracketKnown && !playoff);
  const leaderboard = useLeaderboard(slug);
  const fixtureRounds = useRounds(fixtures.data, 'asc');
  const resultRounds = useRounds(results.data, 'desc');
  const mode: OverviewMode = cup ? 'knockout' : playoff ? 'playoff' : groupStage ? 'groups' : 'league';
  const fromBracket = mode === 'knockout' || mode === 'playoff';
  const listsKnown = (fixtures.data !== undefined || fixtures.error !== null) && (results.data !== undefined || results.error !== null);

  const noSchedule = cup ? knockout.data?.length === 0 : bracketKnown && fixtures.data?.length === 0 && results.data?.length === 0;
  const teams = useTeams(slug, noSchedule);

  function scheduleState(): Loadable<OverviewSchedule> {
    if (fromBracket) {
      return loadable(knockout, (matches: Match[]) => {
        const scorers = new Map((fixtures.data ?? []).map((candidate) => [candidate.id, candidate.scorers]));
        const rows = matches.map((candidate) => ({ ...withBracket(candidate), scorers: scorers.get(candidate.id) ?? [] }));
        const { stage, next } = overviewBracketStage(rows);
        return { stage: stage!, next };
      });
    }
    const failed = (!fixtures.data && fixtures.error) || (!results.data && results.error);
    if (failed) {
      return {
        status: 'error',
        message: failed.message,
        onRetry: () => {
          if (!fixtures.data) void fixtures.refetch();
          if (!results.data) void results.refetch();
        },
      };
    }
    if (!fixtures.data || !results.data) return { status: 'loading' };
    const rounds = overviewRounds(fixtureRounds, resultRounds);
    // `stage` jest tu zawsze: obie listy puste to „Bez terminarza” wyżej, a niepusta lista daje kolejkę.
    return { status: 'ready', data: { stage: rounds.stage!, next: rounds.next, roundsTotal: rounds.roundsTotal, startsAt: rounds.startsAt } };
  }

  if (!bracketKnown || (!cup && !listsKnown)) return <OverviewLoading />;

  if (noSchedule) {
    if (teams.data) return <TeamsShowcase teams={teams.data} />;
    if (teams.error) return <LoadError label="drużyn" message={teams.error.message} onRetry={() => void teams.refetch()} />;
    return <OverviewLoading />;
  }

  return (
    <OverviewScreen
      mode={mode}
      finished={tournament.status === 'finished'}
      schedule={scheduleState()}
      table={
        mode === 'league'
          ? loadable(standings, ([table]) => ({
              rows: table?.rows ?? [],
              scoreLabel: table?.scoreLabel ?? '',
              allowsDraw: table?.allowsDraw ?? tournament.sport.allowsDraw,
            }))
          : undefined
      }
      groups={
        mode === 'groups'
          ? loadable(standings, (tables) =>
              groupTables(tables).map(({ table, group }) => ({
                groupId: table.groupId,
                groupName: table.groupName,
                stageName: table.stageName,
                rows: table.rows,
                qualifiers: group.qualifiers,
                scoreLabel: table.scoreLabel,
                allowsDraw: table.allowsDraw,
              })),
            )
          : undefined
      }
      bracket={fromBracket ? loadable(knockout, (matches) => matches) : undefined}
      leaderboard={loadable(leaderboard, (board) => board)}
      matchHref={(match) => matchHref(slug, match.id)}
      onMatchNavigate={(match) => void navigate(matchHref(slug, match.id))}
      {...tabNav}
    />
  );
}
