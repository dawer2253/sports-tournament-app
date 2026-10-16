// PROTOTYP (#251) — grupy i playoff w pamięci. Nie do main.
//
// Mock kontraktu (Prism) nie ma `PUT /stages/{stage}/groups`, `PATCH /groups/{group}`,
// `GET /stages/{stage}/bracket/seeding` ani terminarza fazy `group`, więc cała
// faza grupowa żyje tutaj. Reguły odwzorowują rozstrzygnięcia: #249 (skład grup,
// wspólna kolejka fazy, tabele per grupa, zamrożenie od pierwszego meczu) i #250
// (liczba wychodzących z grupy, propozycja rozstawienia krzyżowego, zgoda na
// drabinkę przed końcem grup). Drabinka jest atrapą S4, bo ten prototyp dotyczy
// wyłącznie dojścia do niej i korekty par.
import { useSyncExternalStore } from 'react';

export type Sport = 'football' | 'basketball';
export type Team = { id: number; name: string };
export type MatchStatus = 'scheduled' | 'live' | 'finished';

/** Grupa fazy `group`: nazwa, kolejność, liczba wychodzących i skład. */
export type Group = {
  id: number;
  name: string;
  order: number;
  /** Ile drużyn wychodzi z grupy do drabinki (#250). */
  qualifiers: number;
  teamIds: number[];
};

/** Kolejka wspólna dla fazy (#249): mecz należy do grupy, kolejka do fazy. */
export type GMatch = {
  id: number;
  groupId: number;
  roundOrder: number;
  matchNumber: number;
  homeId: number;
  awayId: number;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  kickoffAt: string | null;
  roundName: string;
  roundDates: string;
};

/** Mecz drabinki (atrapa S4) z podpisem pustego slotu, np. „Zwycięzca: Półfinał 1”. */
export type KMatch = {
  id: number;
  roundOrder: number;
  roundName: string;
  matchNumber: number;
  label: string;
  homeId: number | null;
  awayId: number | null;
  homeSource?: string;
  awaySource?: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
};

export type DraftGroup = { name: string; qualifiers: number; teamIds: number[] };

export const SCENARIOS = [
  { key: 'no-groups', name: 'Format grupy + playoff, drużyny bez grup' },
  { key: 'drawn', name: 'Skład grup zapisany, bez terminarza' },
  { key: 'playing', name: 'Terminarz grup w trakcie' },
  { key: 'done', name: 'Mecze grup rozegrane, tabele gotowe' },
  { key: 'tie', name: 'Remis na linii wyjścia z grupy' },
  { key: 'bracket', name: 'Drabinka wygenerowana, brakuje meczów grup' },
  { key: 'started', name: 'Playoff w toku' },
] as const;
export type ScenarioKey = (typeof SCENARIOS)[number]['key'];

export const TEAM_COUNTS = [4, 6, 8, 9, 12, 16, 20] as const;
export const GROUP_COUNTS = [1, 2, 3, 4] as const;

const TEAM_NAMES = [
  'Wilki Bemowo', 'Sokoły Ursus', 'Orły Wola', 'Lwy Mokotów', 'Rysie Bielany',
  'Żubry Praga', 'Jastrzębie Ochota', 'Dziki Targówek', 'Borsuki Wawer', 'Kruki Żoliborz',
  'Niedźwiedzie Białołęka', 'Łosie Ursynów', 'Bobry Wilanów', 'Foki Śródmieście', 'Lisy Włochy',
  'Rekiny Rembertów', 'Sowy Wesoła', 'Żurawie Bródno', 'Gepardy Gocław', 'Pumy Saska Kępa',
];

const GROUP_LETTERS = 'ABCDEFGHIJ';

export type State = {
  scenario: ScenarioKey;
  sport: Sport;
  teamCount: number;
  groupCount: number;
  teams: Team[];
  /** Zapisany skład grup; puste, gdy organizer go jeszcze nie zapisał. */
  groups: Group[];
  /** Szkic edytora składu; zapisywany w całości przez `zapiszSkład`. */
  draft: DraftGroup[];
  draftDirty: boolean;
  meetings: 1 | 2;
  matches: GMatch[];
  knockout: KMatch[];
  thirdPlace: boolean;
  /** Rozstawienie z ostatniego generowania; kontrakt go nie przechowuje (#215). */
  lastSeeding: number[] | null;
  /** Drużyna bez grupy wg scenariusza (dodana po zapisie składu), jeśli jest. */
  extraTeam: Team | null;
  /** Scenariusz „remis na linii”: dwa ostatnie miejsca na linii dostają ten sam wiersz. */
  forcedTie: boolean;
  latencyMs: number;
  failNext: 'none' | '500';
  log: string[];
};

let nextId = 9000;
let state = undefined as unknown as State;
state = build('playing', 'football', 8, 2);
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function log(line: string) {
  const time = new Date().toLocaleTimeString('pl-PL');
  const fails = state.failNext === '500';
  const status = fails ? '500' : '200';
  set({ log: [`${time} ${line} · ${status}`, ...state.log].slice(0, 40), failNext: 'none' });
}

export function useGroups(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// ——— Dane demo ———

function teamsUpTo(count: number): Team[] {
  return TEAM_NAMES.slice(0, count).map((name, index) => ({ id: index + 1, name }));
}

function shuffle<T>(list: readonly T[]): T[] {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

function shells(count: number): DraftGroup[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `Grupa ${GROUP_LETTERS[index]}`,
    qualifiers: 2,
    teamIds: [] as number[],
  }));
}

/** Losowanie grup (#249): wymieszane drużyny do grup o zadanych rozmiarach. */
function drawDraft(teams: Team[], count: number): DraftGroup[] {
  const draft = shells(count);
  const enough = Math.max(count, 1);
  shuffle(teams).forEach((team, index) => {
    draft[index % enough]!.teamIds.push(team.id);
  });
  // Rozmiary równają się do `ceil(n / count)`, żeby pierwsze grupy nie były puste.
  return draft;
}

function commit(groups: DraftGroup[], id: (index: number) => number): Group[] {
  return groups.map((group, index) => ({
    id: id(index),
    name: group.name,
    order: index + 1,
    qualifiers: group.qualifiers,
    teamIds: [...group.teamIds],
  }));
}

function build(scenario: ScenarioKey, sport: Sport, teamCount: number, groupCount: number): State {
  const teams = teamsUpTo(teamCount);
  const count = Math.min(groupCount, Math.max(1, Math.floor(teamCount / 2)));
  const empty: State = {
    scenario,
    sport,
    teamCount,
    groupCount: count,
    teams,
    groups: [],
    draft: shells(count),
    draftDirty: false,
    meetings: 1,
    matches: [],
    knockout: [],
    thirdPlace: true,
    lastSeeding: null,
    extraTeam: null,
    forcedTie: false,
    latencyMs: 0,
    failNext: 'none',
    log: [],
  };

  if (scenario === 'no-groups') return empty;

  const groups = commit(drawDraft(teams, count), (index) => 200 + index);
  const withGroups: State = { ...empty, groups, draft: groups.map(toDraft) };

  if (scenario === 'drawn') return withGroups;

  const matches = generateRoundRobin(groups, 1);
  const played = { ...withGroups, matches };

  if (scenario === 'playing') {
    // Pierwsza kolejka rozegrana, druga w toku.
    return { ...played, matches: scoreUpTo(matches, 1, sport, 'finished') };
  }
  if (scenario === 'done') return { ...played, matches: scoreAll(matches, sport) };
  if (scenario === 'tie') {
    return { ...played, matches: scoreAll(matches, sport), forcedTie: true };
  }
  if (scenario === 'bracket') {
    return buildBracketState({ ...played, matches: scoreUpTo(matches, 1, sport, 'live') }, false);
  }
  // 'started': playoff w toku, drabinka z propozycji, część meczów rozegrana.
  const built = buildBracketState({ ...played, matches: scoreAll(matches, sport) }, false);
  return { ...built, knockout: scoreKnockout(built.knockout, sport) };
}

function toDraft(group: Group): DraftGroup {
  return { name: group.name, qualifiers: group.qualifiers, teamIds: [...group.teamIds] };
}

function scoreUpTo(matches: GMatch[], rounds: number, sport: Sport, status: MatchStatus): GMatch[] {
  return matches.map((match) => {
    if (match.roundOrder <= rounds) return withResult(match, sport, 'finished');
    if (match.roundOrder === rounds + 1) return withResult(match, sport, status);
    return match;
  });
}

function scoreAll(matches: GMatch[], sport: Sport): GMatch[] {
  return matches.map((match) => withResult(match, sport, 'finished'));
}

/** Deterministyczny wynik z numeru meczu, żeby scenariusze demo były wiarygodne. */
function withResult(match: GMatch, sport: Sport, status: MatchStatus): GMatch {
  const seed = match.matchNumber * 7 + match.awayId * 3;
  const homeScore = (seed % (sport === 'basketball' ? 30 : 4)) + (sport === 'basketball' ? 60 : 0);
  const awayScore = (seed % (sport === 'basketball' ? 12 : 3)) + (sport === 'basketball' ? 60 : 0);
  return {
    ...match,
    homeScore,
    awayScore,
    status,
    kickoffAt: `${match.roundDates.slice(0, 10)}T1${match.roundOrder % 10}:00:00+02:00`,
  };
}

/** Kozioł ofiarny scenariusza „remis na linii”: drabinka to pula meczów z wynikiem. */
function scoreKnockout(matches: KMatch[], sport: Sport): KMatch[] {
  return matches.map((match, index) =>
    match.homeId === null || match.awayId === null
      ? match
      : {
          ...match,
          homeScore: 1 + (index % 3),
          awayScore: index % 2 === 0 ? 1 : (sport === 'basketball' ? 88 : 2),
          status: index < 2 ? 'finished' : 'scheduled',
        },
  );
}

// ——— Terminarz fazy grupowej (#249) ———

/** Kolejki Bergera dla jednej grupy; przy nieparzystej liczbie drużyn dochodzi „bye”. */
function berger(teamIds: number[]): [number, number][][] {
  const ids = [...teamIds];
  const bye = -1;
  if (ids.length % 2 === 1) ids.push(bye);
  const size = ids.length;
  const rounds: [number, number][][] = [];
  for (let round = 0; round < size - 1; round++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < size / 2; i++) {
      const home = ids[i]!;
      const away = ids[size - 1 - i]!;
      if (home !== bye && away !== bye) pairs.push(round % 2 === 0 ? [home, away] : [away, home]);
    }
    rounds.push(pairs);
    // Rotacja: pierwszy stoi, reszta przesuwa się o jedno miejsce.
    ids.splice(1, 0, ids.pop()!);
  }
  return rounds;
}

/** Terminarz: kolejka wspólna dla fazy, w kolejce najpierw mecze pierwszej grupy (#249). */
export function generateRoundRobin(groups: Group[], meetings: 1 | 2): GMatch[] {
  const perGroup = groups.map((group) => berger(group.teamIds));
  const roundsCount = Math.max(...perGroup.map((rounds) => rounds.length), 0);
  const matches: GMatch[] = [];
  for (let round = 0; round < roundsCount; round++) {
    const date = nextRoundDate(round);
    groups.forEach((group, groupIndex) => {
      for (const [home, away] of perGroup[groupIndex]![round] ?? []) {
        matches.push({
          id: nextId++,
          groupId: group.id,
          roundOrder: round + 1,
          matchNumber: matches.length + 1,
          homeId: home,
          awayId: away,
          homeScore: null,
          awayScore: null,
          status: 'scheduled',
          kickoffAt: null,
          roundName: `Kolejka ${round + 1}`,
          roundDates: date,
        });
      }
    });
  }
  for (let extra = 1; extra < meetings; extra++) {
    for (const again of matches.slice()) {
      matches.push({
        ...again,
        id: nextId++,
        matchNumber: matches.length + 1,
        roundOrder: again.roundOrder + roundsCount,
        roundName: `Kolejka ${again.roundOrder + roundsCount}`,
        roundDates: nextRoundDate(again.roundOrder + roundsCount - 1),
        homeId: again.awayId,
        awayId: again.homeId,
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        kickoffAt: null,
      });
    }
  }
  return matches;
}

function nextRoundDate(offset: number): string {
  const day = new Date(2026, 7, 8 + offset);
  return `${day.toISOString().slice(0, 10)}T00:00:00+02:00`;
}

// ——— Tabela grupy (#249, #250) ———

export type Row = {
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDifference: number;
  points: number;
  /** Wiersz na linii wyjścia (miejsca ≤ `qualifiers`, #250). */
  qualifies: boolean;
  /** Scenariusz „remis na linii”: ten i następny wiersz mają identyczny dorobek. */
  tied: boolean;
};

export function scoreLabel(sport: Sport): string {
  return sport === 'basketball' ? 'Punkty' : 'Bramki';
}

function points(sport: Sport, won: number, drawn: number): number {
  return sport === 'basketball' ? won * 2 : won * 3 + drawn;
}

export function standingsFor(state: State, group: Group): Row[] {
  const table = new Map<number, Row>();
  for (const teamId of group.teamIds) {
    const team = state.teams.find((candidate) => candidate.id === teamId);
    if (!team) continue;
    table.set(teamId, {
      position: 0,
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      scoreFor: 0,
      scoreAgainst: 0,
      scoreDifference: 0,
      points: 0,
      qualifies: false,
      tied: false,
    });
  }
  for (const match of state.matches) {
    if (match.groupId !== group.id || match.status !== 'finished') continue;
    if (match.homeScore === null || match.awayScore === null) continue;
    const home = table.get(match.homeId);
    const away = table.get(match.awayId);
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    home.scoreFor += match.homeScore;
    home.scoreAgainst += match.awayScore;
    away.scoreFor += match.awayScore;
    away.scoreAgainst += match.homeScore;
    if (match.homeScore === match.awayScore) {
      home.drawn += 1;
      away.drawn += 1;
    } else if (match.homeScore > match.awayScore) {
      home.won += 1;
      away.lost += 1;
    } else {
      away.won += 1;
      home.lost += 1;
    }
  }
  const rows = [...table.values()].map((row) => ({
    ...row,
    scoreDifference: row.scoreFor - row.scoreAgainst,
    points: points(state.sport, row.won, row.drawn),
  }));
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.scoreDifference - a.scoreDifference ||
      b.scoreFor - a.scoreFor ||
      a.team.name.localeCompare(b.team.name, 'pl'),
  );
  rows.forEach((row, index) => {
    row.position = index + 1;
    row.qualifies = row.position <= group.qualifiers;
  });
  // PROTOTYP: scenariusz „remis na linii” udaje, że dwa ostatnie miejsca na
  // linii mają identyczny dorobek, bo z deterministycznych wyników demo taka
  // równość nie wychodzi. Wiersze tabeli liczy ten sam kod co zawsze.
  if (state.forcedTie && rows.length > group.qualifiers) {
    const last = rows[group.qualifiers - 1]!;
    const next = rows[group.qualifiers]!;
    for (const key of ['played', 'won', 'drawn', 'lost', 'scoreFor', 'scoreAgainst', 'scoreDifference', 'points'] as const) {
      next[key] = last[key];
    }
    last.tied = true;
    next.tied = true;
  }
  return rows;
}

export function teamsWithoutGroup(state: State): Team[] {
  const assigned = new Set(state.groups.flatMap((group) => group.teamIds));
  return state.teams.filter((team) => !assigned.has(team.id));
}

/** Ile kolejek ma grupa „każdy z każdym": n − 1 przy parzystym n, n przy nieparzystym. */
export function roundsForGroup(size: number): number {
  if (size < 2) return 0;
  return size % 2 === 0 ? size - 1 : size;
}

/**
 * Liczniki terminarza fazy grupowej: kolejki to najdłuższa grupa, mecze to suma
 * par (razy `meetings`), a nie jedna liga z `roundRobinSize` z `lib/schedule.ts`.
 */
export function scheduleSize(
  groups: { teamIds: number[] }[],
  meetings: 1 | 2,
): { roundsCount: number; matchesCount: number } {
  const roundsCount = Math.max(0, ...groups.map((group) => roundsForGroup(group.teamIds.length))) * meetings;
  const matchesCount =
    groups.reduce((sum, group) => {
      const n = group.teamIds.length;
      return sum + (n < 2 ? 0 : (n * (n - 1)) / 2);
    }, 0) * meetings;
  return { roundsCount, matchesCount };
}

export function teamById(state: State, id: number | null): Team | null {
  if (id === null) return null;
  return state.teams.find((team) => team.id === id) ?? null;
}

export function groupById(state: State, id: number): Group | undefined {
  return state.groups.find((group) => group.id === id);
}

/** Czy faza grupowa ma mecz rozpoczęty — od tego momentu skład grup jest zamrożony (#249). */
export function groupStageStarted(state: State): boolean {
  return state.matches.some((match) => match.status !== 'scheduled');
}

export function groupStageFinished(state: State): boolean {
  return state.matches.length > 0 && state.matches.every((match) => match.status === 'finished');
}

// ——— Propozycja rozstawienia krzyżowego (#250) ———

export type SeedEntry = { teamId: number; groupId: number; position: number };

/** Pozycje seedów w pełnej drabince: 1–N, N/2–N/2+1… (reguła z #215). */
export function seedPositions(size: number): number[] {
  let seeds = [1];
  while (seeds.length < size) {
    const m = seeds.length * 2;
    seeds = seeds.flatMap((s) => [s, m + 1 - s]);
  }
  return seeds;
}

export function bracketSize(n: number): number {
  let size = 2;
  while (size < n) size *= 2;
  return size;
}

/**
 * Propozycja rozstawienia z #250: start miejscami w kolejności grup, potem
 * wspinaczka zamianami w obrębie tego samego miejsca, aż żadna para z jednej
 * grupy nie spotka się wcześniej, niż musi. Koszt to liczba par z jednej grupy
 * mogących spotkać się najwcześniej w rundzie 1, 2, … — porównywana
 * leksykograficznie.
 */
function climb(entries: { groupId: number; position: number }[]): { groupId: number; position: number }[] {
  const size = bracketSize(entries.length);
  const cost = (list: { groupId: number; position: number }[]) => {
    const slot: number[] = [];
    seedPositions(size).forEach((seed, index) => {
      if (seed <= list.length) slot[seed - 1] = index;
    });
    const c = Array.from({ length: Math.log2(size) }, () => 0);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[i]!.groupId !== list[j]!.groupId) continue;
        let a = slot[i]!;
        let b = slot[j]!;
        let round = 0;
        while (a !== b) {
          a >>= 1;
          b >>= 1;
          round++;
        }
        c[round - 1] = (c[round - 1] ?? 0) + 1;
      }
    }
    return c;
  };
  const less = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
    return false;
  };

  let list = [...entries];
  let current = cost(list);
  for (;;) {
    let best: typeof list | null = null;
    let bestCost = current;
    for (let j = list.length - 1; j > 0; j--) {
      for (let i = j - 1; i >= 0; i--) {
        if (list[i]!.position !== list[j]!.position) continue;
        const next = [...list];
        [next[i], next[j]] = [next[j]!, next[i]!];
        const nextCost = cost(next);
        if (less(nextCost, bestCost)) {
          best = next;
          bestCost = nextCost;
        }
      }
    }
    if (!best) return list;
    list = best;
    current = bestCost;
  }
}

export function proposalFor(state: State): SeedEntry[] {
  const entries: { groupId: number; position: number }[] = [];
  const maxQualifiers = Math.max(0, ...state.groups.map((group) => group.qualifiers));
  for (let place = 1; place <= maxQualifiers; place++) {
    for (const group of state.groups) {
      if (group.qualifiers >= place) entries.push({ groupId: group.id, position: place });
    }
  }
  return climb(entries).flatMap((entry) => {
    const group = state.groups.find((candidate) => candidate.id === entry.groupId);
    if (!group) return [];
    const row = standingsFor(state, group)[entry.position - 1];
    if (!row) return [];
    return [{ teamId: row.team.id, groupId: entry.groupId, position: entry.position }];
  });
}

/** Drużyna wprost z tabeli, bez korekty — do porównania z rozjazdem. */
export function topQualifiers(state: State, group: Group): Team[] {
  return standingsFor(state, group)
    .slice(0, group.qualifiers)
    .map((row) => row.team);
}

/** Etykieta pochodzenia drużyny: „1A”, „2B”. */
export function originLabel(state: State, teamId: number): string | null {
  const group = state.groups.find((candidate) => candidate.teamIds.includes(teamId));
  if (!group) return null;
  const row = standingsFor(state, group).find((candidate) => candidate.team.id === teamId);
  if (!row) return null;
  return `${row.position}${GROUP_LETTERS[group.order - 1]}`;
}

// ——— Drabinka (atrapa S4) ———

function roundName(teamsInRound: number): string {
  if (teamsInRound <= 2) return 'Finał';
  if (teamsInRound <= 4) return 'Półfinał';
  if (teamsInRound <= 8) return 'Ćwierćfinał';
  return `1/${teamsInRound / 2} finału`;
}

/**
 * Drabinka z listy rozstawienia (#215 w atrapie): wolne losy dla najwyżej
 * rozstawionych, numery bez dziur po wolnych losach, mecz o 3. miejsce.
 */
export function buildKnockout(teamIds: number[], thirdPlace: boolean): KMatch[] {
  const size = bracketSize(teamIds.length);
  const slots = seedPositions(size);
  const matches: KMatch[] = [];
  const rounds = Math.log2(size);
  // Każdy mecz rundy 1: dwa seedy. Seed spoza listy to wolny los.
  const roundOne: (number | null)[][] = [];
  for (let i = 0; i < size; i += 2) {
    const home = slots[i]! <= teamIds.length ? teamIds[slots[i]! - 1]! : null;
    const away = slots[i + 1]! <= teamIds.length ? teamIds[slots[i + 1]! - 1]! : null;
    roundOne.push([home, away]);
  }
  const stage: (number | null)[][] = [];
  for (let round = 0; round < rounds; round++) {
    const teamsInRound = size / 2 ** round;
    const name = roundName(teamsInRound);
    const count = teamsInRound / 2;
    for (let index = 0; index < count; index++) {
      let home: number | null = null;
      let away: number | null = null;
      let homeSource: string | undefined;
      let awaySource: string | undefined;
      if (round === 0) {
        [home, away] = roundOne[index] ?? [null, null];
      } else {
        const pair = stage[index] ?? [null, null];
        home = pair[0];
        away = pair[1];
        const previous = roundName(size / 2 ** (round - 1));
        if (home === null) homeSource = `Zwycięzca: ${previous} ${index * 2 + 1}`;
        if (away === null) awaySource = `Zwycięzca: ${previous} ${index * 2 + 2}`;
      }
      const label = teamsInRound === 2 ? 'Finał' : `${name} ${index + 1}`;
      matches.push({
        id: nextId++,
        roundOrder: round + 1,
        roundName: name,
        matchNumber: index + 1,
        label,
        homeId: home,
        awayId: away,
        ...(homeSource ? { homeSource } : {}),
        ...(awaySource ? { awaySource } : {}),
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
      });
      stage[index] = [home, away];
    }
    // Zwycięzców nie propagujemy — prototyp pokazuje pary, nie kaskadę (S4).
    for (let index = 0; index < count; index++) stage[index] = [null, null];
  }
  if (thirdPlace && teamIds.length >= 4) {
    matches.push({
      id: nextId++,
      roundOrder: rounds,
      roundName: 'Finał',
      matchNumber: 2,
      label: 'Mecz o 3. miejsce',
      homeId: null,
      awayId: null,
      homeSource: 'Przegrany: Półfinał 1',
      awaySource: 'Przegrany: Półfinał 2',
      homeScore: null,
      awayScore: null,
      status: 'scheduled',
    });
  }
  return matches;
}

function buildBracketState(base: State, thirdPlace: boolean): State {
  const proposal = proposalFor(base);
  if (proposal.length < 2) return base;
  const teamIds = proposal.map((entry) => entry.teamId);
  return {
    ...base,
    thirdPlace,
    knockout: buildKnockout(teamIds, thirdPlace),
    lastSeeding: teamIds,
  };
}

export function playoffStarted(state: State): boolean {
  return state.knockout.some((match) => match.status !== 'scheduled');
}

/** Rozjazd drabinki z tabelami: drużyna w drabince zamiast kogoś z czołówki (#250). */
export function divergence(state: State): { group: Group; plays: Team; insteadOf: Team }[] {
  const inBracket = new Set(state.knockout.flatMap((match) => [match.homeId, match.awayId]).filter((id): id is number => id !== null));
  const out: { group: Group; plays: Team; insteadOf: Team }[] = [];
  for (const group of state.groups) {
    const top = topQualifiers(state, group);
    const missing = top.filter((team) => !inBracket.has(team.id));
    const extra = group.teamIds
      .filter((id) => inBracket.has(id) && !top.some((team) => team.id === id))
      .map((id) => state.teams.find((team) => team.id === id))
      .filter((team): team is Team => team !== undefined);
    missing.forEach((team, index) => {
      if (extra[index]) out.push({ group, plays: extra[index]!, insteadOf: team });
    });
  }
  return out;
}

// ——— Akcje (zaślepka API) ———

export const sim = {
  scenario(key: ScenarioKey) {
    set(build(key, state.sport, state.teamCount, state.groupCount));
    log(`GET /tournaments/1 … scenariusz „${SCENARIOS.find((s) => s.key === key)!.name}”`);
  },
  sport(sport: Sport) {
    set(build(state.scenario, sport, state.teamCount, state.groupCount));
    log(`GET /stage … sport: ${sport === 'basketball' ? 'kosz' : 'piłka'}`);
  },
  teamCount(count: number) {
    const groups = Math.min(state.groupCount, Math.max(1, Math.floor(count / 2)));
    set(build(state.scenario, state.sport, count, groups));
    log(`GET /teams … ${count} drużyn`);
  },
  groupCount(count: number) {
    set(build(state.scenario === 'no-groups' ? 'no-groups' : state.scenario, state.sport, state.teamCount, count));
    log(`GET /stage … ${count} grup`);
  },
  latency(ms: number) {
    set({ latencyMs: ms });
  },
  failNext(value: 'none' | '500') {
    set({ failNext: value });
  },
  /** Losowanie do `count` grup, w pamięci edytora. */
  draw(count: number) {
    const draft = drawDraft(state.teams, count);
    set({ draft, groupCount: count, draftDirty: true });
    log(`POST /stage/groups/losowanie … ${count} grup × ${draft[0]!.teamIds.length}`);
  },
  /** Przenosi drużynę do innej grupy (albo poza grupy, gdy `to === null`). */
  moveTeam(teamId: number, to: number | null) {
    const draft = state.draft.map((group) => ({ ...group, teamIds: group.teamIds.filter((id) => id !== teamId) }));
    if (to !== null) draft[to]?.teamIds.push(teamId);
    set({ draft, draftDirty: true });
    log(`PATCH /stage/groups (w pamięci) … drużyna ${teamId} → ${to === null ? 'bez grupy' : `grupa ${to + 1}`}`);
  },
  renameGroup(index: number, name: string) {
    const draft = state.draft.map((group, i) => (i === index ? { ...group, name } : group));
    set({ draft, draftDirty: true });
    log(`PATCH /stage/groups (w pamięci) … nazwa „${name}”`);
  },
  setQualifiers(index: number, qualifiers: number) {
    const draft = state.draft.map((group, i) => (i === index ? { ...group, qualifiers } : group));
    set({ draft, draftDirty: true });
    log(`PATCH /groups (w pamięci) … wychodzi ${qualifiers}`);
  },
  /**
   * `PATCH /groups/{group}` (#250): liczba wychodzących zmienia się na zapisanej
   * grupie, niezależnie od szkicu składu — na tym stoi sterowanie przy tabeli
   * (wariant C). Synchronizuje szkic, bo skład grup i szkic opisują ten sam byt.
   */
  setGroupQualifiers(groupId: number, qualifiers: number) {
    const groups = state.groups.map((group) => (group.id === groupId ? { ...group, qualifiers } : group));
    set({ groups, draft: groups.map(toDraft), draftDirty: false });
    log(`PATCH /groups/${groupId} … wychodzi ${qualifiers}`);
  },
  addTeam() {
    const team = { id: nextId++, name: `Pumy Saska Kępa ${state.teams.length + 1}` };
    set({ teams: [...state.teams, team], teamCount: state.teams.length + 1, extraTeam: team });
    log(`POST /tournaments/1/teams … ${team.name} (bez grupy)`);
  },
  /** `PUT /stages/{stage}/groups` (#249): waliduje i zastępuje cały skład. */
  saveComposition(): string | undefined {
    const teams = new Set(state.teams.map((team) => team.id));
    const seen = new Set<number>();
    for (const group of state.draft) {
      if (group.teamIds.length < 2) return `Grupa „${group.name}” potrzebuje co najmniej dwóch drużyn.`;
      for (const id of group.teamIds) {
        if (!teams.has(id)) return 'Skład musi zawierać każdą drużynę turnieju dokładnie raz.';
        if (seen.has(id)) return 'Skład musi zawierać każdą drużynę turnieju dokładnie raz.';
        seen.add(id);
      }
    }
    if (seen.size !== teams.size) return 'Skład musi zawierać każdą drużynę turnieju dokładnie raz.';
    const names = new Set(state.draft.map((group) => group.name));
    if (names.size !== state.draft.length) return 'Nazwy grup w fazie nie mogą się powtarzać.';
    const qualifiers = state.draft.reduce((sum, group) => sum + group.qualifiers, 0);
    if (qualifiers < 2) return 'Z grup muszą wyjść co najmniej dwie drużyny.';
    const groups = commit(state.draft, (index) => state.groups[index]?.id ?? 300 + index);
    set({ groups, draftDirty: false, matches: [], knockout: [], lastSeeding: null, extraTeam: null });
    log(`PUT /stages/77/groups … ${groups.length} grup (terminarz grup skasowany)`);
    return undefined;
  },
  generateSchedule(meetings: 1 | 2) {
    if (state.groups.length === 0) {
      log('POST /stages/77/schedule … 422 brak składu grup');
      return;
    }
    const missing = teamsWithoutGroup(state);
    if (missing.length > 0) {
      log(`POST /stages/77/schedule … 422 drużyna ${missing[0]!.name} bez grupy`);
      return;
    }
    set({ meetings, matches: generateRoundRobin(state.groups, meetings), knockout: [], lastSeeding: null });
    log(`POST /stages/77/schedule … meetings: ${meetings}`);
  },
  setResult(matchId: number, homeScore: number | null, awayScore: number | null, status: MatchStatus) {
    set({
      matches: state.matches.map((match) =>
        match.id === matchId ? { ...match, homeScore, awayScore, status } : match,
      ),
    });
    log(`PATCH /matches/${matchId} … ${homeScore ?? '–'}:${awayScore ?? '–'} (${status})`);
  },
  generateBracket(teamIds: number[], thirdPlace: boolean) {
    set({ knockout: buildKnockout(teamIds, thirdPlace), thirdPlace, lastSeeding: teamIds });
    log(`POST /stages/78/bracket … ${teamIds.length} drużyn, 3. miejsce: ${thirdPlace ? 'tak' : 'nie'}`);
  },
  clearBracket() {
    set({ knockout: [], lastSeeding: null });
    log('DELETE /stages/78/bracket (w pamięci) … drabinka skasowana');
  },
  reset() {
    set(build(state.scenario, state.sport, state.teamCount, state.groupCount));
    log('RESET prototypu');
  },
};
