// PROTOTYP (#217) — drabinka w pamięci i zaślepka API. Nie do main.
//
// Mock kontraktu (Prism) nie ma `POST /stages/{stage}/bracket` ani awansu po
// `PATCH /matches/{match}`, więc cała faza pucharowa żyje tutaj. Reguły
// odwzorowują rozstrzygnięcia: #215 (generator: rozstawienie, wolne losy,
// numery meczów, nazwy rund, mecz o 3. miejsce) i #216 (karne, awans,
// podmiana slotu, blokada przy rozpoczętym meczu zależnym). Turniej
// w nagłówku jest prawdziwy, z mocka.
import { useSyncExternalStore } from 'react';

export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type Slot = 'home' | 'away';
export type Sport = 'football' | 'basketball';
export type Team = { id: number; name: string };
export type Venue = { id: number; name: string };
export type Round = { id: number; name: string; order: number };
export type BMatch = {
  id: number;
  stageId: number;
  round: Round;
  matchNumber: number;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
  status: MatchStatus;
  kickoffAt: string | null;
  venue: Venue | null;
  winnerToMatchId: number | null;
  loserToMatchId: number | null;
  advancesToSlot: Slot | null;
};
export type MatchUpdate = Partial<
  Pick<BMatch, 'status' | 'homeScore' | 'awayScore' | 'homePenalties' | 'awayPenalties' | 'kickoffAt'>
> & { venueId?: number | null };
export type ApiErr = { status: number; message: string; errors?: Record<string, string[]> };

export const SCENARIOS = [
  { key: 'empty', name: 'Bez drabinki' },
  { key: 'fresh', name: 'Świeżo wygenerowana, bez dat' },
  { key: 'mid', name: 'W trakcie: 1. runda rozegrana, mecz trwa' },
  { key: 'blocked', name: 'Półfinały rozegrane, finał trwa' },
  { key: 'done', name: 'Rozegrana, jest mistrz' },
  { key: 'added', name: 'Drużyna dodana po generowaniu' },
  { key: 'too-few', name: 'Jedna drużyna' },
] as const;
export type ScenarioKey = (typeof SCENARIOS)[number]['key'];

export const TEAM_COUNTS = [2, 3, 4, 5, 6, 7, 8, 12, 16, 17, 24, 32, 33] as const;

const TEAM_NAMES = [
  'Wilki Bemowo', 'Sokoły Ursus', 'Orły Wola', 'Lwy Mokotów', 'Rysie Bielany',
  'Żubry Praga', 'Jastrzębie Ochota', 'Dziki Targówek', 'Borsuki Wawer', 'Kruki Żoliborz',
  'Niedźwiedzie Białołęka', 'Łosie Ursynów', 'Bobry Wilanów', 'Foki Śródmieście', 'Lisy Włochy',
  'Rekiny Rembertów', 'Sowy Wesoła', 'Żurawie Bródno', 'Gepardy Gocław', 'Pumy Saska Kępa',
  'Byki Grochów', 'Czaple Tarchomin', 'Dzięcioły Kabaty', 'Gryfy Natolin', 'Huragan Służew',
  'Iskra Stegny', 'Jaguary Sadyba', 'Kormorany Marymont', 'Lamparty Chomiczówka', 'Mewy Gocławek',
  'Nietoperze Szmulki', 'Osy Powiśle', 'Pelikany Wawrzyszew',
];
const VENUES: Venue[] = [
  { id: 1, name: 'Boisko Bemowo' },
  { id: 2, name: 'Hala Ursus' },
];
const STAGE_ID = 77;

type State = {
  scenario: ScenarioKey;
  sport: Sport;
  teamCount: number;
  teams: Team[];
  matches: BMatch[];
  /** Kolejność z ostatniego generowania. Backend jej NIE przechowuje — tylko pamięć karty. */
  lastSeeding: number[] | null;
  latencyMs: number;
  failNext: 'none' | '500';
  log: string[];
};

let nextId = 5000;
// `build` czyta `state` (opóźnienie), więc deklaracja idzie przed wywołaniem.
let state = undefined as unknown as State;
state = build('mid', 6, 'football');
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function log(line: string) {
  const time = new Date().toLocaleTimeString('pl-PL');
  set({ log: [`${time} ${line}`, ...state.log].slice(0, 40) });
}

export function useBracket(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// ——— Generator (#215) ———

/** Pozycje seedów w pełnej drabince N: 1–N, N/2–N/2+1… (seedy 1…2^k nie spotkają się wcześniej). */
export function seedPositions(size: number): number[] {
  let seeds = [1];
  while (seeds.length < size) {
    const m = seeds.length * 2;
    seeds = seeds.flatMap((s) => [s, m + 1 - s]);
  }
  return seeds;
}

export function bracketSize(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return Math.max(size, 2);
}

/** Nazwa rundy według liczby drużyn, która w niej gra (w pełnej drabince). */
export function roundName(teamsInRound: number): string {
  if (teamsInRound === 2) return 'Finał';
  if (teamsInRound === 4) return 'Półfinał';
  if (teamsInRound === 8) return 'Ćwierćfinał';
  return `1/${teamsInRound / 2} finału`;
}

function generateMatches(teams: Team[], thirdPlace: boolean): BMatch[] {
  const n = teams.length;
  const size = bracketSize(n);
  const roundsCount = Math.log2(size);
  const positions = seedPositions(size);
  const rounds: Round[] = Array.from({ length: roundsCount }, (_, i) => ({
    id: nextId++,
    order: i + 1,
    name: roundName(size / 2 ** i),
  }));

  const blank = (round: Round, matchNumber: number): BMatch => ({
    id: nextId++,
    stageId: STAGE_ID,
    round,
    matchNumber,
    homeTeam: null,
    awayTeam: null,
    homeScore: null,
    awayScore: null,
    homePenalties: null,
    awayPenalties: null,
    status: 'scheduled',
    kickoffAt: null,
    venue: null,
    winnerToMatchId: null,
    loserToMatchId: null,
    advancesToSlot: null,
  });

  // Siatka wszystkich pozycji; w 1. rundzie wolny los zostawia dziurę (null).
  const grid: (BMatch | null)[][] = rounds.map((round, r) =>
    Array.from({ length: size / 2 ** (r + 1) }, (_, i) => blank(round, i + 1)),
  );
  for (let m = 1; m <= size / 2; m++) {
    const a = positions[2 * m - 2];
    const b = positions[2 * m - 1];
    const match = grid[0][m - 1]!;
    if (b > n) {
      // Wolny los: drużyna stoi od razu w meczu 2. rundy, bez krawędzi.
      grid[0][m - 1] = null;
      const target = grid[1][Math.ceil(m / 2) - 1]!;
      if (m % 2 === 1) target.homeTeam = teams[a - 1];
      else target.awayTeam = teams[a - 1];
    } else {
      match.homeTeam = teams[a - 1];
      match.awayTeam = teams[b - 1];
    }
  }
  for (let r = 0; r < roundsCount - 1; r++) {
    grid[r].forEach((match, i) => {
      if (!match) return;
      match.winnerToMatchId = grid[r + 1][Math.floor(i / 2)]!.id;
      match.advancesToSlot = (i + 1) % 2 === 1 ? 'home' : 'away';
    });
  }
  const all = grid.flat().filter((m): m is BMatch => m !== null);
  if (thirdPlace) {
    const final = rounds[roundsCount - 1];
    const bronze = blank(final, 2);
    grid[roundsCount - 2].forEach((semi) => {
      if (semi) semi.loserToMatchId = bronze.id;
    });
    all.push(bronze);
  }
  return all;
}

// ——— Wynik, karne i awans (#216) ———

export function winnerSide(m: Pick<BMatch, 'status' | 'homeScore' | 'awayScore' | 'homePenalties' | 'awayPenalties'>): Slot | null {
  if (m.status !== 'finished' || m.homeScore === null || m.awayScore === null) return null;
  if (m.homeScore !== m.awayScore) return m.homeScore > m.awayScore ? 'home' : 'away';
  if (m.homePenalties === null || m.awayPenalties === null || m.homePenalties === m.awayPenalties) return null;
  return m.homePenalties > m.awayPenalties ? 'home' : 'away';
}

function teamOf(m: BMatch, side: Slot | null): Team | null {
  if (side === null) return null;
  return side === 'home' ? m.homeTeam : m.awayTeam;
}
const other = (side: Slot | null): Slot | null => (side === null ? null : side === 'home' ? 'away' : 'home');

export function isThirdPlace(m: BMatch, matches: BMatch[]): boolean {
  return matches.some((x) => x.loserToMatchId === m.id);
}

/** Etykieta pozycji meczu (nie jest przechowywana): „Półfinał 1”, „Finał”, „Mecz o 3. miejsce”. */
export function matchLabel(m: BMatch, matches: BMatch[]): string {
  if (isThirdPlace(m, matches)) return 'Mecz o 3. miejsce';
  // Numer to pozycja w pełnej drabince, więc w 1. rundzie z wolnymi losami ma dziury.
  return m.round.name === 'Finał' ? 'Finał' : `${m.round.name} ${m.matchNumber}`;
}

/** „do finału” / „w finale” — odmiana nazw rund do notki przed zapisem. */
export function roundCase(label: string, form: 'gen' | 'loc'): string {
  if (label === 'Mecz o 3. miejsce') return form === 'gen' ? 'do meczu o 3. miejsce' : 'w meczu o 3. miejsce';
  if (label.startsWith('1/')) return `${form === 'gen' ? 'do' : 'w'} ${label}`;
  const [word, num] = label.split(' ');
  const base = word.toLowerCase();
  const tail = num ? ` ${num}` : '';
  return form === 'gen' ? `do ${base}u${tail}` : `w ${base.replace(/ł$/, 'le')}${tail}`;
}

/** Mecze zależne: wskazane przez `winnerToMatchId` i `loserToMatchId`. */
function dependents(m: BMatch, matches: BMatch[]): { match: BMatch; role: 'winner' | 'loser' }[] {
  const out: { match: BMatch; role: 'winner' | 'loser' }[] = [];
  const w = matches.find((x) => x.id === m.winnerToMatchId);
  const l = matches.find((x) => x.id === m.loserToMatchId);
  if (w) out.push({ match: w, role: 'winner' });
  if (l) out.push({ match: l, role: 'loser' });
  return out;
}

const pair = (m: BMatch) => `${m.homeTeam?.name ?? '?'} – ${m.awayTeam?.name ?? '?'}`;

export type AdvanceNote = { tone: 'info' | 'block'; text: string };

/**
 * Notka przed zapisem (#216): front liczy ją sam z krawędzi, bo ma komplet
 * meczów fazy. Pusta, gdy zapis nie rusza żadnego slotu.
 */
export function advanceNotes(original: BMatch, draft: BMatch, matches: BMatch[]): AdvanceNote[] {
  const oldW = winnerSide(original);
  const newW = winnerSide(draft);
  const changes: { dep: BMatch; from: Team | null; to: Team | null }[] = [];
  for (const { match: dep, role } of dependents(original, matches)) {
    const from = teamOf(original, role === 'winner' ? oldW : other(oldW));
    const to = teamOf(draft, role === 'winner' ? newW : other(newW));
    if (from?.id !== to?.id) changes.push({ dep, from, to });
  }
  if (changes.length === 0) return [];
  const started = changes.filter((c) => c.dep.status !== 'scheduled');
  if (started.length > 0) {
    return [
      {
        tone: 'block',
        text: `Zwycięzca zagrał już dalej: ${started.map((c) => `${matchLabel(c.dep, matches)} (${pair(c.dep)})`).join(', ')}. Cofnij te mecze do zaplanowanych, zanim zmienisz zwycięzcę.`,
      },
    ];
  }
  return changes.map(({ dep, from, to }) => {
    const label = matchLabel(dep, matches);
    if (from && to) return { tone: 'info', text: `${capital(roundCase(label, 'loc'))} ${to.name} zastąpią ${from.name}.` };
    if (to) return { tone: 'info', text: `${to.name} ${label === 'Mecz o 3. miejsce' ? 'zagrają' : 'awansują'} ${roundCase(label, 'gen')}.` };
    return { tone: 'info', text: `${from!.name} znikną ${roundCase(label, 'gen').replace(/^do /, 'z ')}.` };
  });
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Pola karnych: tylko `knockout` (tu zawsze), sport z remisem, remis i „Zakończony”. */
export function showsPenalties(sport: Sport, d: Pick<BMatch, 'status' | 'homeScore' | 'awayScore'>): boolean {
  return sport === 'football' && d.status === 'finished' && d.homeScore !== null && d.homeScore === d.awayScore;
}

function fail(key: string, message: string): ApiErr {
  return { status: 422, message, errors: { [key]: [message] } };
}

function validate(old: BMatch, merged: BMatch, body: MatchUpdate, matches: BMatch[], sport: Sport): ApiErr | null {
  if (merged.status !== 'scheduled' && (!merged.homeTeam || !merged.awayTeam)) {
    return fail('status', 'Mecz czeka na rywali z poprzedniej rundy.');
  }
  const scored = merged.homeScore !== null && merged.awayScore !== null;
  if (merged.status === 'scheduled' && (merged.homeScore !== null || merged.awayScore !== null)) {
    return fail('homeScore', 'Mecz zaplanowany nie ma wyniku. Wyczyść oba pola.');
  }
  if (merged.status !== 'scheduled' && !scored) return fail('homeScore', 'Wpisz wynik obu drużyn.');
  if (sport === 'basketball' && merged.status === 'finished' && merged.homeScore === merged.awayScore) {
    return fail('homeScore', 'W tym sporcie mecz nie może zakończyć się remisem.');
  }
  const hp = merged.homePenalties;
  const ap = merged.awayPenalties;
  const need = merged.status === 'finished' && scored && merged.homeScore === merged.awayScore;
  if (need) {
    if (hp === null && ap === null) return fail('homePenalties', 'Remis w meczu pucharowym rozstrzygają karne. Wpisz je.');
    if (hp === null || ap === null) return fail('homePenalties', 'Wpisz karne obu drużyn.');
    if (hp === ap) return fail('homePenalties', 'Karne muszą wyłonić zwycięzcę.');
  } else if (hp !== null || ap !== null) {
    return fail('homePenalties', 'Karne należą tylko do remisu w meczu zakończonym. Wyczyść oba pola: homePenalties i awayPenalties.');
  }
  const blocked = advanceNotes(old, merged, matches).find((n) => n.tone === 'block');
  if (blocked) {
    const onlyStatus = Object.keys(body).every((k) => k === 'status');
    return fail(onlyStatus ? 'status' : 'homeScore', blocked.text);
  }
  return null;
}

// ——— Zaślepka API ———

function delay() {
  return new Promise((r) => setTimeout(r, state.latencyMs));
}

function serverError(): ApiErr | null {
  if (state.failNext !== '500') return null;
  set({ failNext: 'none' });
  return { status: 500, message: 'Błąd serwera.' };
}

export const api = {
  async generate(teamIds: number[], thirdPlaceMatch: boolean): Promise<{ roundsCount: number; matchesCount: number }> {
    log(`POST /stages/${STAGE_ID}/bracket teamIds=[${teamIds.join(',')}] thirdPlace=${thirdPlaceMatch}`);
    await delay();
    const e = serverError();
    if (e) throw e;
    if (state.matches.some((m) => m.status !== 'scheduled')) {
      const err = fail('stage', 'Faza ma rozegrane mecze, więc nie można wygenerować drabinki ponownie.');
      log(`← 422 ${err.message}`);
      throw err;
    }
    if (state.teams.length < 2) throw fail('teams', 'Puchar potrzebuje co najmniej dwóch drużyn.');
    const ids = new Set(state.teams.map((t) => t.id));
    if (teamIds.length !== ids.size || new Set(teamIds).size !== teamIds.length || teamIds.some((id) => !ids.has(id))) {
      throw fail('teamIds', 'Lista musi zawierać każdą drużynę turnieju dokładnie raz.');
    }
    if (thirdPlaceMatch && teamIds.length < 4) throw fail('thirdPlaceMatch', 'Mecz o 3. miejsce wymaga co najmniej czterech drużyn.');
    const seeded = teamIds.map((id) => state.teams.find((t) => t.id === id)!);
    const matches = generateMatches(seeded, thirdPlaceMatch);
    const roundsCount = new Set(matches.map((m) => m.round.id)).size;
    set({ matches, lastSeeding: teamIds });
    log(`← 201 rund ${roundsCount}, meczów ${matches.length}`);
    return { roundsCount, matchesCount: matches.length };
  },

  async patchMatch(id: number, body: MatchUpdate): Promise<BMatch> {
    log(`PATCH /matches/${id} ${JSON.stringify(body)}`);
    await delay();
    const e = serverError();
    if (e) throw e;
    const old = state.matches.find((m) => m.id === id)!;
    const { venueId, ...rest } = body;
    const merged: BMatch = {
      ...old,
      ...rest,
      ...(venueId !== undefined ? { venue: VENUES.find((v) => v.id === venueId) ?? null } : {}),
    };
    const err = validate(old, merged, body, state.matches, state.sport);
    if (err) {
      log(`← 422 ${Object.keys(err.errors ?? {})[0]}: ${err.message}`);
      throw err;
    }
    // Awans w tej samej transakcji: podmiana albo wyzerowanie slotu w obu meczach zależnych.
    const newW = winnerSide(merged);
    let matches = state.matches.map((m) => (m.id === id ? merged : m));
    for (const { match: dep, role } of dependents(old, state.matches)) {
      const team = teamOf(merged, role === 'winner' ? newW : other(newW));
      const slot = old.advancesToSlot!;
      matches = matches.map((m) => (m.id === dep.id ? { ...m, [slot === 'home' ? 'homeTeam' : 'awayTeam']: team } : m));
    }
    set({ matches });
    log('← 200');
    return merged;
  },

  /** Rozkład dat — tu tylko atrapa: runda co tydzień, mecz o 3. miejsce przed finałem. */
  async distributeDates(): Promise<number> {
    log(`POST /stages/${STAGE_ID}/schedule/dates (atrapa)`);
    await delay();
    const start = new Date();
    start.setDate(start.getDate() + ((6 - start.getDay() + 7) % 7 || 7));
    start.setHours(10, 0, 0, 0);
    const matches = state.matches.map((m) => {
      if (m.status !== 'scheduled') return m;
      const day = new Date(start);
      day.setDate(day.getDate() + 7 * (m.round.order - 1));
      const ordered = state.matches
        .filter((x) => x.round.id === m.round.id)
        .sort((a, b) => (isThirdPlace(b, state.matches) ? 1 : 0) - (isThirdPlace(a, state.matches) ? 1 : 0) || a.matchNumber - b.matchNumber);
      const slot = ordered.findIndex((x) => x.id === m.id);
      day.setMinutes(Math.floor(slot / VENUES.length) * 90);
      return { ...m, kickoffAt: day.toISOString(), venue: VENUES[slot % VENUES.length] };
    });
    set({ matches });
    return matches.length;
  },
};

// ——— Scenariusze ———

function teamsFor(n: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({ id: 101 + i, name: TEAM_NAMES[i] ?? `Drużyna ${i + 1}` }));
}

/** Symulacja „wyżej rozstawiony wygrywa”, czasem po karnych. */
function play(matches: BMatch[], match: BMatch, sport: Sport, seedOf: (t: Team) => number, status: MatchStatus = 'finished'): BMatch[] {
  const homeWins = seedOf(match.homeTeam!) < seedOf(match.awayTeam!);
  const draw = sport === 'football' && match.id % 3 === 0;
  const base = sport === 'basketball' ? 70 + (match.id % 15) : (match.id % 3) + 1;
  const lo = sport === 'basketball' ? base - 4 - (match.id % 9) : base - 1;
  let updated: BMatch = {
    ...match,
    status,
    homeScore: draw ? base : homeWins ? base : lo,
    awayScore: draw ? base : homeWins ? lo : base,
    homePenalties: draw && status === 'finished' ? (homeWins ? 5 : 4) : null,
    awayPenalties: draw && status === 'finished' ? (homeWins ? 4 : 5) : null,
  };
  if (status === 'live') updated = { ...updated, homePenalties: null, awayPenalties: null };
  let next = matches.map((m) => (m.id === match.id ? updated : m));
  const w = winnerSide(updated);
  if (w) {
    for (const { match: dep, role } of dependents(updated, next)) {
      const team = teamOf(updated, role === 'winner' ? w : other(w));
      next = next.map((m) => (m.id === dep.id ? { ...m, [updated.advancesToSlot === 'home' ? 'homeTeam' : 'awayTeam']: team } : m));
    }
  }
  return next;
}

function playRound(matches: BMatch[], order: number, sport: Sport, seedOf: (t: Team) => number): BMatch[] {
  let next = matches;
  for (const m of matches.filter((x) => x.round.order === order)) {
    const fresh = next.find((x) => x.id === m.id)!;
    if (fresh.homeTeam && fresh.awayTeam) next = play(next, fresh, sport, seedOf);
  }
  return next;
}

function build(scenario: ScenarioKey, teamCount: number, sport: Sport): State {
  const n = scenario === 'too-few' ? 1 : teamCount;
  const teams = teamsFor(n);
  const seedOf = (t: Team) => teams.findIndex((x) => x.id === t.id) + 1;
  const base: State = {
    scenario,
    sport,
    teamCount,
    teams,
    matches: [],
    lastSeeding: null,
    latencyMs: state?.latencyMs ?? 300,
    failNext: 'none',
    log: [],
  };
  if (scenario === 'empty' || scenario === 'too-few') return base;

  let matches = generateMatches(teams, sport === 'football' && n >= 4);
  const rounds = Math.max(...matches.map((m) => m.round.order));
  const lastSeeding = teams.map((t) => t.id);
  if (scenario === 'fresh') return { ...base, matches, lastSeeding };
  if (scenario === 'added') {
    return { ...base, matches, lastSeeding, teams: [...teams, { id: 999, name: 'Kosy Zacisze' }] };
  }

  // Scenariusze rozegrane mają już rozłożone daty.
  matches = datesFor(matches);

  if (scenario === 'mid') {
    matches = playRound(matches, 1, sport, seedOf);
    const next = matches.find((m) => m.round.order === Math.min(2, rounds) && m.homeTeam && m.awayTeam && m.status === 'scheduled');
    if (next && rounds > 1) matches = play(matches, next, sport, seedOf, 'live');
  } else if (scenario === 'blocked') {
    for (let r = 1; r < rounds; r++) matches = playRound(matches, r, sport, seedOf);
    const final = matches.find((m) => m.round.order === rounds && !isThirdPlace(m, matches))!;
    matches = play(matches, final, sport, seedOf, 'live');
  } else if (scenario === 'done') {
    for (let r = 1; r <= rounds; r++) matches = playRound(matches, r, sport, seedOf);
  }
  return { ...base, matches, lastSeeding };
}

function datesFor(matches: BMatch[]): BMatch[] {
  const start = new Date('2026-10-03T10:00:00+02:00');
  return matches.map((m) => {
    const ordered = matches
      .filter((x) => x.round.id === m.round.id)
      .sort((a, b) => (isThirdPlace(b, matches) ? 1 : 0) - (isThirdPlace(a, matches) ? 1 : 0) || a.matchNumber - b.matchNumber);
    const slot = ordered.findIndex((x) => x.id === m.id);
    const day = new Date(start);
    day.setDate(day.getDate() + 7 * (m.round.order - 1));
    day.setMinutes(day.getMinutes() + Math.floor(slot / VENUES.length) * 90);
    return { ...m, kickoffAt: day.toISOString(), venue: VENUES[slot % VENUES.length] };
  });
}

export const sim = {
  scenario(scenario: ScenarioKey) {
    state = build(scenario, state.teamCount, state.sport);
    listeners.forEach((l) => l());
  },
  teamCount(n: number) {
    state = build(state.scenario, n, state.sport);
    listeners.forEach((l) => l());
  },
  sport(sport: Sport) {
    state = build(state.scenario, state.teamCount, sport);
    listeners.forEach((l) => l());
  },
  addTeam() {
    const id = Math.max(...state.teams.map((t) => t.id), 100) + 1;
    set({ teams: [...state.teams, { id, name: TEAM_NAMES[id - 101] ?? `Drużyna ${id - 100}` }] });
    log(`POST /teams → ${id} (po generowaniu nie wchodzi do drabinki)`);
  },
  latency(ms: number) {
    set({ latencyMs: ms });
  },
  failNext(mode: State['failNext']) {
    set({ failNext: mode });
  },
  reset() {
    state = build(state.scenario, state.teamCount, state.sport);
    listeners.forEach((l) => l());
  },
};

export const VENUE_LIST = VENUES;

/** Drużyny turnieju, których nie ma w drabince (dodane po generowaniu). */
export function teamsOutsideBracket(s: State): Team[] {
  if (s.matches.length === 0) return [];
  const inside = new Set(s.matches.flatMap((m) => [m.homeTeam?.id, m.awayTeam?.id]));
  // Drużyna, która odpadła, też jest „w drabince”: pamiętamy wejściowy skład z ostatniego generowania.
  const seeded = new Set(s.lastSeeding ?? []);
  return s.teams.filter((t) => !inside.has(t.id) && !seeded.has(t.id));
}

export function hasStarted(matches: BMatch[]): boolean {
  return matches.some((m) => m.status !== 'scheduled');
}

/** Wolny los w slocie: drużyna stoi w meczu bez krawędzi prowadzącej do tej strony. */
export function byeSlots(m: BMatch, matches: BMatch[]): Slot[] {
  if (m.round.order !== 2) return [];
  const fed = matches.filter((x) => x.winnerToMatchId === m.id).map((x) => x.advancesToSlot);
  return (['home', 'away'] as Slot[]).filter((s) => !fed.includes(s));
}

export function champion(matches: BMatch[]): Team | null {
  const rounds = Math.max(0, ...matches.map((m) => m.round.order));
  const final = matches.find((m) => m.round.order === rounds && !isThirdPlace(m, matches));
  return final ? teamOf(final, winnerSide(final)) : null;
}
