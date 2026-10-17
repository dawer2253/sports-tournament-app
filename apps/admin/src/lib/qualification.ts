import type { BracketSeed, Group, StandingTable, Team } from '@tournament/api-client';
import { groupLetter, qualifiersDivergence, type SeedingTeam } from '@tournament/ui';

/**
 * Wyjście z grup do drabinki playoffu (#250, #260) od strony panelu.
 * Rozstawienie nie jest przechowywane, więc pochodzenie drużyny („1A”)
 * i rozjazd drabinki z tabelami panel składa sam: z propozycji
 * `GET /stages/{stage}/bracket/seeding`, z tabel grup i z `Group.qualifiers`.
 */

/** Etykieta pochodzenia: miejsce w tabeli i litera grupy po jej `order` („1A”). */
export function originLabel(position: number, group: Pick<Group, 'order'>): string {
  return `${position}${groupLetter(group.order - 1)}`;
}

/** „w grupie A” — litera, a nie nazwa, tak jak w etykiecie pochodzenia. */
function inGroup(group: Pick<Group, 'order'>): string {
  return `w grupie ${groupLetter(group.order - 1)}`;
}

/**
 * Lista rozstawienia na start okna z propozycji backendu. Nazwy idą z listy
 * drużyn; pozycja z drużyną albo grupą, której panel nie zna (lista sprzed
 * odświeżenia), wypada, a backend i tak sprawdzi listę przy generowaniu.
 */
export function seedingFromProposal(proposal: BracketSeed[], teams: Team[], groups: Group[]): SeedingTeam[] {
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const groupById = new Map(groups.map((group) => [group.id, group]));
  return proposal.flatMap(({ teamId, groupId, position }) => {
    const team = teamById.get(teamId);
    const group = groupById.get(groupId);
    return team && group ? [{ id: team.id, name: team.name, origin: originLabel(position, group), groupId }] : [];
  });
}

/**
 * Drużyny grup do podmiany w oknie rozstawienia (`SeedingList.groupTeams`):
 * wiersze tabel grup w kolejności tabeli, każdy z pochodzeniem. Tabela ligi
 * (bez `groupId`) i grupa spoza fazy nie wnoszą nic.
 */
export function groupTeamsFromTables(tables: StandingTable[], groups: Group[]): SeedingTeam[] {
  const groupById = new Map(groups.map((group) => [group.id, group]));
  return tables.flatMap((table) => {
    const group = table.groupId === null ? undefined : groupById.get(table.groupId);
    if (!group) return [];
    return table.rows.map((row) => ({
      id: row.team.id,
      name: row.team.name,
      origin: originLabel(row.position, group),
      groupId: group.id,
    }));
  });
}

/** Drużyna z miejscem w tabeli grupy, do zdania o rozjeździe. */
type Placed = { name: string; position: number };

/**
 * Rozjazd jednej grupy: kto z niej gra w drabince poza czołówką `qualifiers`
 * (`plays`) i kogo z czołówki w drabince nie ma (`missing`), oba po miejscu.
 */
export type GroupDivergence = { group: Group; plays: Placed[]; missing: Placed[] };

/**
 * Rozjazd drabinki z tabelami grup (#250): grupy, w których drużyny
 * w drabince różnią się od czołowych `qualifiers` tabeli — bo organizer
 * rozstrzygnął remis na linii, tabela zmieniła się po generowaniu albo
 * zmieniła się liczba wychodzących. Regułę dla jednej grupy dzieli ze stroną
 * publiczną design system (`qualifiersDivergence`, #268); drużyny drabinki
 * daje `bracketTeamIds`.
 */
export function bracketDivergence(
  bracketTeamIds: ReadonlySet<number>,
  tables: StandingTable[],
  groups: Group[],
): GroupDivergence[] {
  const tableByGroup = new Map(tables.flatMap((table) => (table.groupId === null ? [] : [[table.groupId, table] as const])));
  return groups.flatMap((group) => {
    const rows = tableByGroup.get(group.id)?.rows ?? [];
    const placed = (row: (typeof rows)[number]): Placed => ({ name: row.team.name, position: row.position });
    const { plays, missing } = qualifiersDivergence(rows, group.qualifiers, bracketTeamIds);
    return plays.length > 0 || missing.length > 0 ? [{ group, plays: plays.map(placed), missing: missing.map(placed) }] : [];
  });
}

/**
 * Neutralny opis rozjazdu: „Orły (3. w grupie A) grają zamiast Sokołów…”
 * wymagałoby odmiany nazw, więc zdanie stawia drużyny obok siebie: „Orły
 * (3. w grupie A) zamiast Sokoły (2. w grupie A)”. Nadmiar bez pary (inna
 * liczba wychodzących niż przy generowaniu) dostaje osobne człony.
 */
export function divergenceSentence(divergences: GroupDivergence[]): string {
  const parts = divergences.flatMap(({ group, plays, missing }) => {
    const label = (team: Placed) => `${team.name} (${team.position}. ${inGroup(group)})`;
    const pairs = Math.min(plays.length, missing.length);
    return [
      ...plays.slice(0, pairs).map((team, index) => `${label(team)} zamiast ${label(missing[index]!)}`),
      ...plays.slice(pairs).map((team) => `${label(team)} ponad liczbę wychodzących`),
      ...missing.slice(pairs).map((team) => `${label(team)} poza drabinką`),
    ];
  });
  return `Drabinka różni się od tabel grup: ${parts.join('; ')}.`;
}
