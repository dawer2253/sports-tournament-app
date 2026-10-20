import type { PublicTournament } from '@tournament/api-client';
import {
  EmptyBoard,
  LoadError,
  PageHead,
  StandingsLoading,
  StandingsScreen,
  TextLink,
  scheduleProgress,
} from '@tournament/ui/public';
import { useNavigate } from 'react-router';
import { useStageMatches, useStandings } from '../lib/queries';
import { loadErrorMessage } from '../lib/api-error';
import { tabHref, useTournament } from './tournament-layout';
import { useBracket } from './use-bracket';
import { useGroups } from './use-groups';

/** Faza z tabelą: pierwsza faza `league` albo `group` po `order`. */
function tableStage(tournament: PublicTournament) {
  return tournament.stages.toSorted((a, b) => a.order - b.order).find((stage) => stage.type !== 'knockout') ?? null;
}

/**
 * Tabela (#291): strona tylko pobiera i przekazuje dane ekranowi
 * `StandingsScreen` z `@tournament/ui/public`. Pobiera tabele (`/standings`),
 * grupy turnieju (`useGroups`: kolejność i liczba wychodzących po `groupId`),
 * stan turnieju i komplet meczów fazy tabeli (`/matches?stageId=`) do faktów
 * w nagłówku i stanu „Bez terminarza”. W grupach patrzy też na mecze fazy
 * pucharowej: odnośnik do Drabinki stoi dopiero, gdy drabinka jest
 * wygenerowana.
 *
 * Puchar tabeli nie ma (#234): pod `/tabela` stoi pusty stan z odnośnikiem do
 * Drabinki, a o tabelę strona nie pyta.
 */
export function StandingsPage() {
  const tournament = useTournament();
  const { slug } = tournament;
  const navigate = useNavigate();
  const { cup, matches: playoff } = useBracket();
  const { groupStage, withGroups } = useGroups();
  const stage = tableStage(tournament);
  const standings = useStandings(slug, !cup);
  const stageMatches = useStageMatches(slug, cup ? null : (stage?.id ?? null));

  const link = (tab: 'home' | 'bracket') => ({ href: tabHref(slug, tab), onNavigate: () => void navigate(tabHref(slug, tab)) });

  if (cup) {
    return (
      <>
        <PageHead title="Tabela" />
        <EmptyBoard title="Puchar nie ma tabeli" action={<TextLink {...link('bracket')}>Przejdź do drabinki</TextLink>}>
          Przebieg pucharu pokazuje drabinka.
        </EmptyBoard>
      </>
    );
  }

  const failed = (!standings.data && standings.error) || (!stageMatches.data && stageMatches.error);
  if (failed) {
    return (
      <LoadError
        title="Tabela"
        label="tabeli"
        message={loadErrorMessage(failed)}
        onRetry={() => {
          if (standings.error) void standings.refetch();
          if (stageMatches.error) void stageMatches.refetch();
        }}
      />
    );
  }

  if (!standings.data || !stageMatches.data) return <StandingsLoading />;

  const generatedBracket = groupStage && (playoff.data?.length ?? 0) > 0;

  return (
    <StandingsScreen
      format={groupStage ? 'groups' : 'league'}
      stageName={stage?.name ?? 'Tabela'}
      tables={withGroups(standings.data).map(({ table, group }) => ({
        groupId: table.groupId,
        groupName: table.groupName,
        rows: table.rows,
        qualifiers: group?.qualifiers ?? null,
        scoreLabel: table.scoreLabel,
        allowsDraw: table.allowsDraw,
        rallyPointsLabel: table.rallyPointsLabel,
        tiebreakers: table.tiebreakers,
      }))}
      status={tournament.status}
      schedule={scheduleProgress(stageMatches.data)}
      overview={link('home')}
      bracket={generatedBracket ? link('bracket') : undefined}
    />
  );
}
