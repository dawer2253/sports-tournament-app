// PROTOTYP (#218) — wyrzucany kod na gałęzi prototype/drabinka-publiczna, nie do main.
// Drabinka pucharu w pamięci, zbudowana regułami z #215 (rozstawienie, wolne
// losy, numery z dziurami, nazwy rund, mecz o 3. miejsce) i #216 (awans przy
// `finished`, karne przy remisie). Panel stanu przełącza liczbę drużyn, stan
// turnieju, sport, mecz o 3. miejsce i długie nazwy.
import { bracketSeedPositions, bracketSize } from '@tournament/ui';
import { useSyncExternalStore } from 'react';

export type Sport = 'football' | 'basketball';
export type Status = 'scheduled' | 'live' | 'finished';
export type Side = 'home' | 'away';

export type ProtoTeam = { id: number; name: string; seed: number };

export type ProtoMatch = {
  id: number;
  round: { id: number; name: string; order: number };
  /** Pozycja w pełnej drabince 2^k, z dziurami po wolnych losach (#215). */
  matchNumber: number;
  /** „1/8 finału 3”, „Półfinał 1”, „Finał”, „Mecz o 3. miejsce”. */
  label: string;
  third: boolean;
  kickoffAt: string;
  venue: { id: number; name: string } | null;
  status: Status;
  homeTeam: ProtoTeam | null;
  awayTeam: ProtoTeam | null;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  winnerToMatchId: number | null;
  loserToMatchId: number | null;
  advancesToSlot: Side | null;
  /** „Zwycięzca: 1/8 finału 3”, póki slot jest pusty. */
  homeSource?: string;
  awaySource?: string;
};

/** Miejsce w pełnej drabince: mecz albo wolny los (meczu nie ma, drużyna stoi od razu w rundzie 2). */
export type Slot = { kind: 'match'; match: ProtoMatch } | { kind: 'bye'; team: ProtoTeam; target: ProtoMatch; side: Side };

export type ProtoRound = {
  id: number;
  order: number;
  name: string;
  /** Krótka nazwa do pigułek: „1/64”, „ĆF”, „PF”, „F”. */
  short: string;
  /** Mecze pozycyjne po `matchNumber` (bez meczu o 3. miejsce). */
  matches: ProtoMatch[];
  /** Pełna drabinka: `size / 2^order` miejsc, wolne losy w miejscu brakujących meczów. */
  slots: Slot[];
  third: ProtoMatch | null;
  finished: number;
  total: number;
};

export type ProtoBracket = {
  size: number;
  teams: ProtoTeam[];
  rounds: ProtoRound[];
  matches: ProtoMatch[];
  champion: ProtoTeam | null;
  byes: { team: ProtoTeam; target: ProtoMatch }[];
  /** Runda z pierwszym niezakończonym meczem; po finale — ostatnia. */
  currentOrder: number;
};

// --- Stan prototypu ---------------------------------------------------------

export type ProtoState = {
  teams: number;
  /** `before`, `r:<order>` (ta runda trwa, wcześniejsze rozegrane), `done`. */
  stage: string;
  sport: Sport;
  thirdPlace: boolean;
  longNames: boolean;
};

export const TEAM_COUNTS = [128, 16, 100, 33, 12, 6] as const;

// Liczbę drużyn i sport da się podać w adresie (`?druzyn=16&sport=kosz`), żeby linki do obu wersji były gotowe.
const initial = new URLSearchParams(window.location.search);
const initialTeams = TEAM_COUNTS.find((count) => String(count) === initial.get('druzyn')) ?? 128;
let state: ProtoState = {
  teams: initialTeams,
  stage: defaultStage(initialTeams),
  sport: initial.get('sport') === 'kosz' ? 'basketball' : 'football',
  thirdPlace: true,
  longNames: false,
};
const listeners = new Set<() => void>();

export function defaultStage(teams: number): string {
  const rounds = Math.log2(bracketSize(teams));
  return `r:${Math.ceil(rounds / 2)}`;
}

export const proto = {
  get: () => state,
  set(patch: Partial<ProtoState>) {
    const next = { ...state, ...patch };
    if (patch.teams !== undefined && patch.stage === undefined) {
      const rounds = Math.log2(bracketSize(next.teams));
      const order = Number(next.stage.slice(2));
      if (next.stage.startsWith('r:') && order > rounds) next.stage = defaultStage(next.teams);
    }
    state = next;
    cache = null;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useProto(): ProtoState {
  return useSyncExternalStore(proto.subscribe, proto.get);
}

let cache: { key: ProtoState; bracket: ProtoBracket } | null = null;

export function useBracket(): ProtoBracket {
  const s = useProto();
  if (cache?.key !== s) cache = { key: s, bracket: buildBracket(s) };
  return cache.bracket;
}

export function stageOptions(teams: number): { value: string; label: string }[] {
  const rounds = Math.log2(bracketSize(teams));
  return [
    { value: 'before', label: 'przed startem' },
    ...Array.from({ length: rounds }, (_, i) => ({ value: `r:${i + 1}`, label: `trwa: ${roundName(bracketSize(teams) / 2 ** i)}` })),
    { value: 'done', label: 'zakończony (jest mistrz)' },
  ];
}

// --- Turniej i drużyny ------------------------------------------------------

export const SLUG = 'puchar-demo';
export const BASE = `/t/${SLUG}`;

export const TOURNAMENT: Record<Sport, { name: string; slug: string; status: 'active' | 'finished'; sport: { code: string; name: string }; branding: { logoUrl: null; primaryColor: string } }> = {
  football: {
    name: 'Puchar Warszawy 2026',
    slug: SLUG,
    status: 'active',
    sport: { code: 'football', name: 'Piłka nożna' },
    branding: { logoUrl: null, primaryColor: '#15803d' },
  },
  basketball: {
    name: 'Puchar Mazowsza w koszykówce 2026',
    slug: SLUG,
    status: 'active',
    sport: { code: 'basketball', name: 'Koszykówka' },
    branding: { logoUrl: null, primaryColor: '#c2410c' },
  },
};

const NICKS = ['Wilki', 'Orły', 'Sokoły', 'Lwy', 'Żubry', 'Rysie', 'Jastrzębie', 'Niedźwiedzie', 'Pantery', 'Byki', 'Kruki', 'Borsuki', 'Dziki', 'Lisy', 'Tygrysy', 'Smoki'];
const PLACES = ['Bemowo', 'Wola', 'Mokotów', 'Praga', 'Ursynów', 'Bielany', 'Targówek', 'Wawer', 'Ochota', 'Żoliborz', 'Białołęka', 'Wilanów', 'Rembertów', 'Ursus', 'Wesoła', 'Śródmieście'];

function teamNames(count: number, long: boolean): string[] {
  // Przesunięcie o 5 miesza przydomki i dzielnice, więc sąsiednie seedy nie
  // dzielą przydomka, a 128 nazw nie powtarza się.
  return Array.from({ length: count }, (_, i) => {
    const nick = NICKS[i % 16];
    const place = PLACES[(i * 5 + Math.floor(i / 16)) % 16];
    return long ? `Uczniowski Klub Sportowy ${nick} ${place} Warszawa` : `${nick} ${place}`;
  });
}

// --- Rundy ------------------------------------------------------------------

/** Nazwa rundy po liczbie drużyn w pełnej drabince — jak `BracketGenerator::roundName`. */
export function roundName(teamsInRound: number): string {
  if (teamsInRound === 2) return 'Finał';
  if (teamsInRound === 4) return 'Półfinał';
  if (teamsInRound === 8) return 'Ćwierćfinał';
  return `1/${teamsInRound / 2} finału`;
}

function shortName(teamsInRound: number): string {
  if (teamsInRound === 2) return 'Finał';
  return `1/${teamsInRound / 2}`;
}

// --- Losowość powtarzalna ---------------------------------------------------

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function goals(random: () => number): number {
  const x = random();
  return x < 0.24 ? 0 : x < 0.58 ? 1 : x < 0.8 ? 2 : x < 0.93 ? 3 : 4;
}

// --- Terminy ----------------------------------------------------------------

const VENUES = [
  { id: 1, name: 'Boisko Orlik Bemowo' },
  { id: 2, name: 'Stadion OSiR Wola' },
  { id: 3, name: 'Hala Arena Ursynów' },
  { id: 4, name: 'Boisko SP 12' },
];

/** Runda `order` gra w sobotę i niedzielę; cztery boiska naraz, mecze co godzinę od 9:00. */
function kickoff(order: number, index: number, current: number, third: boolean, final: boolean): { at: string; venue: (typeof VENUES)[number] } {
  // Bieżąca runda wypada w najbliższy weekend (17–18.10.2026), pozostałe co tydzień przed nią i po niej.
  const base = Date.UTC(2026, 9, 17) + (order - current) * 7 * 86_400_000;
  // Czas letni kończy się 25.10.2026, po nim Warszawa ma +01:00.
  const iso = (date: Date, hour: number) => {
    const day = date.toISOString().slice(0, 10);
    return `${day}T${String(hour).padStart(2, '0')}:00:00${day >= '2026-10-25' ? '+01:00' : '+02:00'}`;
  };
  if (final || third) return { at: iso(new Date(base + 86_400_000), third ? 14 : 17), venue: VENUES[1] };
  const slot = Math.floor(index / 4);
  const day = Math.floor(slot / 10);
  return { at: iso(new Date(base + day * 86_400_000), 9 + (slot % 10)), venue: VENUES[index % 4] };
}

// --- Budowa drabinki --------------------------------------------------------

export function matchLabel(roundName: string, matchNumber: number, third: boolean): string {
  if (third) return 'Mecz o 3. miejsce';
  return roundName === 'Finał' ? 'Finał' : `${roundName} ${matchNumber}`;
}

export function buildBracket(s: ProtoState): ProtoBracket {
  const n = s.teams;
  const size = bracketSize(n);
  const k = Math.log2(size);
  const names = teamNames(n, s.longNames);
  const teams: ProtoTeam[] = names.map((name, i) => ({ id: i + 1, name, seed: i + 1 }));
  const positions = bracketSeedPositions(size);
  const withThird = s.thirdPlace && n >= 4;

  // Mecze pozycyjne: [order][matchNumber - 1], `null` w miejscu wolnego losu.
  let nextId = 1;
  const grid: (ProtoMatch | null)[][] = [];
  const rounds: ProtoRound[] = [];
  for (let order = 1; order <= k; order++) {
    const count = size / 2 ** order;
    const name = roundName(count * 2);
    const round = { id: 100 + order, name, order };
    const row: (ProtoMatch | null)[] = [];
    for (let p = 1; p <= count; p++) {
      const bye = order === 1 && positions[2 * p - 1] > n;
      row.push(bye ? null : blankMatch(nextId++, round, p, false));
    }
    grid.push(row);
    rounds.push({ id: round.id, order, name, short: shortName(count * 2), matches: [], slots: [], third: null, finished: 0, total: 0 });
  }
  const finalRound = rounds[k - 1];
  const third = withThird ? blankMatch(nextId++, { id: finalRound.id, name: finalRound.name, order: k }, 2, true) : null;

  // Krawędzie.
  for (let order = 1; order < k; order++) {
    grid[order - 1].forEach((match, i) => {
      if (!match) return;
      const target = grid[order][Math.floor(i / 2)]!;
      match.winnerToMatchId = target.id;
      match.advancesToSlot = i % 2 === 0 ? 'home' : 'away';
      if (order === k - 1 && third) match.loserToMatchId = third.id;
    });
  }

  // Pierwsza runda i wolne losy.
  const byes: ProtoBracket['byes'] = [];
  grid[0].forEach((match, i) => {
    const home = teams[positions[2 * i] - 1];
    if (match) {
      match.homeTeam = home;
      match.awayTeam = teams[positions[2 * i + 1] - 1];
    } else {
      const target = grid[1][Math.floor(i / 2)]!;
      const side: Side = i % 2 === 0 ? 'home' : 'away';
      target[side === 'home' ? 'homeTeam' : 'awayTeam'] = home;
      byes.push({ team: home, target });
    }
  });

  const current = s.stage === 'before' ? 1 : s.stage === 'done' ? k + 1 : Number(s.stage.slice(2));

  // Terminy.
  const all = [...grid.flat().filter((m): m is ProtoMatch => m !== null), ...(third ? [third] : [])];
  for (let order = 1; order <= k; order++) {
    const roundMatches = grid[order - 1].filter((m): m is ProtoMatch => m !== null);
    roundMatches.forEach((match, i) => {
      const { at, venue } = kickoff(order, i, current, false, order === k);
      match.kickoffAt = at;
      match.venue = venue;
    });
  }
  if (third) {
    const { at, venue } = kickoff(k, 0, current, true, false);
    third.kickoffAt = at;
    third.venue = venue;
  }

  // Wyniki według stanu turnieju.
  const byId = new Map(all.map((m) => [m.id, m]));
  const random = rng(n * 7919 + (s.sport === 'football' ? 1 : 2));
  for (let order = 1; order <= k; order++) {
    const roundMatches = grid[order - 1].filter((m): m is ProtoMatch => m !== null);
    // W rundzie finału mecz o 3. miejsce gra przed finałem.
    if (order === k && third) roundMatches.unshift(third);
    roundMatches.forEach((match, i) => {
      let status: Status = 'scheduled';
      if (order < current) status = 'finished';
      else if (order === current && s.stage !== 'before') {
        const m = roundMatches.length;
        // W rundzie finału: mecz o 3. miejsce rozegrany, finał trwa.
        const finishedCount = order === k && third ? 1 : m === 1 ? 0 : Math.floor(m * 0.45);
        const liveCount = order === k && third ? 1 : m === 1 ? 1 : Math.max(1, Math.min(2, Math.floor(m / 4)));
        status = i < finishedCount ? 'finished' : i < finishedCount + liveCount ? 'live' : 'scheduled';
      }
      if (status === 'scheduled' || !match.homeTeam || !match.awayTeam) return;
      play(match, status, s.sport, random);
      if (status === 'finished') advance(match, byId);
    });
  }

  // Podpisy pustych slotów i rundy.
  for (const match of all) {
    for (const side of ['home', 'away'] as const) {
      if (match[side === 'home' ? 'homeTeam' : 'awayTeam']) continue;
      const winner = all.find((m) => m.winnerToMatchId === match.id && m.advancesToSlot === side);
      const loser = all.find((m) => m.loserToMatchId === match.id && m.advancesToSlot === side);
      const source = winner ? `Zwycięzca: ${winner.label}` : loser ? `Przegrany: ${loser.label}` : undefined;
      if (side === 'home') match.homeSource = source;
      else match.awaySource = source;
    }
  }
  rounds.forEach((round, r) => {
    round.matches = grid[r].filter((m): m is ProtoMatch => m !== null);
    round.slots = grid[r].map((match, i) => {
      if (match) return { kind: 'match', match } as const;
      const bye = byes.find((b) => b.target === grid[1][Math.floor(i / 2)] && positions[2 * i] === b.team.seed)!;
      return { kind: 'bye', team: bye.team, target: bye.target, side: i % 2 === 0 ? 'home' : 'away' } as const;
    });
    if (r === k - 1) round.third = third;
    const counted = [...round.matches, ...(round.third ? [round.third] : [])];
    round.finished = counted.filter((m) => m.status === 'finished').length;
    round.total = counted.length;
  });

  const final = grid[k - 1][0]!;
  const winner = winnerSide(final);
  const champion = winner ? (winner === 'home' ? final.homeTeam : final.awayTeam) : null;
  const currentOrder = rounds.find((round) => round.finished < round.total)?.order ?? k;

  return { size, teams, rounds, matches: all, champion, byes, currentOrder };
}

function blankMatch(id: number, round: { id: number; name: string; order: number }, matchNumber: number, third: boolean): ProtoMatch {
  return {
    id,
    round,
    matchNumber,
    label: matchLabel(round.name, matchNumber, third),
    third,
    kickoffAt: '',
    venue: null,
    status: 'scheduled',
    homeTeam: null,
    awayTeam: null,
    homeScore: null,
    awayScore: null,
    homePenalties: null,
    awayPenalties: null,
    winnerToMatchId: null,
    loserToMatchId: null,
    advancesToSlot: null,
  };
}

function play(match: ProtoMatch, status: Status, sport: Sport, random: () => number) {
  match.status = status;
  if (sport === 'basketball') {
    const factor = status === 'live' ? 0.55 : 1;
    let home = Math.round((58 + random() * 38) * factor);
    let away = Math.round((58 + random() * 38) * factor);
    if (status === 'finished' && home === away) home += 3;
    match.homeScore = home;
    match.awayScore = away;
    return;
  }
  // Lekka przewaga wyżej rozstawionych, żeby drabinka wyglądała prawdopodobnie.
  const favourite = (match.homeTeam!.seed < match.awayTeam!.seed ? 'home' : 'away') as Side;
  let home = goals(random);
  let away = goals(random);
  if (random() < 0.35) {
    if (favourite === 'home') home += 1;
    else away += 1;
  }
  if (status === 'live') {
    home = Math.min(home, 2);
    away = Math.min(away, 1);
  }
  match.homeScore = home;
  match.awayScore = away;
  if (status === 'finished' && home === away) {
    const winnerPens = 4 + Math.floor(random() * 2);
    const loserPens = winnerPens - 1 - Math.floor(random() * 2);
    const homeWins = random() < 0.5;
    match.homePenalties = homeWins ? winnerPens : loserPens;
    match.awayPenalties = homeWins ? loserPens : winnerPens;
  }
}

export function winnerSide(match: ProtoMatch): Side | null {
  const { status, homeScore, awayScore, homePenalties, awayPenalties } = match;
  if (status !== 'finished' || homeScore === null || awayScore === null) return null;
  if (homeScore !== awayScore) return homeScore > awayScore ? 'home' : 'away';
  if (homePenalties === null || awayPenalties === null) return null;
  return homePenalties > awayPenalties ? 'home' : 'away';
}

function advance(match: ProtoMatch, byId: Map<number, ProtoMatch>) {
  const winner = winnerSide(match);
  if (!winner || !match.advancesToSlot) return;
  const winnerTeam = winner === 'home' ? match.homeTeam : match.awayTeam;
  const loserTeam = winner === 'home' ? match.awayTeam : match.homeTeam;
  const key = match.advancesToSlot === 'home' ? 'homeTeam' : 'awayTeam';
  const next = match.winnerToMatchId ? byId.get(match.winnerToMatchId) : undefined;
  if (next) next[key] = winnerTeam;
  const third = match.loserToMatchId ? byId.get(match.loserToMatchId) : undefined;
  if (third) third[key] = loserTeam;
}

// --- Pomocnicze dla widoków -------------------------------------------------

/** Drużyny, które jeszcze nie odpadły. */
export function teamsAlive(bracket: ProtoBracket): number {
  const out = new Set<number>();
  for (const match of bracket.matches) {
    if (match.third) continue;
    const winner = winnerSide(match);
    if (!winner) continue;
    const loser = winner === 'home' ? match.awayTeam : match.homeTeam;
    if (loser) out.add(loser.id);
  }
  return bracket.teams.length - out.size;
}

/** Mecze drużyny w kolejności rund. */
export function teamPath(bracket: ProtoBracket, teamId: number): ProtoMatch[] {
  return bracket.matches
    .filter((m) => m.homeTeam?.id === teamId || m.awayTeam?.id === teamId)
    .toSorted((a, b) => a.round.order - b.round.order || Number(a.third) - Number(b.third));
}

export function findMatch(bracket: ProtoBracket, id: number): ProtoMatch | undefined {
  return bracket.matches.find((m) => m.id === id);
}

const WEEKDAY = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', timeZone: 'Europe/Warsaw' });
const DAY = new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Warsaw' });
const TIME = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });

export function kickoffParts(iso: string): { weekday: string; day: string; time: string } {
  const date = new Date(iso);
  return { weekday: WEEKDAY.format(date), day: DAY.format(date), time: TIME.format(date) };
}

/** „sob. 17.10 – niedz. 18.10” albo jeden dzień. */
export function roundDates(round: ProtoRound): string {
  const all = [...round.matches, ...(round.third ? [round.third] : [])].map((m) => m.kickoffAt).toSorted();
  const first = kickoffParts(all[0]);
  const last = kickoffParts(all[all.length - 1]);
  return first.day === last.day ? `${first.weekday} ${first.day}` : `${first.weekday} ${first.day} – ${last.weekday} ${last.day}`;
}
