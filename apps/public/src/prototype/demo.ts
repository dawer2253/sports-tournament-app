// PROTOTYP (#205) — wyrzucany kod na gałęzi prototype/strona-meczu, nie do main.
// Dane demo strony meczu w kształcie ustalonym w #192: `PublicMatchDetail` =
// `PublicMatch` (ze `scorers` z #208) + `events` jak z `GET /matches/{match}/events`.
// Wszystko żyje w pamięci; panel stanu przełącza sport i długie nazwy.
import { useSyncExternalStore } from 'react';

export type Sport = 'football' | 'basketball';
export type Status = 'scheduled' | 'live' | 'finished';

export type TeamSummary = { id: number; name: string; logoUrl: string | null };

export type MatchEvent = {
  id: number;
  team: TeamSummary;
  player: { id: number; name: string } | null;
  type: string;
  typeLabel: string;
  minute: number | null;
};

/** Wiersz `PublicMatch.scorers` z #208. */
export type Scorer = {
  team: TeamSummary;
  player: { id: number; name: string };
  value: number;
  minutes: number[];
  ownGoal: boolean;
};

export type ProtoMatch = {
  id: number;
  round: { name: string };
  homeTeam: TeamSummary;
  awayTeam: TeamSummary;
  homeScore: number | null;
  awayScore: number | null;
  status: Status;
  kickoffAt: string;
  venue: { name: string } | null;
  scorers: Scorer[];
  events: MatchEvent[];
};

export type EventType = { code: string; label: string; value: number; stat: string | null };

/** Typy zdarzeń dosłownie z przykładu `GET /sports` (#188). */
export const EVENT_TYPES: Record<Sport, EventType[]> = {
  football: [
    { code: 'goal', label: 'Bramka', value: 1, stat: 'goals' },
    { code: 'own_goal', label: 'Bramka samobójcza', value: 1, stat: null },
    { code: 'yellow_card', label: 'Żółta kartka', value: 1, stat: 'yellowCards' },
    { code: 'red_card', label: 'Czerwona kartka', value: 1, stat: 'redCards' },
  ],
  basketball: [
    { code: 'free_throw', label: 'Rzut wolny', value: 1, stat: 'points' },
    { code: 'two_pointer', label: 'Rzut za 2', value: 2, stat: 'points' },
    { code: 'three_pointer', label: 'Rzut za 3', value: 3, stat: 'points' },
    { code: 'foul', label: 'Faul', value: 1, stat: 'fouls' },
  ],
};

const SCORING_STAT: Record<Sport, string> = { football: 'goals', basketball: 'points' };

export const TOURNAMENT: Record<Sport, { name: string; season: string; sport: string; teams: number; slug: string; emoji: string; scoreLabel: string }> = {
  football: { name: 'Liga Osiedlowa 2026', season: 'Sezon 2025/2026', sport: 'Piłka nożna', teams: 8, slug: 'liga-osiedlowa-2026', emoji: '⚽', scoreLabel: 'Bramki' },
  basketball: { name: 'Liga Koszykówki 2026', season: 'Sezon 2026', sport: 'Koszykówka', teams: 6, slug: 'liga-koszykowki-2026', emoji: '🏀', scoreLabel: 'Punkty' },
};

// --- Stan prototypu ---------------------------------------------------------

export type EntryMode = 'row' | 'button';
export type BackMode = 'state' | 'history';

type ProtoState = { sport: Sport; longNames: boolean; entry: EntryMode; back: BackMode };

let state: ProtoState = { sport: 'football', longNames: false, entry: 'row', back: 'state' };
const listeners = new Set<() => void>();

export const proto = {
  set(patch: Partial<ProtoState>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
};

export function useProto(): ProtoState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// --- Drużyny i składy -------------------------------------------------------

const TEAMS: Record<Sport, { id: number; short: string; long: string }[]> = {
  football: [
    { id: 1, short: 'FC Górka', long: 'KS Błękitni Stare Babice' },
    { id: 4, short: 'Dragons', long: 'AKS Zjednoczeni Piaseczno-Józefosław' },
    { id: 7, short: 'Huragan', long: 'Huragan Wołomin' },
    { id: 8, short: 'Burza', long: 'LKS Burza Mińsk Mazowiecki' },
    { id: 3, short: 'Orły', long: 'Orły Warszawa' },
    { id: 2, short: 'Sparta', long: 'Sparta Grodzisk' },
    { id: 5, short: 'Wilki', long: 'Wilki Konstancin' },
    { id: 6, short: 'Tygrysy', long: 'Tygrysy Ząbki' },
  ],
  basketball: [
    { id: 21, short: 'Kosze Mokotów', long: 'UKS Kosze Mokotów Warszawa' },
    { id: 22, short: 'Orły Ursynów', long: 'Akademia Koszykówki Orły Ursynów' },
    { id: 23, short: 'Rakiety', long: 'Rakiety Pruszków' },
    { id: 24, short: 'Żubry', long: 'KS Żubry Białołęka' },
    { id: 25, short: 'Sokoły', long: 'Sokoły Legionowo' },
    { id: 26, short: 'Torpeda', long: 'Torpeda Otwock' },
  ],
};

const FIRST = ['Jan', 'Piotr', 'Marek', 'Tomasz', 'Kamil', 'Paweł', 'Adam', 'Michał', 'Łukasz', 'Bartosz', 'Szymon'];
const LAST = ['Kowalski', 'Nowak', 'Wiśniewski', 'Wójcik', 'Kamiński', 'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski', 'Mazur'];

function roster(teamId: number, size: number) {
  return Array.from({ length: size }, (_, i) => ({
    id: teamId * 100 + i + 1,
    name: `${FIRST[(i + teamId) % FIRST.length]} ${LAST[(i * 3 + teamId) % LAST.length]}`,
  }));
}

// Deterministyczny generator, żeby oś kosza była taka sama po przeładowaniu.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

// --- Mecze --------------------------------------------------------------------

type RawEvent = { side: 'home' | 'away'; player: number; type: string; minute: number | null };

function build(sport: Sport, longNames: boolean, raw: {
  id: number; round: number; home: number; away: number; status: Status; kickoffAt: string; venue: string | null; events: RawEvent[];
}): ProtoMatch {
  const teams = TEAMS[sport];
  const t = (index: number): TeamSummary => ({ id: teams[index].id, name: longNames ? teams[index].long : teams[index].short, logoUrl: null });
  const homeTeam = t(raw.home);
  const awayTeam = t(raw.away);
  const size = sport === 'football' ? 11 : 8;
  const homeRoster = roster(homeTeam.id, size);
  const awayRoster = roster(awayTeam.id, size);
  const types = EVENT_TYPES[sport];

  // Kolejność jak z API (#188, reguła 10): minuta rosnąco, bez minuty na końcu, potem id.
  const events: MatchEvent[] = raw.events
    .map((e, i) => {
      const team = e.side === 'home' ? homeTeam : awayTeam;
      const player = (e.side === 'home' ? homeRoster : awayRoster)[e.player];
      return { id: raw.id * 1000 + i + 1, team, player, type: e.type, typeLabel: types.find((x) => x.code === e.type)!.label, minute: e.minute };
    })
    .sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999) || a.id - b.id);

  // Wynik zgodny ze zdarzeniami (samobój daje zdobycz przeciwnikowi).
  let homeScore: number | null = null;
  let awayScore: number | null = null;
  if (raw.status !== 'scheduled') {
    homeScore = 0;
    awayScore = 0;
    for (const e of events) {
      const type = types.find((x) => x.code === e.type)!;
      const forHome = e.team.id === homeTeam.id;
      if (type.stat === SCORING_STAT[sport]) {
        if (forHome) homeScore += type.value;
        else awayScore += type.value;
      } else if (type.code === 'own_goal') {
        if (forHome) awayScore += 1;
        else homeScore += 1;
      }
    }
  }

  return {
    id: raw.id,
    round: { name: `Kolejka ${raw.round}` },
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    status: raw.status,
    kickoffAt: raw.kickoffAt,
    venue: raw.venue ? { name: raw.venue } : null,
    scorers: raw.status === 'scheduled' ? [] : scorersOf(sport, events),
    events: raw.status === 'scheduled' ? [] : events,
  };
}

/** `scorers` liczone jak w #208 — tak, jak zrobi to serwer. */
function scorersOf(sport: Sport, events: MatchEvent[]): Scorer[] {
  const types = EVENT_TYPES[sport];
  const rows = new Map<string, Scorer>();
  for (const e of events) {
    if (!e.player) continue;
    const type = types.find((x) => x.code === e.type)!;
    const ownGoal = type.code === 'own_goal';
    if (type.stat !== SCORING_STAT[sport] && !ownGoal) continue;
    const key = `${e.player.id}-${ownGoal}`;
    const row = rows.get(key) ?? { team: e.team, player: e.player, value: 0, minutes: [], ownGoal };
    row.value += type.value;
    if (e.minute !== null) row.minutes.push(e.minute);
    rows.set(key, row);
  }
  return [...rows.values()].sort(
    (a, b) => (a.minutes[0] ?? 999) - (b.minutes[0] ?? 999) || a.player.id - b.player.id,
  );
}

const FOOTBALL_FINISHED: RawEvent[] = [
  { side: 'home', player: 6, type: 'goal', minute: 12 },
  { side: 'away', player: 3, type: 'yellow_card', minute: 27 },
  { side: 'away', player: 8, type: 'goal', minute: 34 },
  { side: 'away', player: 2, type: 'own_goal', minute: 51 },
  { side: 'home', player: 4, type: 'yellow_card', minute: 58 },
  { side: 'home', player: 6, type: 'goal', minute: 63 },
  { side: 'home', player: 4, type: 'red_card', minute: 77 },
  { side: 'away', player: 9, type: 'goal', minute: 88 },
  { side: 'home', player: 9, type: 'goal', minute: 93 },
  { side: 'away', player: 5, type: 'yellow_card', minute: null },
];

const FOOTBALL_LIVE: RawEvent[] = [
  { side: 'away', player: 7, type: 'goal', minute: 18 },
  { side: 'home', player: 2, type: 'yellow_card', minute: 40 },
  { side: 'home', player: 8, type: 'goal', minute: 56 },
];

/** Kilkadziesiąt rzutów i faule, rozłożone na zawodników jak w seedzie demo. */
function basketballEvents(seed: number, upTo: number, count: number): RawEvent[] {
  const r = rng(seed);
  const out: RawEvent[] = [];
  for (let i = 0; i < count; i++) {
    const roll = r();
    const type = roll < 0.18 ? 'free_throw' : roll < 0.68 ? 'two_pointer' : roll < 0.86 ? 'three_pointer' : 'foul';
    // Kilku liderów rzuca częściej niż reszta składu.
    const player = Math.floor(Math.pow(r(), 1.8) * 8);
    out.push({ side: r() < 0.52 ? 'home' : 'away', player, type, minute: 1 + Math.floor(r() * upTo) });
  }
  return out;
}

export function demoMatches(sport: Sport, longNames: boolean): ProtoMatch[] {
  if (sport === 'football') {
    return [
      build(sport, longNames, { id: 1, round: 5, home: 0, away: 1, status: 'finished', kickoffAt: '2026-06-27T17:00:00', venue: 'Boisko A', events: FOOTBALL_FINISHED }),
      build(sport, longNames, { id: 2, round: 5, home: 4, away: 5, status: 'finished', kickoffAt: '2026-06-27T19:00:00', venue: 'Boisko B', events: [] }),
      build(sport, longNames, { id: 4, round: 6, home: 2, away: 3, status: 'live', kickoffAt: '2026-07-04T17:00:00', venue: 'Boisko B', events: FOOTBALL_LIVE }),
      build(sport, longNames, { id: 3, round: 6, home: 6, away: 7, status: 'scheduled', kickoffAt: '2026-07-04T19:00:00', venue: null, events: [] }),
    ];
  }
  return [
    build(sport, longNames, { id: 11, round: 3, home: 0, away: 1, status: 'finished', kickoffAt: '2026-06-27T18:00:00', venue: 'Hala OSiR Mokotów', events: basketballEvents(7, 40, 82) }),
    build(sport, longNames, { id: 12, round: 4, home: 2, away: 3, status: 'live', kickoffAt: '2026-07-04T18:00:00', venue: 'Hala OSiR Mokotów', events: basketballEvents(11, 22, 44) }),
    build(sport, longNames, { id: 13, round: 4, home: 4, away: 5, status: 'scheduled', kickoffAt: '2026-07-04T20:00:00', venue: 'Hala Pruszków', events: [] }),
  ];
}

export function isScoring(sport: Sport, code: string): boolean {
  const type = EVENT_TYPES[sport].find((x) => x.code === code);
  return type?.stat === SCORING_STAT[sport] || code === 'own_goal';
}

export function valueOf(sport: Sport, code: string): number {
  return EVENT_TYPES[sport].find((x) => x.code === code)?.value ?? 1;
}

const dateFmt = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });

export function kickoffDate(iso: string) {
  return dateFmt.format(new Date(iso));
}
export function kickoffTime(iso: string) {
  return timeFmt.format(new Date(iso));
}
