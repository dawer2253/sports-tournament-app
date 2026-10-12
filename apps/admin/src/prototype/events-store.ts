// PROTOTYP (#191) — wyrzucany kod na gałęzi prototype/zdarzenia-meczu, nie do main.
// Zdarzenia meczu, składy i reguły zapisu z #188 żyją w pamięci: kontraktu
// zdarzeń jeszcze nie ma, więc nic tu nie dotyka API. Mecze i drużyny są
// prawdziwe (mock albo Laravel), składy generuje magazyn.
import type { AdminMatch } from '@tournament/api-client';
import { useSyncExternalStore } from 'react';

export type SportCode = 'football' | 'basketball';

export interface EventType {
  code: string;
  label: string;
  hasPlayer: boolean;
  value: number;
  stat: string | null;
  /** Tylko prototyp: krótka etykieta na przycisk i ikona tekstowa. */
  short: string;
  glyph: string;
}

/** Konfiguracja z #188, reguła 4 — kosz bez `points`, za to z rzutami. */
export const EVENT_TYPES: Record<SportCode, EventType[]> = {
  football: [
    { code: 'goal', label: 'Bramka', hasPlayer: true, value: 1, stat: 'goals', short: 'Gol', glyph: '⚽' },
    { code: 'own_goal', label: 'Bramka samobójcza', hasPlayer: true, value: 1, stat: null, short: 'Samobój', glyph: '⚽' },
    { code: 'yellow_card', label: 'Żółta kartka', hasPlayer: true, value: 1, stat: 'yellowCards', short: 'Żółta', glyph: '🟨' },
    { code: 'red_card', label: 'Czerwona kartka', hasPlayer: true, value: 1, stat: 'redCards', short: 'Czerwona', glyph: '🟥' },
  ],
  basketball: [
    { code: 'free_throw', label: 'Rzut wolny', hasPlayer: true, value: 1, stat: 'points', short: '+1', glyph: '①' },
    { code: 'two_pointer', label: 'Rzut za 2', hasPlayer: true, value: 2, stat: 'points', short: '+2', glyph: '②' },
    { code: 'three_pointer', label: 'Rzut za 3', hasPlayer: true, value: 3, stat: 'points', short: '+3', glyph: '③' },
    { code: 'foul', label: 'Faul', hasPlayer: true, value: 1, stat: 'fouls', short: 'Faul', glyph: '✋' },
  ],
};

/** Typy, które liczą się jako zdobycz w wyniku (do podpowiedzi zgodności). */
export function scoringValue(sport: SportCode, type: EventType): number {
  if (sport === 'football') return type.code === 'goal' || type.code === 'own_goal' ? 1 : 0;
  return type.stat === 'points' ? type.value : 0;
}

export interface ProtoPlayer {
  id: number;
  teamId: number;
  name: string;
  number: number | null;
}

export interface ProtoEvent {
  id: number;
  matchId: number;
  teamId: number;
  playerId: number | null;
  type: string;
  minute: number | null;
}

export type FailMode = 'none' | 'playerId' | '500';

interface State {
  sport: 'auto' | SportCode;
  events: ProtoEvent[];
  seeded: number[];
  nextId: number;
  latencyMs: number;
  failNext: FailMode;
  mismatchHint: boolean;
  clock: number;
  /** Zapisany stan meczu po „Zapisz” w prototypie (zapis meczu jest atrapą). */
  statusOverride: Record<number, string>;
  log: string[];
}

let state: State = {
  sport: 'auto',
  events: [],
  seeded: [],
  nextId: 1,
  latencyMs: 300,
  failNext: 'none',
  mismatchHint: true,
  clock: 37,
  statusOverride: {},
  log: [],
};

const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}
function log(line: string) {
  set({ log: [line, ...state.log].slice(0, 30) });
}

export function useProto(): State {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export function resolveSport(tournamentSport: string): SportCode {
  if (state.sport !== 'auto') return state.sport;
  return tournamentSport === 'basketball' ? 'basketball' : 'football';
}

export function useSport(tournamentSport: string): SportCode {
  const s = useProto();
  return s.sport !== 'auto' ? s.sport : tournamentSport === 'basketball' ? 'basketball' : 'football';
}

// --- Składy -----------------------------------------------------------------

const FIRST = ['Jan', 'Piotr', 'Marek', 'Tomasz', 'Kamil', 'Paweł', 'Adam', 'Michał', 'Krzysztof', 'Łukasz', 'Bartek', 'Szymon', 'Jakub', 'Mateusz'];
const LAST = ['Kowalski', 'Nowak', 'Wiśniewski', 'Wójcik', 'Kamiński', 'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski', 'Kozłowski', 'Jankowski', 'Mazur', 'Krawczyk', 'Piotrowski', 'Grabowski'];

const rosterCache = new Map<number, ProtoPlayer[]>();

/** Deterministyczny skład drużyny: 11 zawodników, dwóch bez numeru. */
export function roster(teamId: number): ProtoPlayer[] {
  const cached = rosterCache.get(teamId);
  if (cached) return cached;
  const players: ProtoPlayer[] = [];
  const used = new Set<number>();
  for (let i = 0; i < 11; i++) {
    const seed = teamId * 31 + i * 7;
    let number: number | null = ((seed * 13) % 23) + 1;
    while (used.has(number)) number = (number % 99) + 1;
    used.add(number);
    if (i === 9 || i === 10) number = null;
    players.push({
      id: teamId * 1000 + i + 1,
      teamId,
      name: `${FIRST[(seed + i) % FIRST.length]} ${LAST[(seed * 3 + i) % LAST.length]}`,
      number,
    });
  }
  players.sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
  rosterCache.set(teamId, players);
  return players;
}

export function findPlayer(id: number | null): ProtoPlayer | undefined {
  if (id === null) return undefined;
  return roster(Math.floor(id / 1000)).find((player) => player.id === id);
}

// --- Seed zdarzeń meczów rozegranych ------------------------------------------

/**
 * Mecz `live`/`finished` z wynikiem dostaje przy pierwszym otwarciu zdarzenia
 * zgodne z wynikiem (kosz: rzuty sumujące się do wyniku), jak seed demo z #188.
 */
export function ensureSeeded(match: AdminMatch, sport: SportCode) {
  if (state.seeded.includes(match.id)) return;
  const events: ProtoEvent[] = [];
  let id = state.nextId;
  if (match.status !== 'scheduled' && match.homeTeam && match.awayTeam && match.homeScore !== null && match.awayScore !== null) {
    const sides = [
      [match.homeTeam.id, match.homeScore],
      [match.awayTeam.id, match.awayScore],
    ] as const;
    const maxMinute = sport === 'football' ? 90 : 40;
    let k = match.id;
    const rnd = () => {
      k = (k * 9301 + 49297) % 233280;
      return k / 233280;
    };
    for (const [teamId, score] of sides) {
      const players = roster(teamId);
      const pick = () => players[Math.floor(rnd() * 7)];
      if (sport === 'football') {
        for (let g = 0; g < score; g++) {
          events.push({ id: id++, matchId: match.id, teamId, playerId: pick().id, type: 'goal', minute: 1 + Math.floor(rnd() * maxMinute) });
        }
        if (rnd() > 0.4) events.push({ id: id++, matchId: match.id, teamId, playerId: pick().id, type: 'yellow_card', minute: 1 + Math.floor(rnd() * maxMinute) });
      } else {
        let left = score;
        while (left > 0) {
          const roll = rnd();
          const value = left >= 3 && roll > 0.75 ? 3 : left >= 2 && roll > 0.25 ? 2 : 1;
          const type = value === 3 ? 'three_pointer' : value === 2 ? 'two_pointer' : 'free_throw';
          events.push({ id: id++, matchId: match.id, teamId, playerId: pick().id, type, minute: 1 + Math.floor(rnd() * maxMinute) });
          left -= value;
        }
        for (let f = 0; f < 4; f++) events.push({ id: id++, matchId: match.id, teamId, playerId: pick().id, type: 'foul', minute: 1 + Math.floor(rnd() * maxMinute) });
      }
    }
    // Jedno zdarzenie bez minuty, żeby lista pokazała regułę 10.
    if (events.length > 2) events[1] = { ...events[1], minute: null };
  }
  set({ events: [...state.events, ...events], seeded: [...state.seeded, match.id], nextId: id });
}

/** Reguła 10: minuta rosnąco, `null` na końcu, remis rozstrzyga `id`. */
export function matchEvents(events: ProtoEvent[], matchId: number): ProtoEvent[] {
  return events
    .filter((event) => event.matchId === matchId)
    .sort((a, b) => (a.minute ?? 1e9) - (b.minute ?? 1e9) || a.id - b.id);
}

// --- „API” zdarzeń z regułami #188 ---------------------------------------------

export class ProtoValidationError extends Error {
  readonly errors: Record<string, string>;
  constructor(message: string, errors: Record<string, string>) {
    super(message);
    this.errors = errors;
  }
}

export interface EventBody {
  type: string;
  teamId: number;
  playerId: number | null;
  minute: number | null;
}

function validate(match: AdminMatch, status: string, sport: SportCode, body: EventBody) {
  const errors: Record<string, string> = {};
  if (status === 'scheduled') {
    throw new ProtoValidationError('Zdarzenia wpiszesz, gdy mecz się zacznie.', {});
  }
  const type = EVENT_TYPES[sport].find((t) => t.code === body.type);
  if (!type) errors.type = 'Ten sport nie zna takiego zdarzenia.';
  if (body.teamId !== match.homeTeam?.id && body.teamId !== match.awayTeam?.id) {
    errors.teamId = 'Ta drużyna nie gra w tym meczu.';
  }
  if (type?.hasPlayer && body.playerId === null) errors.playerId = 'Wskaż zawodnika.';
  if (type && !type.hasPlayer && body.playerId !== null) errors.playerId = 'To zdarzenie nie ma zawodnika.';
  if (body.playerId !== null && !errors.teamId && findPlayer(body.playerId)?.teamId !== body.teamId) {
    errors.playerId = 'Zawodnik nie gra w wybranej drużynie.';
  }
  if (body.minute !== null && (!Number.isInteger(body.minute) || body.minute < 1 || body.minute > 150)) {
    errors.minute = 'Minuta to liczba od 1 do 150.';
  }
  if (state.failNext === 'playerId') {
    set({ failNext: 'none' });
    errors.playerId = 'Zawodnik nie gra w wybranej drużynie.';
  }
  if (Object.keys(errors).length > 0) throw new ProtoValidationError('Popraw zaznaczone pola.', errors);
}

async function roundTrip(line: string) {
  await new Promise((resolve) => setTimeout(resolve, state.latencyMs));
  if (state.failNext === '500') {
    set({ failNext: 'none' });
    log(`${line} → 500`);
    throw new Error('Nie udało się zapisać zdarzenia. Spróbuj ponownie.');
  }
}

export const events = {
  async create(match: AdminMatch, status: string, sport: SportCode, body: EventBody): Promise<ProtoEvent> {
    const line = `POST /matches/${match.id}/events ${body.type}`;
    await roundTrip(line);
    try {
      validate(match, status, sport, body);
    } catch (error) {
      log(`${line} → 422`);
      throw error;
    }
    const event: ProtoEvent = { id: state.nextId, matchId: match.id, ...body };
    set({ events: [...state.events, event], nextId: state.nextId + 1 });
    log(`${line} → 201 #${event.id}`);
    return event;
  },
  async update(match: AdminMatch, status: string, sport: SportCode, id: number, patch: Partial<EventBody>): Promise<ProtoEvent> {
    const line = `PATCH /match-events/${id}`;
    await roundTrip(line);
    const current = state.events.find((event) => event.id === id);
    if (!current) throw new Error('Tego zdarzenia już nie ma.');
    // Walidacja po scaleniu z zapisanym rekordem (reguła 1).
    const merged = { ...current, ...patch };
    try {
      validate(match, status, sport, merged);
    } catch (error) {
      log(`${line} → 422`);
      throw error;
    }
    set({ events: state.events.map((event) => (event.id === id ? merged : event)) });
    log(`${line} → 200`);
    return merged;
  },
  async remove(status: string, id: number) {
    const line = `DELETE /match-events/${id}`;
    await roundTrip(line);
    if (status === 'scheduled') {
      log(`${line} → 422`);
      throw new ProtoValidationError('Zdarzenia wpiszesz, gdy mecz się zacznie.', {});
    }
    set({ events: state.events.filter((event) => event.id !== id) });
    log(`${line} → 204`);
  },
  /** Cofnięcie usunięcia: prototyp wstawia rekord z tym samym id (API dałoby nowe). */
  restore(event: ProtoEvent) {
    set({ events: [...state.events, event] });
    log(`POST /matches/${event.matchId}/events (cofnięcie) → 201`);
  },
};

export const sim = {
  sport: (sport: State['sport']) => set({ sport, events: [], seeded: [], statusOverride: {} }),
  latency: (latencyMs: number) => set({ latencyMs }),
  failNext: (failNext: FailMode) => set({ failNext }),
  toggleHint: () => set({ mismatchHint: !state.mismatchHint }),
  clock: (clock: number) => set({ clock }),
  clearMatch: (matchId: number) => set({ events: state.events.filter((event) => event.matchId !== matchId) }),
  reset: () => set({ events: [], seeded: [], log: [], statusOverride: {} }),
  log,
};

/** Stan meczu, jaki widzi API zdarzeń: zapisany, nie ten z przełącznika w oknie. */
export function savedStatus(match: AdminMatch): string {
  return state.statusOverride[match.id] ?? match.status;
}

/** Atrapa `PATCH /matches/{match}` z regułą 8: powrót do `scheduled` przy zdarzeniach → 422. */
export async function saveMatch(match: AdminMatch, status: string) {
  await new Promise((resolve) => setTimeout(resolve, state.latencyMs));
  const line = `PATCH /matches/${match.id} status=${status}`;
  if (status === 'scheduled' && state.events.some((event) => event.matchId === match.id)) {
    log(`${line} → 422`);
    throw new ProtoValidationError('Popraw zaznaczone pola.', {
      status: 'Mecz ma zdarzenia. Usuń je, zanim cofniesz mecz do zaplanowanych.',
    });
  }
  set({ statusOverride: { ...state.statusOverride, [match.id]: status } });
  log(`${line} → 200 (atrapa: wynik, termin i obiekt pominięte)`);
}

export function getState() {
  return state;
}
