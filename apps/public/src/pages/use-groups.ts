import type { Group, StandingTable } from '@tournament/api-client';
import { hasGroupStage } from '@tournament/ui';
import { useMemo } from 'react';
import { useTournament } from './tournament-layout';

/** Tabela grupy razem z jej grupą z faz turnieju. */
export interface GroupTable {
  table: StandingTable;
  group: Group;
}

/**
 * Grupy turnieju z zakładki (#268). Liczby wychodzących i kolejności grup
 * tabela nie niesie, więc strona bierze je z faz turnieju
 * (`Stage.groups[]`), po `StandingTable.groupId` i `Match.groupId`.
 *
 * - `groupStage`: turniej ma fazę `group`, czyli Tabelę grup i Drabinkę naraz;
 * - `group(id)`: grupa po id, `undefined` poza fazą grupową;
 * - `groupTables(tables)`: tabele grup w kolejności faz i `Group.order`, każda
 *   z grupą. Tabela bez grupy (tabela ligi albo grupa spoza faz) odpada.
 */
export function useGroups() {
  const { stages } = useTournament();
  return useMemo(() => {
    const stageOrder = new Map(stages.map((stage) => [stage.id, stage.order]));
    const groups = new Map(stages.flatMap((stage) => stage.groups).map((group) => [group.id, group]));
    const group = (id: number | null) => (id === null ? undefined : groups.get(id));

    function groupTables(tables: readonly StandingTable[]): GroupTable[] {
      return tables
        .flatMap((table) => {
          const found = group(table.groupId);
          return found ? [{ table, group: found }] : [];
        })
        .toSorted(
          (a, b) =>
            (stageOrder.get(a.table.stageId) ?? 0) - (stageOrder.get(b.table.stageId) ?? 0) || a.group.order - b.group.order,
        );
    }

    return { groupStage: hasGroupStage(stages), group, groupTables };
  }, [stages]);
}
