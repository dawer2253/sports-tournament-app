import type { Match } from '@tournament/api-client';
import { BracketTree, EmptyState, bracketTeamIds, currentRoundOrder, qualifiersDivergence } from '@tournament/ui';
import { GitFork, Info } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useStandings } from '../lib/queries';
import { QueryState } from './query-state';
import { TabLink } from './tab-link';
import { matchHref, useTournament } from './tournament-layout';
import { useBracket } from './use-bracket';
import { useGroups } from './use-groups';

/** Parametr adresu z pierwszą rundą okna: jej `order`. */
const START_PARAM = 'od';

/**
 * Drabinka (#234, wariant B z #218): drzewo fazy pucharowej w oknie rund,
 * z kompletu meczów fazy (`/matches?stageId=`), odpytywane jak pozostałe
 * zakładki. Pierwsza runda okna siedzi w `?od=`; bez niego okno zaczyna się
 * od rundy z pierwszym niezakończonym meczem, a po finale kończy się na
 * finale. Ten start trafia do `?od=` przy pierwszych danych (#239): reguła
 * działa tylko przy wejściu, więc zakończenie rundy w panelu nie przesuwa
 * okna kibicowi, który go nie ruszał, a odświeżenie strony i udostępniony
 * link pokazują to samo. Kafel prowadzi na stronę meczu.
 *
 * Liga pod `/drabinka` ma pusty stan z odnośnikiem do Tabeli, a puchar bez
 * wygenerowanej drabinki — pusty stan bez odnośnika: aktywacja turnieju nie
 * wymaga drabinki. Turniej z grupami (#268) przed wygenerowaniem drabinki
 * odsyła do Tabeli, bo drabinka powstaje dopiero z wyjścia z grup (#250),
 * a po wygenerowaniu ma nad drzewem notkę o rozjeździe z tabelami grup.
 */
export function BracketPage() {
  const { slug } = useTournament();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { stage, matches, penaltySlot } = useBracket();
  const { groupStage } = useGroups();
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

  if (!stage) {
    return (
      <EmptyState
        icon={<GitFork />}
        title="Ten turniej nie ma drabinki"
        description="Drabinkę ma faza pucharowa. Ten turniej gra w tabeli."
        action={<TabLink tab="standings">Przejdź do tabeli</TabLink>}
      />
    );
  }

  if (!matches.data) {
    return <QueryState error={matches.error} label="drabinki" onRetry={() => void matches.refetch()} />;
  }

  if (matches.data.length === 0) {
    return groupStage ? (
      <EmptyState
        icon={<GitFork />}
        title="Drabinki jeszcze nie ma"
        description="Organizator ułoży ją, gdy drużyny wyjdą z grup. Do tego czasu turniej gra w tabelach grup."
        action={<TabLink tab="standings">Przejdź do tabeli</TabLink>}
      />
    ) : (
      <EmptyState
        icon={<GitFork />}
        title="Drabinki jeszcze nie ma"
        description="Pojawi się tu, gdy organizator rozstawi drużyny i ją wygeneruje."
      />
    );
  }

  return (
    <div className="space-y-4">
      {groupStage && <DivergenceNote matches={matches.data} />}
      <BracketTree
        matches={matches.data}
        start={start}
        onStartChange={setStart}
        penaltySlot={penaltySlot}
        matchHref={(match) => matchHref(slug, match.id)}
        onMatchNavigate={(match) => void navigate(matchHref(slug, match.id))}
      />
    </div>
  );
}

/** Nazwy drużyn jako wyliczenie: „Wilki”, „Wilki i Orły”, „Wilki, Orły i Lwy”. */
const LIST = new Intl.ListFormat('pl', { type: 'conjunction' });

function names(teams: readonly { team: { name: string } }[]) {
  return LIST.format(teams.map((row) => row.team.name));
}

/**
 * Notka nad drzewem, gdy drabinka nie idzie za dzisiejszą tabelą którejś grupy
 * (#268, z wariantu B #252): wynik grupy wpisany po wygenerowaniu albo
 * świadoma podmiana przy remisie na linii. Strona liczy ją sama z tabel grup
 * i drużyn drabinki (`qualifiersDivergence`), niczego nie zapisuje, a po
 * ponownym wygenerowaniu drabinki notka znika. Zdanie jest neutralne: kto gra
 * w drabince i kto stoi dziś nad linią, bez oceny. Bez tabel notki nie ma —
 * drzewo nie czeka na nie.
 */
function DivergenceNote({ matches }: { matches: Match[] }) {
  const { slug } = useTournament();
  const { groupTables } = useGroups();
  const standings = useStandings(slug);
  const bracketTeams = bracketTeamIds(matches);

  const clauses = groupTables(standings.data ?? []).flatMap(({ table, group }) => {
    const { plays, missing } = qualifiersDivergence(table.rows, group.qualifiers, bracketTeams);
    const play = (teams: unknown[]) => (teams.length === 1 ? 'gra' : 'grają');
    const stand = (teams: unknown[]) => (teams.length === 1 ? 'stoi' : 'stoją');
    // Człon bez pary zostaje po zmianie liczby wychodzących po wygenerowaniu.
    if (plays.length && missing.length) {
      return [`w drabince ${play(plays)} ${names(plays)}, a w tabeli grupy nad linią ${stand(missing)} dziś ${names(missing)}`];
    }
    if (plays.length) return [`w drabince ${play(plays)} ${names(plays)}, choć w tabeli grupy ${stand(plays)} dziś pod linią`];
    if (missing.length) return [`w tabeli grupy nad linią ${stand(missing)} dziś ${names(missing)}, a w drabince nie ${play(missing)}`];
    return [];
  });

  if (clauses.length === 0) return null;
  return (
    <div role="status" className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0">Drabinkę ułożono przed końcem fazy grupowej: {clauses.join('; ')}.</p>
    </div>
  );
}
