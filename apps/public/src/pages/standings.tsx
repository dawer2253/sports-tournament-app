import { EmptyState, Heading, StandingsTable, TiebreakerSentence } from '@tournament/ui';
import { ListOrdered } from 'lucide-react';
import { useStandings } from '../lib/queries';
import { QueryState } from './query-state';
import { TabLink } from './tab-link';
import { useTournament } from './tournament-layout';
import { useBracket } from './use-bracket';

/**
 * Tabela (#206): `StandingsTable` z `scoreLabel` i `allowsDraw` z odpowiedzi,
 * pod nią `TiebreakerSentence` z jej `tiebreakers` — zdanie zgadza się więc
 * zawsze z wierszami, nad którymi stoi.
 *
 * Puchar tabeli nie ma (#234): pod `/tabela` stoi pusty stan z odnośnikiem do
 * Drabinki, jak Terminarz pucharu w panelu (#227), a o tabelę strona nie pyta.
 */
export function StandingsPage() {
  const { slug } = useTournament();
  const { cup } = useBracket();
  const standings = useStandings(slug, !cup);

  if (cup) {
    return (
      <EmptyState
        icon={<ListOrdered />}
        title="Puchar nie ma tabeli"
        description="Przebieg pucharu pokazuje drabinka."
        action={<TabLink tab="bracket">Przejdź do drabinki</TabLink>}
      />
    );
  }

  if (!standings.data) {
    return <QueryState error={standings.error} label="tabeli" onRetry={() => void standings.refetch()} />;
  }

  if (standings.data.length === 0) {
    return (
      <EmptyState
        icon={<ListOrdered />}
        title="Ten turniej nie ma tabeli"
        description="Tabelę ma faza ligowa i każda grupa. Faza pucharowa układa się w drabinkę."
      />
    );
  }

  return (
    <div className="space-y-8">
      {standings.data.map((table) => (
        <section key={`${table.stageId}-${table.groupId ?? 'all'}`} className="space-y-3">
          <Heading level="section">{table.groupName ?? table.stageName}</Heading>
          <StandingsTable rows={table.rows} scoreLabel={table.scoreLabel} allowsDraw={table.allowsDraw} />
          <TiebreakerSentence items={table.tiebreakers} />
        </section>
      ))}
    </div>
  );
}
