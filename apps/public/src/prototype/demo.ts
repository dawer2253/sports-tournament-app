// PROTOTYP (#252) — turniej grupy + playoff w pamięci. Nie do main.
//
// Mock kontraktu nie ma przykładu `groups_playoff`, a seed Laravela turnieju
// dwufazowego, więc cały turniej żyje tutaj. Reguły odwzorowują rozstrzygnięcia:
// #249 (kolejka wspólna dla fazy, jedna tabela na grupę) i #250 (drabinka
// powstaje dopiero po wyjściu z grup, bez zaślepek i bez etykiet „1A”;
// drabinka wygenerowana przed końcem grup nie zmienia się po późniejszych
// wynikach). Rozstawienie krzyżowe to uproszczenie: pierwsze miejsca, potem
// drugie…, z zamianą w obrębie poziomu, żeby drużyny z jednej grupy nie grały
// ze sobą w 1. rundzie.
import {
  firstRoundPairs,
  type BracketMatch,
  type MatchInRound,
  type MatchRowData,
  type PublicShellTournament,
  type StandingsTableRow,
} from '@tournament/ui';
import { useMemo, useSyncExternalStore } from 'react';

export const BASE = '/t/grupy-demo';

export type Sport = 'football' | 'basketball';

export const CONFIGS = [
  { key: '2x4', name: '2 grupy po 4, wychodzi po 2', sizes: [4, 4], qualifiers: [2, 2] },
  { key: '3x4', name: '3 grupy po 4, wychodzi 3/3/2', sizes: [4, 4, 4], qualifiers: [3, 3, 2] },
  { key: '4x4', name: '4 grupy po 4, wychodzi po 2', sizes: [4, 4, 4, 4], qualifiers: [2, 2, 2, 2] },
  { key: '3x3', name: '3 grupy po 3, wychodzi po 2 (wolne losy)', sizes: [3, 3, 3], qualifiers: [2, 2, 2] },
  { key: '1x6', name: '1 grupa, 6 drużyn, wychodzą 4', sizes: [6], qualifiers: [4] },
] as const;
export type ConfigKey = (typeof CONFIGS)[number]['key'];

export const SCENARIOS = [
  { key: 'groups-start', name: 'Grupy rozlosowane, nic nie rozegrane' },
  { key: 'groups-live', name: 'Faza grupowa w trakcie (mecz na żywo)' },
  { key: 'groups-done', name: 'Grupy rozegrane, drabinki jeszcze nie ma' },
  { key: 'bracket-early', name: 'Drabinka przed końcem grup (rozjazd z tabelą)' },
  { key: 'playoff-live', name: 'Playoff w trakcie' },
  { key: 'finished', name: 'Turniej zakończony, jest mistrz' },
] as const;
export type ScenarioKey = (typeof SCENARIOS)[number]['key'];

export type ProtoState = { scenario: ScenarioKey; sport: Sport; config: ConfigKey; longNames: boolean };

let state: ProtoState = { scenario: 'groups-live', sport: 'football', config: '3x4', longNames: false };
const listeners = new Set<() => void>();

export const proto = {
  set(patch: Partial<ProtoState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  },
};

export function useProto(): ProtoState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

// --- Kształty ------------------------------------------------------------------

export type Team = { id: number; name: string };

export type DemoGroup = { id: number; name: string; order: number; qualifiers: number; teamIds: number[] };

export const GROUP_STAGE_ID = 1;
export const KNOCKOUT_STAGE_ID = 2;

/** Mecz obu faz: pasuje do `MatchInRound` (listy) i `BracketMatch` (drzewo). */
export type DemoMatch = MatchRowData &
  MatchInRound &
  BracketMatch & {
    stageId: number;
    /** `Match.groupId`: mecz fazy grupowej; w playoffie `null`. */
    groupId: number | null;
    homePenalties: number | null;
    awayPenalties: number | null;
  };

/** Wiersz tabeli grupy z linią wyjścia (`Group.qualifiers`, #250). */
export type GroupRow = StandingsTableRow & { qualifies: boolean };

export type Divergence = { group: DemoGroup; inBracket: Team; aboveLine: Team };

export type Demo = {
  shell: PublicShellTournament;
  sport: Sport;
  allowsDraw: boolean;
  scoreLabel: string;
  teams: Map<number, Team>;
  groups: DemoGroup[];
  groupMatches: DemoMatch[];
  /** Komplet meczów fazy `knockout`; pusty, dopóki organizer nie wygeneruje drabinki (#250). */
  knockout: DemoMatch[];
  tables: Map<number, GroupRow[]>;
  /** Drużyny w drabince, których nie ma dziś nad linią swojej grupy (#250). */
  divergence: Divergence[];
  groupsFinished: boolean;
};

// --- Dane ----------------------------------------------------------------------

const NAMES = [
  'Wilki Bemowo', 'Sokoły Ursus', 'Orły Wola', 'Lwy Mokotów', 'Rysie Bielany', 'Żubry Praga',
  'Jastrzębie Ochota', 'Dziki Targówek', 'Borsuki Wawer', 'Kruki Żoliborz', 'Łosie Ursynów',
  'Bobry Wilanów', 'Foki Śródmieście', 'Lisy Włochy', 'Rekiny Rembertów', 'Sowy Wesoła',
];
const LONG_NAMES = [
  'Akademia Piłkarska Wilki Bemowo', 'Sokoły Ursus Warszawa', 'Orły Wola', 'Klub Sportowy Lwy Mokotów',
  'Rysie Bielany', 'Uczniowski Klub Sportowy Żubry Praga Północ', 'Jastrzębie Ochota', 'Dziki Targówek',
  'Borsuki Wawer', 'Kruki Żoliborz Oldboje', 'Łosie Ursynów', 'Bobry Wilanów',
  'Foki Śródmieście', 'Lisy Włochy', 'Rekiny Rembertów', 'Sowy Wesoła',
];

const SHELL: Record<Sport, PublicShellTournament> = {
  football: {
    name: 'Mistrzostwa Dzielnic 2026',
    slug: 'grupy-demo',
    status: 'active',
    sport: { code: 'football', name: 'Piłka nożna' },
    branding: { logoUrl: null, primaryColor: '#0f766e' },
  },
  basketball: {
    name: 'Liga Dzielnic 3×3 — grupy i playoff',
    slug: 'grupy-demo',
    status: 'active',
    sport: { code: 'basketball', name: 'Koszykówka' },
    branding: { logoUrl: null, primaryColor: '#c2410c' },
  },
};

const LETTERS = 'ABCDEFGH';
const VENUES = [
  { id: 1, name: 'Orlik Bemowo' },
  { id: 2, name: 'Hala OSiR Wola' },
];

/** Deterministyczny „los” z liczby, żeby wyniki nie skakały przy przełączaniu. */
function noise(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function score(sport: Sport, seed: number): [number, number] {
  if (sport === 'basketball') {
    const home = 60 + Math.floor(noise(seed) * 35);
    let away = 60 + Math.floor(noise(seed + 1) * 35);
    if (away === home) away += 3;
    return [home, away];
  }
  return [Math.floor(noise(seed) * 4), Math.floor(noise(seed + 1) * 3.4)];
}

/** Kolejki „każdy z każdym” metodą Bergera; nieparzysta grupa ma pauzę. */
function berger(ids: number[]): [number, number][][] {
  const list: (number | null)[] = ids.length % 2 ? [...ids, null] : [...ids];
  const n = list.length;
  const rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a != null && b != null) pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    list.splice(1, 0, list.pop()!);
  }
  return rounds;
}

function kickoff(day: number, slot: number): string {
  const date = new Date(Date.UTC(2026, 8, 5 + day, 8 + slot * 2, slot % 2 ? 30 : 0));
  return date.toISOString().replace('.000Z', '+00:00');
}

function knockoutRoundName(teamsInRound: number): string {
  if (teamsInRound === 2) return 'Finał';
  if (teamsInRound === 4) return 'Półfinał';
  if (teamsInRound === 8) return 'Ćwierćfinał';
  return `1/${teamsInRound / 2} finału`;
}

export function buildDemo({ scenario, sport, config, longNames }: ProtoState): Demo {
  const cfg = CONFIGS.find((candidate) => candidate.key === config)!;
  const allowsDraw = sport === 'football';
  const names = longNames ? LONG_NAMES : NAMES;
  const total = cfg.sizes.reduce((sum, size) => sum + size, 0);
  const teamList: Team[] = names.slice(0, total).map((name, index) => ({ id: index + 1, name }));
  const teams = new Map(teamList.map((team) => [team.id, team]));

  // Skład grup: drużyny po kolei do grup (losowanie w panelu, #249).
  const groups: DemoGroup[] = cfg.sizes.map((_, index) => ({
    id: 10 + index,
    name: `Grupa ${LETTERS[index]}`,
    order: index + 1,
    qualifiers: cfg.qualifiers[index]!,
    teamIds: [],
  }));
  teamList.forEach((team, index) => {
    let g = index % groups.length;
    while (groups[g]!.teamIds.length >= cfg.sizes[g]!) g = (g + 1) % groups.length;
    groups[g]!.teamIds.push(team.id);
  });

  // Terminarz fazy grupowej: kolejka wspólna dla fazy (ADR-0011), A, potem B…
  const perGroup = groups.map((group) => berger(group.teamIds));
  const roundCount = Math.max(...perGroup.map((rounds) => rounds.length));
  const groupMatches: DemoMatch[] = [];
  let id = 1;
  for (let r = 0; r < roundCount; r++) {
    let slot = 0;
    groups.forEach((group, g) => {
      for (const [home, away] of perGroup[g]![r] ?? []) {
        groupMatches.push({
          id: id++,
          stageId: GROUP_STAGE_ID,
          groupId: group.id,
          round: { id: 100 + r + 1, name: `Kolejka ${r + 1}`, order: r + 1 },
          matchNumber: groupMatches.length + 1,
          homeTeam: teams.get(home)!,
          awayTeam: teams.get(away)!,
          homeScore: null,
          awayScore: null,
          homePenalties: null,
          awayPenalties: null,
          status: 'scheduled',
          kickoffAt: kickoff(r * 7 + (slot >= 6 ? 1 : 0), slot % 6),
          venue: VENUES[slot % 2]!,
          winnerToMatchId: null,
          loserToMatchId: null,
          advancesToSlot: null,
        });
        slot++;
      }
    });
  }

  // Wyniki grup wg scenariusza.
  const ordered = groupMatches.toSorted((a, b) => (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? ''));
  let finishedGroup = 0;
  if (scenario === 'groups-live') finishedGroup = Math.floor(ordered.length * 0.55);
  else if (scenario === 'bracket-early') finishedGroup = ordered.length - Math.max(1, Math.floor(groups.length * 1.5));
  else if (scenario !== 'groups-start') finishedGroup = ordered.length;
  ordered.forEach((match, index) => {
    if (index < finishedGroup) {
      [match.homeScore, match.awayScore] = score(sport, match.id * 7);
      match.status = 'finished';
    } else if (index === finishedGroup && scenario === 'groups-live') {
      match.homeScore = sport === 'football' ? 1 : 41;
      match.awayScore = sport === 'football' ? 1 : 38;
      match.status = 'live';
    }
  });

  const tables = new Map(groups.map((group) => [group.id, standings(group, groupMatches, teams, sport)]));
  const groupsFinished = groupMatches.every((match) => match.status === 'finished');

  // Drabinka powstaje dopiero po wyjściu z grup (#250).
  let knockout: DemoMatch[] = [];
  const divergence: Divergence[] = [];
  if (scenario === 'bracket-early' || scenario === 'playoff-live' || scenario === 'finished') {
    const qualified = groups.map((group) => tables.get(group.id)!.slice(0, group.qualifiers).map((row) => row.team.id));
    if (scenario === 'bracket-early') {
      // Organizer wygenerował drabinkę kolejkę wcześniej: w grupie A nad linią
      // stała wtedy drużyna, która dziś jest pod nią.
      const tableA = tables.get(groups[0]!.id)!;
      const line = groups[0]!.qualifiers;
      if (tableA.length > line) {
        const inBracket = tableA[line]!.team;
        const aboveLine = tableA[line - 1]!.team;
        qualified[0]![line - 1] = inBracket.id;
        divergence.push({ group: groups[0]!, inBracket, aboveLine });
      }
    }
    knockout = buildKnockout(crossSeeding(qualified, groups), teams, roundCount);
    playKnockout(knockout, scenario, sport);
  }

  return {
    shell: SHELL[sport],
    sport,
    allowsDraw,
    scoreLabel: sport === 'football' ? 'Bramki' : 'Punkty',
    teams,
    groups,
    groupMatches,
    knockout,
    tables,
    divergence,
    groupsFinished,
  };
}

function standings(group: DemoGroup, matches: DemoMatch[], teams: Map<number, Team>, sport: Sport): GroupRow[] {
  const rows = new Map(
    group.teamIds.map((teamId) => [
      teamId,
      {
        position: 0,
        team: { ...teams.get(teamId)!, logoUrl: null },
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        scoreDifference: 0,
        points: 0,
        qualifies: false,
      } satisfies GroupRow,
    ]),
  );
  for (const match of matches) {
    if (match.groupId !== group.id || match.status !== 'finished') continue;
    const home = rows.get(match.homeTeam!.id)!;
    const away = rows.get(match.awayTeam!.id)!;
    const [hs, as] = [match.homeScore!, match.awayScore!];
    for (const [row, f, a] of [[home, hs, as], [away, as, hs]] as const) {
      row.played++;
      row.scoreFor += f;
      row.scoreAgainst += a;
      row.scoreDifference = row.scoreFor - row.scoreAgainst;
      if (f > a) {
        row.won++;
        row.points += sport === 'football' ? 3 : 2;
      } else if (f === a) {
        row.drawn++;
        row.points += 1;
      } else {
        row.lost++;
        row.points += sport === 'football' ? 0 : 1;
      }
    }
  }
  return [...rows.values()]
    .toSorted(
      (a, b) =>
        b.points - a.points ||
        b.scoreDifference - a.scoreDifference ||
        b.scoreFor - a.scoreFor ||
        a.team.name.localeCompare(b.team.name, 'pl'),
    )
    .map((row, index) => ({ ...row, position: index + 1, qualifies: index < group.qualifiers }));
}

/**
 * Kolejność rozstawienia: wszystkie pierwsze miejsca w kolejności grup, potem
 * drugie… Para z tej samej grupy w 1. rundzie rozbija się zamianą w obrębie
 * poziomu (uproszczenie propozycji z #250).
 */
function crossSeeding(qualified: number[][], groups: DemoGroup[]): number[] {
  const groupOf = new Map<number, number>();
  qualified.forEach((ids, g) => ids.forEach((teamId) => groupOf.set(teamId, groups[g]!.id)));
  const tiers: number[][] = [];
  qualified.forEach((ids) => ids.forEach((teamId, position) => (tiers[position] ??= []).push(teamId)));
  const seeding = tiers.flat();
  const clash = (list: number[]) =>
    firstRoundPairs(list).some((pair) => pair.away !== null && groupOf.get(pair.home) === groupOf.get(pair.away));
  for (let attempt = 0; attempt < 50 && clash(seeding); attempt++) {
    const tierStart = tiers.slice(0, -1).reduce((sum, tier) => sum + tier.length, 0);
    const last = seeding.splice(tierStart);
    last.push(last.shift()!);
    seeding.push(...last);
    if (attempt % 3 === 2) {
      // Obrót ostatniego poziomu nie wystarcza: przestaw przedostatni.
      const prev = tiers.length > 1 ? tiers.slice(0, -2).reduce((sum, tier) => sum + tier.length, 0) : 0;
      const block = seeding.splice(prev, tiers[tiers.length - 2]?.length ?? 0);
      block.push(block.shift()!);
      seeding.splice(prev, 0, ...block);
    }
  }
  return seeding;
}

function buildKnockout(seeding: number[], teams: Map<number, Team>, groupRounds: number): DemoMatch[] {
  const pairs = firstRoundPairs(seeding);
  const size = pairs.length * 2;
  const rounds = Math.log2(size);
  const matches: DemoMatch[] = [];
  let id = 500;
  const byRound: DemoMatch[][] = [];
  const firstDay = groupRounds * 7 + 7;
  for (let r = 1; r <= rounds; r++) {
    const teamsInRound = size / 2 ** (r - 1);
    const count = teamsInRound / 2;
    const round = { id: 200 + r, name: knockoutRoundName(teamsInRound), order: r };
    byRound[r] = [];
    for (let n = 1; n <= count; n++) {
      if (r === 1 && pairs[n - 1]!.away === null) continue;
      const match: DemoMatch = {
        id: id++,
        stageId: KNOCKOUT_STAGE_ID,
        groupId: null,
        round,
        matchNumber: n,
        homeTeam: r === 1 ? teams.get(pairs[n - 1]!.home)! : null,
        awayTeam: r === 1 ? teams.get(pairs[n - 1]!.away!)! : null,
        homeScore: null,
        awayScore: null,
        homePenalties: null,
        awayPenalties: null,
        status: 'scheduled',
        kickoffAt: kickoff(firstDay + (r - 1) * 7, rounds === r ? n + 1 : n - 1),
        venue: VENUES[n % 2]!,
        winnerToMatchId: null,
        loserToMatchId: null,
        advancesToSlot: r === rounds ? null : n % 2 ? 'home' : 'away',
      };
      byRound[r]!.push(match);
      matches.push(match);
    }
  }
  // Krawędzie zwycięzców i wolne losy prosto do 2. rundy.
  for (let r = 1; r < rounds; r++) {
    for (const match of byRound[r]!) {
      match.winnerToMatchId = byRound[r + 1]!.find((next) => next.matchNumber === Math.ceil(match.matchNumber / 2))!.id;
    }
  }
  if (rounds >= 2) {
    pairs.forEach((pair, index) => {
      if (pair.away !== null) return;
      const next = byRound[2]!.find((candidate) => candidate.matchNumber === Math.ceil((index + 1) / 2))!;
      if ((index + 1) % 2) next.homeTeam = teams.get(pair.home)!;
      else next.awayTeam = teams.get(pair.home)!;
    });
  }
  // Mecz o 3. miejsce: w rundzie finału, przed finałem.
  if (rounds >= 2) {
    const final = byRound[rounds]![0]!;
    const third: DemoMatch = {
      ...final,
      id: id++,
      matchNumber: 2,
      kickoffAt: kickoff(firstDay + (rounds - 1) * 7, 0),
      venue: VENUES[1]!,
    };
    for (const semi of byRound[rounds - 1]!) semi.loserToMatchId = third.id;
    matches.push(third);
  }
  return matches;
}

function playKnockout(matches: DemoMatch[], scenario: ScenarioKey, sport: Sport) {
  if (scenario === 'bracket-early') return;
  const rounds = Math.max(...matches.map((match) => match.round.order));
  const byId = new Map(matches.map((match) => [match.id, match]));
  const order = matches.toSorted((a, b) => a.round.order - b.round.order || (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? ''));
  const firstRound = matches.filter((match) => match.round.order === 1).length;
  const finishCount = scenario === 'finished' ? order.length : rounds >= 3 ? firstRound + 1 : 1;
  let penaltiesUsed = 0;
  order.forEach((match, index) => {
    if (!match.homeTeam || !match.awayTeam) return;
    if (index < finishCount) {
      let [home, away] = score(sport, match.id * 13);
      // Piłka: co drugi remis zostaje i idzie w karne, w tym finał zakończonego turnieju.
      const isFinal = match.round.order === rounds && !matches.some((m) => m.loserToMatchId === match.id);
      if (sport === 'football' && (home === away || (isFinal && scenario === 'finished') || (penaltiesUsed === 0 && index === 1))) {
        away = home;
        match.homePenalties = 4;
        match.awayPenalties = 3 + (match.id % 2 ? 2 : 0);
        penaltiesUsed++;
      }
      match.homeScore = home;
      match.awayScore = away;
      match.status = 'finished';
      const homeWins =
        home !== away ? home > away : (match.homePenalties ?? 0) > (match.awayPenalties ?? 0);
      const [winner, loser] = homeWins ? [match.homeTeam, match.awayTeam] : [match.awayTeam, match.homeTeam];
      const next = match.winnerToMatchId ? byId.get(match.winnerToMatchId) : undefined;
      if (next) next[match.advancesToSlot === 'home' ? 'homeTeam' : 'awayTeam'] = winner;
      const third = match.loserToMatchId ? byId.get(match.loserToMatchId) : undefined;
      if (third) third[match.matchNumber % 2 ? 'homeTeam' : 'awayTeam'] = loser;
    } else if (index === finishCount && scenario === 'playoff-live') {
      match.homeScore = sport === 'football' ? 0 : 33;
      match.awayScore = sport === 'football' ? 1 : 35;
      match.status = 'live';
    }
  });
}

/** Turniej z bieżącego stanu przełączników. */
export function useDemo(): Demo {
  const s = useProto();
  return useMemo(() => buildDemo(s), [s]);
}

export function groupName(demo: Demo, groupId: number | null): string | null {
  return demo.groups.find((group) => group.id === groupId)?.name ?? null;
}

/** Faza, w której turniej jest dla kibica. */
export function phase(demo: Demo): 'groups' | 'playoff' | 'finished' {
  if (demo.knockout.length === 0) return 'groups';
  const final = demo.knockout.find(
    (match) => match.winnerToMatchId === null && !demo.knockout.some((m) => m.loserToMatchId === match.id),
  );
  return final?.status === 'finished' ? 'finished' : 'playoff';
}
