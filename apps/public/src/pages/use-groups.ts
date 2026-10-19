import type { Group, StandingTable } from '@tournament/api-client';
import { hasGroupStage } from '@tournament/ui/public';
import { useMemo } from 'react';
import { useTournament } from './tournament-layout';

/** Tabela razem z jej grupą z faz turnieju; tabela ligi grupy nie ma. */
export interface TableWithGroup {
  table: StandingTable;
  group: Group | undefined;
}

/** Tabela grupy razem z jej grupą z faz turnieju. */
export interface GroupTable extends TableWithGroup {
  group: Group;
}

/**
 * Grupy turnieju z zakładki (#268). Liczby wychodzących i kolejności grup
 * tabela nie niesie, więc strona bierze je z faz turnieju
 * (`Stage.groups[]`), po `StandingTable.groupId` i `Match.groupId`.
 *
 * - `groupStage`: turniej ma fazę `group`, czyli Tabelę grup i Drabinkę naraz;
 * - `group(id)`: grupa po id, `undefined` poza fazą grupową;
 * - `withGroups(tables)`: wszystkie tabele w kolejności faz i `Group.order`,
 *   każda z grupą, gdy ją ma. Tabela grupy, której faz turnieju jeszcze nie
 *   zna (skład zapisany między odpytaniami), zostaje — bez grupy, więc bez linii;
 * - `groupTables(tables)`: to samo, ale tylko tabele z grupą — dla skrótu
 *   na Przeglądzie i notki o rozjeździe, które potrzebują `qualifiers`.
 */
export function useGroups() {
  const { stages } = useTournament();
  return useMemo(() => {
    const stageOrder = new Map(stages.map((stage) => [stage.id, stage.order]));
    const groups = new Map(stages.flatMap((stage) => stage.groups).map((group) => [group.id, group]));
    const group = (id: number | null) => (id === null ? undefined : groups.get(id));

    function withGroups(tables: readonly StandingTable[]): TableWithGroup[] {
      return tables
        .map((table) => ({ table, group: group(table.groupId) }))
        .toSorted(
          (a, b) =>
            (stageOrder.get(a.table.stageId) ?? 0) - (stageOrder.get(b.table.stageId) ?? 0) ||
            (a.group?.order ?? 0) - (b.group?.order ?? 0),
        );
    }

    const groupTables = (tables: readonly StandingTable[]): GroupTable[] =>
      withGroups(tables).filter((entry): entry is GroupTable => entry.group !== undefined);

    return { groupStage: hasGroupStage(stages), group, withGroups, groupTables };
  }, [stages]);
}
