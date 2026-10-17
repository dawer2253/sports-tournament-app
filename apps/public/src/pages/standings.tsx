import type { Group, StandingTable } from '@tournament/api-client';
import {
  EmptyState,
  Heading,
  QUALIFY,
  StandingsTable,
  TEAMS,
  TiebreakerSentence,
  plural,
  withQualifiers,
} from '@tournament/ui';
import { ListOrdered } from 'lucide-react';
import { useStandings } from '../lib/queries';
import { QueryState } from './query-state';
import { TabLink } from './tab-link';
import { useTournament } from './tournament-layout';
import { useBracket } from './use-bracket';
import { useGroups } from './use-groups';

/**
 * Tabela (#206): `StandingsTable` z `scoreLabel` i `allowsDraw` z odpowiedzi,
 * pod nią `TiebreakerSentence` z jej `tiebreakers` — zdanie zgadza się więc
 * zawsze z wierszami, nad którymi stoi.
 *
 * Puchar tabeli nie ma (#234): pod `/tabela` stoi pusty stan z odnośnikiem do
 * Drabinki, jak Terminarz pucharu w panelu (#227), a o tabelę strona nie pyta.
 *
 * Turniej z grupami (#268, wariant A z #252) ma wszystkie grupy jedna pod
 * drugą, w kolejności `Group.order`, z linią wyjścia po `qualifiers`
 * miejscach (`withQualifiers`) i zdaniem o wychodzących. Liczbę wychodzących
 * strona bierze z grup turnieju, po `StandingTable.groupId`. Liga linii nie ma.
 */
export function StandingsPage() {
  const { slug } = useTournament();
  const { cup } = useBracket();
  const { groupStage, groupTables } = useGroups();
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

  if (groupStage) {
    return (
      <div className="space-y-8">
        {groupTables(standings.data).map(({ table, group }) => (
          <TableSection key={`${table.stageId}-${group.id}`} table={table} group={group} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {standings.data.map((table) => (
        <TableSection key={`${table.stageId}-${table.groupId ?? 'all'}`} table={table} />
      ))}
    </div>
  );
}

/** Jedna tabela z nagłówkiem; tabela grupy dostaje linię wyjścia i zdanie o wychodzących. */
function TableSection({ table, group }: { table: StandingTable; group?: Group }) {
  const heading = table.groupName ?? table.stageName;
  return (
    <section aria-label={heading} className="space-y-3">
      <Heading level="section">{heading}</Heading>
      <StandingsTable
        rows={group ? withQualifiers(table.rows, group.qualifiers) : table.rows}
        scoreLabel={table.scoreLabel}
        allowsDraw={table.allowsDraw}
      />
      {group && <QualifiersLegend qualifiers={group.qualifiers} />}
      <TiebreakerSentence items={table.tiebreakers} />
    </section>
  );
}

/**
 * Zdanie pod tabelą grupy (#268), wzorem panelu (#259) bez części
 * o podmianie, która jest sprawą organizera. Słownik: „wyjście z grupy”,
 * nie „awans” (`CONTEXT.md`).
 */
function QualifiersLegend({ qualifiers }: { qualifiers: number }) {
  return (
    <p className="text-xs text-muted-foreground">
      Z grupy {plural(qualifiers, QUALIFY)} {qualifiers} {plural(qualifiers, TEAMS)} — miejsca nad przerywaną linią. Remis
      na linii rozstrzyga organizer.
    </p>
  );
}
