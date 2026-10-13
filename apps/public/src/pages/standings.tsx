import { EmptyState, Heading, StandingsTable, TiebreakerSentence } from '@tournament/ui';
import { ListOrdered } from 'lucide-react';
import { useStandings } from '../lib/queries';
import { QueryState } from './query-state';
import { useTournament } from './tournament-layout';

/**
 * Tabela (#206): `StandingsTable` z `scoreLabel` i `allowsDraw` z odpowiedzi,
 * pod nią `TiebreakerSentence` z jej `tiebreakers` — zdanie zgadza się więc
 * zawsze z wierszami, nad którymi stoi.
 */
export function StandingsPage() {
  const { slug } = useTournament();
  const standings = useStandings(slug);

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
