import type { Match } from '@tournament/api-client';
import {
  BracketLoading,
  BracketScreen,
  LoadError,
  bracketTeamIds,
  currentRoundOrder,
  divergenceNote,
} from '@tournament/ui/public';
import { useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useStandings } from '../lib/queries';
import { matchHref, useTabNav, useTournament } from './tournament-layout';
import { useBracket } from './use-bracket';
import { useGroups } from './use-groups';

/** Parametr adresu z pierwszą rundą okna: jej `order`. */
const START_PARAM = 'od';

/**
 * Drabinka (#234, #293): pobiera komplet meczów fazy pucharowej
 * (`/matches?stageId=`), odpytywany jak pozostałe zakładki, i oddaje go
 * ekranowi `BracketScreen` z `@tournament/ui/public`. Tu zostaje tylko to,
 * co zależy od adresu i zapytań:
 *
 * - pierwsza runda okna siedzi w `?od=`; bez niego okno zaczyna się od rundy
 *   z pierwszym niezakończonym meczem i ten start trafia do `?od=` przy
 *   pierwszych danych (#239), więc zakończenie rundy w panelu nie przesuwa
 *   okna kibicowi, a odświeżenie i udostępniony link pokazują to samo;
 * - kafel prowadzi na stronę meczu, a odnośniki pustych stanów na zakładki;
 * - w turnieju z grupami (#268) notkę o rozjeździe liczy `divergenceNote`
 *   z tabel grup i drużyn drabinki. Bez tabel notki nie ma — drzewo nie
 *   czeka na nie.
 */
export function BracketPage() {
  const { slug, stages } = useTournament();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { stage, matches } = useBracket();
  const { groupStage, groupTables } = useGroups();
  const standings = useStandings(slug, groupStage && (matches.data?.length ?? 0) > 0);
  const requested = Number(params.get(START_PARAM));
  const start = Number.isInteger(requested) && requested > 0 ? requested : undefined;
  const entryStart = matches.data && currentRoundOrder(matches.data);

  const setStart = useCallback(
    (order: number) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.set(START_PARAM, String(order));
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

  useEffect(() => {
    if (start === undefined && entryStart) setStart(entryStart);
  }, [start, entryStart, setStart]);

  const groups = useMemo(() => stages.filter((candidate) => candidate.type === 'group').flatMap((candidate) => candidate.groups), [stages]);
  const divergence = useMemo(
    () =>
      groupStage && matches.data && standings.data
        ? divergenceNote(
            groupTables(standings.data).map(({ table, group }) => ({ rows: table.rows, qualifiers: group.qualifiers })),
            bracketTeamIds(matches.data),
          )
        : null,
    [groupStage, matches.data, standings.data, groupTables],
  );

  const links = useTabNav(slug);

  if (!stage) return <BracketScreen format="league" matches={[]} {...links} />;

  if (!matches.data) {
    return matches.error ? (
      <LoadError title="Drabinka" label="drabinki" message={matches.error.message} onRetry={() => void matches.refetch()} />
    ) : (
      <BracketLoading />
    );
  }

  return (
    <BracketScreen<Match>
      format={groupStage ? 'groups_playoff' : 'knockout'}
      matches={matches.data}
      groups={groups}
      divergence={divergence}
      start={start}
      onStartChange={setStart}
      matchHref={(match) => matchHref(slug, match.id)}
      onMatchNavigate={(match) => void navigate(matchHref(slug, match.id))}
      {...links}
    />
  );
}
