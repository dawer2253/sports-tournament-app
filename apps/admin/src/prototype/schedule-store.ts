// PROTOTYP (#162) — terminarz w pamięci i zaślepka API. Nie do main.
//
// Mock kontraktu (Prism) nie ma ani generowania, ani PATCH-a meczu, ani nie
// pamięta zapisów, więc cały terminarz żyje tutaj. Reguły odwzorowują
// rozstrzygnięcia: #157 (generator), #158 (daty, kolizje), #159 (wynik i stan),
// #161 (drużyny a terminarz). Turniej w nagłówku jest prawdziwy, z mocka.
import { useSyncExternalStore } from 'react';

export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type Team = { id: number; name: string };
export type Venue = { id: number; name: string };
export type Round = { id: number; name: string; order: number };
export type Collision = { type: 'team' | 'venue'; matchId: number };
export type AdminMatch = {
  id: number;
  stageId: number;
  round: Round;
  matchNumber: number;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  kickoffAt: string | null;
  venue: Venue | null;
  collisions: Collision[];
};
type StoredMatch = Omit<AdminMatch, 'collisions'>;
export type ApiErr = { status: number; message: string; errors?: Record<string, string[]> };

export const SCENARIOS = [
  { key: 'empty', name: 'Pusty — 10 drużyn, bez terminarza' },
  { key: 'too-few', name: 'Za mało drużyn (1)' },
  { key: 'no-dates', name: 'Wygenerowany, bez dat' },
  { key: 'season', name: 'W trakcie sezonu (kolizje, wyniki)' },
  { key: 'big', name: 'Duża liga: 20 drużyn × 2 = 380 meczów' },
  { key: 'team-changes', name: 'Drużyna dodana po generowaniu + usunięta' },
  { key: 'empty-round', name: '3 drużyny, jedna usunięta (puste kolejki)' },
  { key: 'cup', name: 'Puchar — brak fazy league' },
] as const;
export type ScenarioKey = (typeof SCENARIOS)[number]['key'];

const TEAM_NAMES = [
  'Wilki Bemowo', 'Sokoły Ursus', 'Orły Wola', 'Lwy Mokotów', 'Rysie Bielany',
  'Żubry Praga', 'Jastrzębie Ochota', 'Dziki Targówek', 'Borsuki Wawer', 'Kruki Żoliborz',
  'Niedźwiedzie Białołęka', 'Łosie Ursynów', 'Bobry Wilanów', 'Foki Śródmieście', 'Lisy Włochy',
  'Rekiny Rembertów', 'Sowy Wesoła', 'Żurawie Bródno', 'Gepardy Gocław', 'Pumy Saska Kępa',
];
const VENUES: Venue[] = [
  { id: 1, name: 'Boisko Bemowo' },
  { id: 2, name: 'Hala Ursus' },
  { id: 3, name: 'Orlik Wola' },
];

type State = {
  scenario: ScenarioKey;
  stage: { id: number; type: 'league' | 'knockout'; name: string };
  teams: Team[];
  venues: Venue[];
  matchDuration: number;
  allowsDraw: boolean;
  matches: StoredMatch[];
  rounds: Round[];
  latencyMs: number;
  failNext: boolean;
  log: string[];
};

let nextId = 1000;
// `build` czyta `state` (stageId w `berger`), więc deklaracja idzie przed wywołaniem.
let state = undefined as unknown as State;
state = build('season');
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function log(line: string) {
  const time = new Date().toLocaleTimeString('pl-PL');
  set({ log: [`${time} ${line}`, ...state.log].slice(0, 10) });
}

export function useScheduleState() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}

// ——— Odczyty, które dostanie panel ———

/** `GET /tournaments/{t}/matches?stageId=` z `AdminMatch.collisions` liczonym przy odczycie. */
export function matchesWithCollisions(s: State): AdminMatch[] {
  const windows = s.matches
    .filter((m) => m.kickoffAt)
    .map((m) => ({ m, start: Date.parse(m.kickoffAt!), end: Date.parse(m.kickoffAt!) + s.matchDuration * 60_000 }))
    .sort((a, b) => a.start - b.start);
  const found = new Map<number, Collision[]>();
  const add = (a: number, c: Collision) => found.set(a, [...(found.get(a) ?? []), c]);
  for (let i = 0; i < windows.length; i++) {
    for (let j = i + 1; j < windows.length && windows[j].start < windows[i].end; j++) {
      const a = windows[i].m;
      const b = windows[j].m;
      const teams = new Set([a.homeTeam.id, a.awayTeam.id]);
      if (teams.has(b.homeTeam.id) || teams.has(b.awayTeam.id)) {
        add(a.id, { type: 'team', matchId: b.id });
        add(b.id, { type: 'team', matchId: a.id });
      }
      if (a.venue && b.venue && a.venue.id === b.venue.id) {
        add(a.id, { type: 'venue', matchId: b.id });
        add(b.id, { type: 'venue', matchId: a.id });
      }
    }
  }
  return s.matches
    .map((m) => ({ ...m, collisions: found.get(m.id) ?? [] }))
    .sort((a, b) => a.round.order - b.round.order || a.matchNumber - b.matchNumber);
}

/** Drużyny fazy bez żadnego meczu (#161): panel liczy to sam, bez pola w API. */
export function teamsWithoutMatches(s: State): Team[] {
  if (s.rounds.length === 0) return [];
  const playing = new Set(s.matches.flatMap((m) => [m.homeTeam.id, m.awayTeam.id]));
  return s.teams.filter((t) => !playing.has(t.id));
}

export function hasPlayed(s: State) {
  return s.matches.some((m) => m.status !== 'scheduled');
}

// ——— Zapisy (zaślepki API) ———

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T>(label: string, run: () => T): Promise<T> {
  await sleep(state.latencyMs);
  if (state.failNext) {
    set({ failNext: false });
    log(`${label} → 500`);
    throw { status: 500, message: 'Serwer nie odpowiada. Spróbuj ponownie.' } satisfies ApiErr;
  }
  try {
    const result = run();
    log(`${label} → 2xx`);
    return result;
  } catch (e) {
    const err = e as ApiErr;
    log(`${label} → ${err.status} ${Object.keys(err.errors ?? {}).join(',')}`);
    throw err;
  }
}
const invalid = (field: string, message: string): ApiErr => ({
  status: 422,
  message,
  errors: { [field]: [message] },
});

/** `POST /stages/{stage}/schedule` (#157). */
export function generate(meetings: 1 | 2) {
  return request(`POST /stages/${state.stage.id}/schedule {meetings:${meetings}}`, () => {
    if (state.stage.type !== 'league')
      throw invalid('stage', 'Generowanie terminarza działa na razie tylko dla fazy ligowej.');
    if (state.teams.length < 2) throw invalid('teams', 'Liga potrzebuje co najmniej dwóch drużyn.');
    if (hasPlayed(state))
      throw invalid('stage', 'Faza ma rozegrane mecze, więc nie można wygenerować terminarza ponownie.');
    const { rounds, matches } = berger(shuffle(state.teams), meetings);
    set({ rounds, matches });
    return { roundsCount: rounds.length, matchesCount: matches.length };
  });
}

export type DatesBody = {
  mode: 'interval' | 'continuous';
  startAt: string; // datetime-local; w prototypie strefa = strefa przeglądarki
  intervalDays: number | null;
  dayEndTime: string | null;
  venueIds: number[];
  fromRound: number | null;
};

/** `PATCH /tournaments/{t}` z `matchDuration` (#158) — formularz rozkładu woła go przed rozkładem. */
export function patchMatchDuration(minutes: number) {
  return request(`PATCH /tournaments/1 {matchDuration:${minutes}}`, () => {
    if (minutes < 10 || minutes > 600) throw invalid('matchDuration', 'Długość meczu musi mieścić się w 10–600 minut.');
    set({ matchDuration: minutes });
  });
}

/** `POST /stages/{stage}/schedule/dates` (#158). */
export function distributeDates(body: DatesBody) {
  return request(`POST /stages/${state.stage.id}/schedule/dates {mode:${body.mode}}`, () => {
    if (state.rounds.length === 0) throw invalid('stage', 'Faza nie ma terminarza.');
    if (!body.startAt) throw invalid('startAt', 'Podaj datę i godzinę startu.');
    if (body.mode === 'interval' && !(body.intervalDays && body.intervalDays >= 1))
      throw invalid('intervalDays', 'Podaj odstęp w dniach.');
    const matches = distribute(state, body);
    set({ matches });
    const touched = matches.filter((m) => m.status === 'scheduled' && m.round.order >= (body.fromRound ?? 1)).length;
    return { matchesCount: touched, collisionsCount: matchesWithCollisions({ ...state, matches }).filter((m) => m.collisions.length).length };
  });
}

export type MatchPatch = Partial<{
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  kickoffAt: string | null;
  venueId: number | null;
}>;

/** `PATCH /matches/{match}` (#158 + #159): walidacja po scaleniu z bazą. */
export function patchMatch(id: number, body: MatchPatch) {
  return request(`PATCH /matches/${id} ${JSON.stringify(body)}`, () => {
    const current = state.matches.find((m) => m.id === id);
    if (!current) throw { status: 404, message: 'Nie ma takiego meczu.' } satisfies ApiErr;
    const merged: StoredMatch = {
      ...current,
      ...('homeScore' in body ? { homeScore: body.homeScore ?? null } : {}),
      ...('awayScore' in body ? { awayScore: body.awayScore ?? null } : {}),
      ...(body.status ? { status: body.status } : {}),
      ...('kickoffAt' in body ? { kickoffAt: body.kickoffAt ?? null } : {}),
      ...('venueId' in body ? { venue: VENUES.find((v) => v.id === body.venueId) ?? null } : {}),
    };
    const { homeScore: h, awayScore: a, status } = merged;
    for (const v of [h, a]) {
      if (v !== null && (!Number.isInteger(v) || v < 0 || v > 999))
        throw invalid('homeScore', 'Wynik to liczba całkowita od 0 do 999.');
    }
    if ((h === null) !== (a === null)) throw invalid('homeScore', 'Podaj wynik obu drużyn albo żadnej.');
    if (status === 'scheduled' && h !== null)
      throw invalid('homeScore', 'Mecz zaplanowany nie ma wyniku. Wyczyść wynik albo zmień stan.');
    if (status !== 'scheduled' && h === null)
      throw invalid('homeScore', 'Mecz trwający albo zakończony musi mieć wynik.');
    if (status === 'finished' && !state.allowsDraw && h === a)
      throw invalid('homeScore', 'W tym sporcie mecz nie może zakończyć się remisem.');
    set({ matches: state.matches.map((m) => (m.id === id ? merged : m)) });
    return matchesWithCollisions(state).find((m) => m.id === id)!;
  });
}

// ——— Panel stanu ———

export const sim = {
  scenario(key: ScenarioKey) {
    state = { ...build(key), latencyMs: state.latencyMs, allowsDraw: state.allowsDraw, log: state.log };
    listeners.forEach((l) => l());
    log(`— scenariusz: ${key}`);
  },
  toggleFail() {
    set({ failNext: !state.failNext });
  },
  toggleDraw() {
    set({ allowsDraw: !state.allowsDraw });
  },
  latency(ms: number) {
    set({ latencyMs: ms });
  },
};

// ——— Algorytmy ———

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Tablice Bergera (circle method z gospodarzem naprzemiennym), rewanż lustrem. */
function berger(teams: Team[], meetings: 1 | 2): { rounds: Round[]; matches: StoredMatch[] } {
  const list: (Team | null)[] = [...teams];
  if (list.length % 2) list.push(null);
  const n = list.length;
  const firstLeg: [Team, Team][][] = [];
  let order = list.map((_, i) => i);
  for (let r = 0; r < n - 1; r++) {
    const pairs: [Team, Team][] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = list[order[i]];
      const y = list[order[n - 1 - i]];
      if (!x || !y) continue;
      // Ostatnia drużyna (stała) zmienia stronę co kolejkę — orientacja Bergera.
      const flip = i === 0 ? r % 2 === 1 : false;
      pairs.push(flip ? [y, x] : [x, y]);
    }
    firstLeg.push(pairs);
    order = rotate(order);
  }
  const legs = meetings === 2 ? [...firstLeg, ...firstLeg.map((p) => p.map(([h, a]) => [a, h] as [Team, Team]))] : firstLeg;
  const rounds: Round[] = [];
  const matches: StoredMatch[] = [];
  legs.forEach((pairs, idx) => {
    const round = { id: nextId++, name: `Kolejka ${idx + 1}`, order: idx + 1 };
    rounds.push(round);
    pairs.forEach(([home, away], k) =>
      matches.push({
        id: nextId++, stageId: state?.stage.id ?? 1, round, matchNumber: k + 1, homeTeam: home, awayTeam: away,
        homeScore: null, awayScore: null, status: 'scheduled', kickoffAt: null, venue: null,
      }),
    );
  });
  return { rounds, matches };
}
function rotate(order: number[]): number[] {
  // Circle method: pozycja 0 stoi, reszta obraca się o jeden.
  const [fixed, ...rest] = order;
  return [fixed, rest[rest.length - 1], ...rest.slice(0, -1)];
}

function toLocalInput(d: Date) {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export { toLocalInput };

function distribute(s: State, body: DatesBody): StoredMatch[] {
  const venues = body.venueIds.map((id) => VENUES.find((v) => v.id === id)!).filter(Boolean);
  const V = Math.max(venues.length, 1);
  const from = body.fromRound ?? 1;
  const start = new Date(body.startAt);
  const dur = s.matchDuration;
  const [endH, endM] = (body.dayEndTime ?? '').split(':').map(Number);
  const byRound = new Map<number, StoredMatch[]>();
  for (const m of s.matches) byRound.set(m.round.order, [...(byRound.get(m.round.order) ?? []), m]);
  const updated = new Map<number, StoredMatch>();
  let cursor = new Date(start);
  const orders = [...byRound.keys()].sort((a, b) => a - b).filter((o) => o >= from);
  orders.forEach((order, idx) => {
    const ms = byRound.get(order)!.filter((m) => m.status === 'scheduled').sort((a, b) => a.matchNumber - b.matchNumber);
    let roundStart: Date;
    if (body.mode === 'interval') {
      roundStart = new Date(start);
      roundStart.setDate(start.getDate() + idx * (body.intervalDays ?? 7)); // godzina zegarowa przez zmianę czasu
    } else roundStart = new Date(cursor);
    let slotStart = new Date(roundStart);
    let lastEnd = roundStart;
    ms.forEach((m, k) => {
      if (k > 0 && k % V === 0) slotStart = new Date(slotStart.getTime() + dur * 60_000);
      if (body.mode === 'continuous' && body.dayEndTime) {
        const dayEnd = new Date(slotStart);
        dayEnd.setHours(endH, endM, 0, 0);
        if (slotStart.getTime() + dur * 60_000 > dayEnd.getTime()) {
          const next = new Date(slotStart);
          next.setDate(next.getDate() + 1);
          next.setHours(start.getHours(), start.getMinutes(), 0, 0);
          slotStart = next;
        }
      }
      const kickoff = new Date(slotStart);
      lastEnd = new Date(kickoff.getTime() + dur * 60_000);
      updated.set(m.id, { ...m, kickoffAt: kickoff.toISOString(), venue: venues.length ? venues[k % V] : null });
    });
    cursor = lastEnd > cursor ? lastEnd : cursor;
  });
  return s.matches.map((m) => updated.get(m.id) ?? m);
}

// ——— Scenariusze ———

function build(key: ScenarioKey): State {
  const base: State = {
    scenario: key,
    stage: { id: 1, type: 'league', name: 'Faza zasadnicza' },
    teams: [],
    venues: VENUES,
    matchDuration: 60,
    allowsDraw: true,
    matches: [],
    rounds: [],
    latencyMs: 600,
    failNext: false,
    log: [],
  };
  const teams = (n: number) => TEAM_NAMES.slice(0, n).map((name, i) => ({ id: i + 1, name }));
  state = base; // `berger` czyta stageId
  const nextSunday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 7 * 5 + ((7 - d.getDay()) % 7));
    d.setHours(10, 0, 0, 0);
    return toLocalInput(d);
  };
  const dated = (s: State, venueIds = [1, 2]) => ({
    ...s,
    matches: distribute(s, { mode: 'interval', startAt: nextSunday(), intervalDays: 7, dayEndTime: null, venueIds, fromRound: null }),
  });
  const play = (s: State, upToRound: number, liveRound?: number): State => ({
    ...s,
    matches: s.matches.map((m, i) => {
      if (m.round.order <= upToRound)
        return { ...m, status: 'finished', homeScore: (i * 7) % 4, awayScore: (i * 3) % 3 };
      if (m.round.order === liveRound && m.matchNumber <= 2) return { ...m, status: 'live', homeScore: 1, awayScore: 0 };
      return m;
    }),
  });

  switch (key) {
    case 'empty':
      return { ...base, teams: teams(10) };
    case 'too-few':
      return { ...base, teams: teams(1) };
    case 'no-dates': {
      const t = teams(10);
      return { ...base, teams: t, ...berger(t, 1) };
    }
    case 'season': {
      const t = teams(10);
      let s: State = dated({ ...base, teams: t, ...berger(t, 2) });
      s = play(s, 6, 7);
      // Dwie ręczne korekty, które dają kolizje: boisko i drużynę.
      const r7 = s.matches.filter((m) => m.round.order === 7 && m.status === 'scheduled');
      const r8 = s.matches.filter((m) => m.round.order === 8);
      const r9 = s.matches.filter((m) => m.round.order === 9);
      // Przełożony mecz kolejki 7 trafia na godzinę meczu kolejki 8 z tą samą drużyną.
      const shares = (a: StoredMatch, b: StoredMatch) =>
        [a.homeTeam.id, a.awayTeam.id].some((id) => id === b.homeTeam.id || id === b.awayTeam.id);
      const moved = r7.find((a) => r8.some((b) => shares(a, b)));
      const target = moved && r8.find((b) => shares(moved, b));
      s.matches = s.matches.map((m) => {
        if (m.id === r8[2].id) return { ...m, kickoffAt: r8[0].kickoffAt, venue: r8[0].venue };
        if (moved && target && m.id === moved.id) return { ...m, kickoffAt: target.kickoffAt, venue: VENUES[2] };
        if (m.id === r9[4].id) return { ...m, kickoffAt: null, venue: null };
        return m;
      });
      return s;
    }
    case 'big': {
      const t = teams(20);
      return play(dated({ ...base, teams: t, ...berger(t, 2) }, [1, 2, 3]), 3);
    }
    case 'team-changes': {
      const t = teams(10);
      let s: State = dated({ ...base, teams: t, ...berger(t, 1) });
      // #161: usunięcie drużyny kasuje jej mecze `scheduled`, numery mają dziury.
      s = { ...s, teams: [...t.filter((x) => x.id !== 4), { id: 99, name: 'Orlęta Radość' }] };
      s.matches = s.matches.filter((m) => m.homeTeam.id !== 4 && m.awayTeam.id !== 4);
      return s;
    }
    case 'empty-round': {
      const t = teams(3);
      let s: State = dated({ ...base, teams: t, ...berger(t, 1) });
      s = { ...s, teams: t.filter((x) => x.id !== 2) };
      s.matches = s.matches.filter((m) => m.homeTeam.id !== 2 && m.awayTeam.id !== 2);
      return s;
    }
    case 'cup':
      return { ...base, teams: teams(8), stage: { id: 1, type: 'knockout', name: 'Drabinka' } };
  }
}
