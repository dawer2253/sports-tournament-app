// Spójne dane demo dla wszystkich ekranów (mock, docelowo z API).

import type { Leaderboard, LeaderboardRow, StatOption } from '../components/data/leaderboard-data'
import type { EventTypeOption, MatchEventRow, RosterPlayer } from '../components/data/match-event-data'
import type { MatchCollision, MatchRowData } from '../components/data/match-row-data'
import type { PlayerRow } from '../components/data/player-row'
import type { RoundSummary } from '../components/data/round-summary'
import type { StandingsTableRow } from '../components/data/standings-table-row'
import type { TeamRow } from '../components/data/team-row'
import type { TiebreakerItem } from '../components/data/tiebreaker-item'
import type { TournamentRow } from '../components/data/tournament-row'
import type { VenueRow } from '../components/data/venue-row'
import type { PublicShellTournament } from '../components/layout/public-shell-tournament'
import { formatRoundDates } from './kickoff'

export type MatchStatus = 'scheduled' | 'live' | 'finished'
export type FormResult = 'W' | 'D' | 'L'

export type Team = {
  id: number
  name: string
  abbr: string
  players: number
}

// Konto organizera pokazywane w panelu, dopóki aplikacja nie poda prawdziwego.
export const organizer = { name: 'Klub Sportowy', email: 'organizator@klub.pl' }

export const tournament = {
  name: 'Liga Osiedlowa 2026',
  season: 'Sezon 2025/2026',
  slug: 'liga-osiedlowa',
  sport: 'Piłka nożna',
  format: 'Liga (każdy z każdym)',
  teamsCount: 8,
  rounds: 14,
  currentRound: 5,
}

export const teams: Team[] = [
  { id: 1, name: 'FC Górka', abbr: 'FG', players: 12 },
  { id: 2, name: 'Sparta', abbr: 'SP', players: 11 },
  { id: 3, name: 'Orły', abbr: 'OR', players: 13 },
  { id: 4, name: 'Dragons', abbr: 'DR', players: 11 },
  { id: 5, name: 'Wilki', abbr: 'WI', players: 10 },
  { id: 6, name: 'Tygrysy', abbr: 'TY', players: 12 },
  { id: 7, name: 'Huragan', abbr: 'HU', players: 11 },
  { id: 8, name: 'Burza', abbr: 'BU', players: 12 },
]

// Herb demo w adresie `data:`, żeby makiety nie zależały od sieci ani od
// assetów pakietu. Kolory to treść obrazka (jak w pliku klubu), nie chroma UI
// (wyjątek z reguły kolorów w `packages/ui/AGENTS.md`).
export const demoTeamLogoUrl =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">' +
      '<circle cx="24" cy="24" r="22" fill="#0f766e"/>' +
      '<circle cx="24" cy="24" r="15" fill="none" stroke="#f8fafc" stroke-width="3"/>' +
      '<path d="M24 13l3.2 7 7.6.7-5.8 5 1.8 7.4L24 29.2l-6.6 3.9 1.8-7.4-5.8-5 7.6-.7z" fill="#f8fafc"/>' +
      '</svg>',
  )

// Lista drużyn w kształcie `TeamRow`, czyli tak, jak oddaje ją kontrakt.
// Czerpie z `teams`, żeby nazwy zgadzały się z resztą makiet, i stoi
// w kolejności z API, czyli po nazwie. Herb ma tylko FC Górka: reszta pokazuje
// herb zastępczy, jak przy świeżym turnieju.
export const teamRows: TeamRow[] = teams
  .map((team) => ({
    id: team.id,
    name: team.name,
    logoUrl: team.id === 1 ? demoTeamLogoUrl : null,
    playersCount: team.players,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, 'pl'))

// Drużyna ekranu składu: ta z herbem i z pełnym składem w `teamPlayers`.
export const rosterTeam: TeamRow = teamRows.find((team) => team.id === 1)!

// Skład `rosterTeam` w kształcie `PlayerRow`. Numer i pozycja są opcjonalne,
// więc część zawodników ich nie ma. Długość równa się `playersCount` tej
// drużyny. Kolejność jak z API: numery rosnąco, a zawodnicy bez numeru na
// końcu po pełnej nazwie (`name`), czyli w praktyce po imieniu.
export const teamPlayers: PlayerRow[] = [
  { id: 1, name: 'Marek Lis', number: 1, position: 'Bramkarz' },
  { id: 2, name: 'Michał Nowak', number: 4, position: 'Obrońca' },
  { id: 3, name: 'Kamil Dąbrowski', number: 5, position: 'Obrońca' },
  { id: 4, name: 'Paweł Szymański', number: 6, position: 'Pomocnik' },
  { id: 5, name: 'Adam Wójcik', number: 7, position: 'Skrzydłowy' },
  { id: 6, name: 'Krzysztof Wróbel', number: 8, position: 'Pomocnik' },
  { id: 7, name: 'Jan Kowalski', number: 9, position: 'Napastnik' },
  { id: 8, name: 'Piotr Zieliński', number: 10, position: 'Pomocnik' },
  { id: 9, name: 'Tomasz Mazur', number: 11, position: 'Napastnik' },
  { id: 10, name: 'Łukasz Kamiński', number: 23, position: null },
  { id: 11, name: 'Bartosz Lewandowski', number: null, position: 'Obrońca' },
  { id: 12, name: 'Grzegorz Wiśniewski', number: null, position: null },
]

export type StandingRow = {
  pos: number
  team: Team
  p: number; w: number; d: number; l: number
  gf: number; ga: number; pts: number
  form: FormResult[]
}

export const standings: StandingRow[] = [
  { pos: 1, team: teams[0], p: 5, w: 4, d: 1, l: 0, gf: 12, ga: 4, pts: 13, form: ['W', 'W', 'D', 'W', 'W'] },
  { pos: 2, team: teams[1], p: 5, w: 3, d: 1, l: 1, gf: 9, ga: 6, pts: 10, form: ['W', 'L', 'W', 'D', 'W'] },
  { pos: 3, team: teams[2], p: 5, w: 3, d: 1, l: 1, gf: 8, ga: 7, pts: 10, form: ['W', 'W', 'L', 'D', 'W'] },
  { pos: 4, team: teams[3], p: 5, w: 2, d: 0, l: 3, gf: 7, ga: 8, pts: 6, form: ['L', 'W', 'L', 'W', 'L'] },
  { pos: 5, team: teams[5], p: 5, w: 2, d: 0, l: 3, gf: 6, ga: 9, pts: 6, form: ['L', 'W', 'L', 'L', 'W'] },
  { pos: 6, team: teams[6], p: 5, w: 1, d: 2, l: 2, gf: 5, ga: 7, pts: 5, form: ['D', 'L', 'D', 'W', 'L'] },
  { pos: 7, team: teams[7], p: 5, w: 1, d: 1, l: 3, gf: 4, ga: 8, pts: 4, form: ['L', 'L', 'W', 'D', 'L'] },
  { pos: 8, team: teams[4], p: 5, w: 0, d: 0, l: 5, gf: 3, ga: 14, pts: 0, form: ['L', 'L', 'L', 'L', 'L'] },
]

// Pod jaką nazwą występują zdobycze tej tabeli (`Score` w CONTEXT.md; koszykówka:
// „Punkty"). W kontrakcie to `StandingTable.scoreLabel` — etykieta wisi na
// tabeli, nie na turnieju (ADR-0006).
export const standingsScoreLabel = 'Bramki'

// Ta sama tabela w kształcie `StandingsTableRow`, czyli tak, jak oddaje ją
// kontrakt panelowi (`StandingRow`). Herb jak w `teamRows`.
export const standingsTableRows: StandingsTableRow[] = standings.map((row) => ({
  position: row.pos,
  team: { id: row.team.id, name: row.team.name, logoUrl: row.team.id === 1 ? demoTeamLogoUrl : null },
  played: row.p,
  won: row.w,
  drawn: row.d,
  lost: row.l,
  scoreFor: row.gf,
  scoreAgainst: row.ga,
  scoreDifference: row.gf - row.ga,
  points: row.pts,
}))

// Podgląd innej kolejności kryteriów (#173): pary z równą liczbą punktów
// (miejsca 2–3 i 4–5) zamieniają się miejscami, reszta stoi.
export const standingsTablePreviewRows: StandingsTableRow[] = [1, 3, 2, 5, 4, 6, 7, 8].map((position, index) => ({
  ...standingsTableRows[position - 1]!,
  position: index + 1,
}))

// Tabela turnieju koszykarskiego: bez remisów, punktacja 2/1, zdobycze to
// punkty. Drużyny spoza `teams`, bo turniej demo jest piłkarski.
export const basketballStandingsTableRows: StandingsTableRow[] = [
  { position: 1, team: { id: 11, name: 'Żubry Wola', logoUrl: null }, played: 3, won: 3, drawn: 0, lost: 0, scoreFor: 251, scoreAgainst: 212, scoreDifference: 39, points: 6 },
  { position: 2, team: { id: 12, name: 'Rysie Mokotów', logoUrl: null }, played: 3, won: 2, drawn: 0, lost: 1, scoreFor: 240, scoreAgainst: 226, scoreDifference: 14, points: 5 },
  { position: 3, team: { id: 13, name: 'Kosze Ochota', logoUrl: null }, played: 3, won: 1, drawn: 0, lost: 2, scoreFor: 219, scoreAgainst: 233, scoreDifference: -14, points: 4 },
  { position: 4, team: { id: 14, name: 'Orlęta Praga', logoUrl: null }, played: 3, won: 0, drawn: 0, lost: 3, scoreFor: 204, scoreAgainst: 243, scoreDifference: -39, points: 3 },
]

export type Scorer = { pos: number; player: string; team: Team; goals: number }

export const scorers: Scorer[] = [
  { pos: 1, player: 'Jan Kowalski', team: teams[0], goals: 8 },
  { pos: 2, player: 'Adam Wójcik', team: teams[3], goals: 6 },
  { pos: 3, player: 'Piotr Zieliński', team: teams[0], goals: 5 },
  { pos: 4, player: 'Tomasz Mazur', team: teams[1], goals: 4 },
  { pos: 5, player: 'Kamil Duda', team: teams[2], goals: 4 },
  { pos: 6, player: 'Rafał Sikora', team: teams[5], goals: 3 },
]

// --- Klasyfikacja (#207) ------------------------------------------------------

/** `PublicTournament.stats` sportów, dosłownie z przykładów w kontrakcie. */
export const statOptionsBySport: Record<'football' | 'basketball', StatOption[]> = {
  football: [
    { code: 'goals', label: 'Bramki' },
    { code: 'yellowCards', label: 'Żółte kartki' },
    { code: 'redCards', label: 'Czerwone kartki' },
  ],
  basketball: [
    { code: 'points', label: 'Punkty' },
    { code: 'fouls', label: 'Faule' },
  ],
}

/**
 * Wiersze klasyfikacji z par `[zawodnik, drużyna, wartość]` podanych malejąco:
 * pozycja dzielona przy remisie, jak w `StatLeaderboardRow` z kontraktu. Id
 * zawodnika rośnie z kolejnością, więc ex aequo stoją po `player.id`.
 */
function leaderboardRows(entries: [string, { id: number; name: string }, number][]): LeaderboardRow[] {
  return entries.map(([name, team, value], index) => ({
    position: entries.findIndex(([, , other]) => other === value) + 1,
    player: { id: 100 + index, name },
    team: { id: team.id, name: team.name, logoUrl: null },
    value,
  }))
}

const [gorka, sparta, orly, dragons, wilki, tygrysy] = teams as [Team, Team, Team, Team, Team, Team]
const [zubry, rysie, kosze, orleta] = basketballStandingsTableRows.map((row) => row.team) as [
  StandingsTableRow['team'],
  StandingsTableRow['team'],
  StandingsTableRow['team'],
  StandingsTableRow['team'],
]

/** Klasyfikacje turnieju demo: sport → kod statystyki → odpowiedź `/leaderboard`. */
export const leaderboardsBySport: Record<'football' | 'basketball', Record<string, Leaderboard>> = {
  football: {
    goals: {
      stat: 'goals',
      label: 'Bramki',
      rows: leaderboardRows([
        ['Jan Kowalski', gorka, 8],
        ['Adam Wójcik', dragons, 6],
        ['Piotr Zieliński', gorka, 5],
        ['Tomasz Mazur', sparta, 4],
        ['Kamil Duda', orly, 4],
        ['Rafał Sikora', tygrysy, 3],
        ['Michał Woźniak', wilki, 1],
        ['Łukasz Nowak', sparta, 1],
      ]),
    },
    yellowCards: {
      stat: 'yellowCards',
      label: 'Żółte kartki',
      rows: leaderboardRows([
        ['Bartosz Mazur', wilki, 3],
        ['Szymon Lewandowski', tygrysy, 2],
        ['Tomasz Mazur', sparta, 2],
        ['Paweł Kamiński', orly, 1],
      ]),
    },
    redCards: {
      stat: 'redCards',
      label: 'Czerwone kartki',
      rows: leaderboardRows([['Szymon Lewandowski', tygrysy, 1]]),
    },
  },
  basketball: {
    points: {
      stat: 'points',
      label: 'Punkty',
      rows: leaderboardRows([
        ['Oskar Dąb', zubry, 64],
        ['Bruno Klon', zubry, 64],
        ['Filip Sarna', rysie, 58],
        ['Hubert Łoś', kosze, 51],
        ['Kacper Lipa', zubry, 47],
        ['Wiktor Bóbr', orleta, 45],
      ]),
    },
    fouls: {
      stat: 'fouls',
      label: 'Faule',
      rows: leaderboardRows([
        ['Wiktor Bóbr', orleta, 7],
        ['Hubert Łoś', kosze, 5],
        ['Oskar Dąb', zubry, 4],
      ]),
    },
  },
}

export type BracketMatch = { home: Team | null; away: Team | null; homeScore: number | null; awayScore: number | null; winner?: 'home' | 'away' }
export type BracketRound = { name: string; matches: BracketMatch[] }

export const bracket: BracketRound[] = [
  {
    name: 'Półfinały',
    matches: [
      { home: teams[0], away: teams[4], homeScore: 3, awayScore: 1, winner: 'home' },
      { home: teams[2], away: teams[1], homeScore: 0, awayScore: 2, winner: 'away' },
    ],
  },
  {
    name: 'Finał',
    matches: [{ home: teams[0], away: teams[1], homeScore: 2, awayScore: 1, winner: 'home' }],
  },
]

export const bracketWinner = teams[0]

// Duży turniej pucharowy — 32 drużyny, 5 rund. Trzymamy go w danych demo,
// bo drabinka na 4 drużyny nie udowadnia niczego o układzie: dopiero tutaj
// widać selektor rund i to, że drzewo nie rozjeżdża ekranu.
const cupTeams: Team[] = Array.from({ length: 32 }, (_, i) => ({
  id: 1000 + i,
  name: `${['FC', 'KS', 'LKS', 'MKS'][i % 4]} ${
    ['Górka', 'Sparta', 'Orły', 'Dragons', 'Wilki', 'Tygrysy', 'Huragan', 'Burza'][i % 8]
  } ${Math.floor(i / 8) + 1}`,
  abbr: `${['FG', 'SP', 'OR', 'DR', 'WI', 'TY', 'HU', 'BU'][i % 8]}${Math.floor(i / 8) + 1}`,
  players: 11,
}))

function buildCupBracket(entrants: Team[]): BracketRound[] {
  const names: Record<number, string> = { 16: '1/16 finału', 8: '1/8 finału', 4: 'Ćwierćfinały', 2: 'Półfinały', 1: 'Finał' }
  const rounds: BracketRound[] = []
  let alive = entrants
  while (alive.length > 1) {
    const matches: BracketMatch[] = []
    const winners: Team[] = []
    for (let i = 0; i < alive.length; i += 2) {
      const home = alive[i]
      const away = alive[i + 1]
      // Deterministyczny wynik — snapshoty Chromatica muszą być powtarzalne.
      const homeWins = (home.id + away.id) % 3 !== 0
      matches.push({
        home,
        away,
        homeScore: homeWins ? 2 : 1,
        awayScore: homeWins ? 1 : 3,
        winner: homeWins ? 'home' : 'away',
      })
      winners.push(homeWins ? home : away)
    }
    rounds.push({ name: names[matches.length] ?? `Runda ${rounds.length + 1}`, matches })
    alive = winners
  }
  return rounds
}

export const bracketLarge = buildCupBracket(cupTeams)
export const bracketLargeWinner =
  bracketLarge.at(-1)!.matches[0].winner === 'home'
    ? bracketLarge.at(-1)!.matches[0].home!
    : bracketLarge.at(-1)!.matches[0].away!

// Obiekty turnieju w kształcie `VenueRow`. Hala bez adresu pokazuje stan
// `address: null`, który kontrakt dopuszcza.
export const venueRows: VenueRow[] = [
  { id: 1, name: 'Boisko A', address: 'ul. Sportowa 1' },
  { id: 2, name: 'Boisko B', address: 'ul. Parkowa 12' },
  { id: 3, name: 'Hala Miejska', address: null },
]

// Ustawienia turnieju w sporcie demo, w kształcie `SportConfig` z kontraktu
// (przykład `GET /sports`), ograniczone do tego, co pokazuje ekran ustawień.
// Tiebreaki to domyślna kolejność sportu z etykietami z `tiebreakerLabels`
// (#117) — tymi samymi, które niesie `StandingTable.tiebreakers`.
export type DemoSportSettings = {
  name: string
  allowsDraw: boolean
  defaultPoints: { win: number; draw: number; loss: number }
  tiebreakers: TiebreakerItem[]
  /**
   * `availableTiebreakers` z etykietami, w kolejności sportu: z tego
   * wybiera edytor przy tabeli (#173).
   */
  availableTiebreakers: TiebreakerItem[]
  /** `StandingTable.scoreLabel` w turnieju tego sportu (ADR-0006). */
  scoreLabel: string
}

export const sportSettings: Record<'football' | 'basketball', DemoSportSettings> = {
  football: {
    name: 'Piłka nożna',
    allowsDraw: true,
    defaultPoints: { win: 3, draw: 1, loss: 0 },
    tiebreakers: [
      { code: 'points', label: 'Punkty w tabeli' },
      { code: 'head_to_head', label: 'Bezpośredni mecz' },
      { code: 'score_diff', label: 'Różnica bramek' },
      { code: 'score_for', label: 'Bramki zdobyte' },
    ],
    availableTiebreakers: [
      { code: 'points', label: 'Punkty w tabeli' },
      { code: 'head_to_head', label: 'Bezpośredni mecz' },
      { code: 'score_diff', label: 'Różnica bramek' },
      { code: 'score_for', label: 'Bramki zdobyte' },
      { code: 'wins', label: 'Zwycięstwa' },
    ],
    scoreLabel: standingsScoreLabel,
  },
  basketball: {
    name: 'Koszykówka',
    allowsDraw: false,
    defaultPoints: { win: 2, draw: 0, loss: 1 },
    tiebreakers: [
      { code: 'points', label: 'Punkty w tabeli' },
      { code: 'head_to_head', label: 'Bezpośredni mecz' },
      { code: 'score_diff', label: 'Różnica punktów' },
    ],
    availableTiebreakers: [
      { code: 'points', label: 'Punkty w tabeli' },
      { code: 'head_to_head', label: 'Bezpośredni mecz' },
      { code: 'score_diff', label: 'Różnica punktów' },
      { code: 'score_for', label: 'Zdobyte punkty' },
      { code: 'wins', label: 'Zwycięstwa' },
    ],
    scoreLabel: 'Punkty',
  },
}

// Szkic kolejności w podglądzie (#173): różnica bramek przed meczem
// bezpośrednim. Według niego ułożone jest `standingsTablePreviewRows`.
export const standingsTablePreviewDraft = ['points', 'score_diff', 'head_to_head', 'score_for']

// Lista turniejów organizera (ekran startowy panelu). Kształt zgodny
// z `Tournament` z kontraktu, ograniczony do pól, które pokazuje tabela.
//
// Dashboard bierze te same turnieje stąd (`screens/admin-dashboard.tsx`
// dokleja po `id` własne pola prezentacyjne), więc lista jest jedna.
export const tournamentList: TournamentRow[] = [
  {
    id: 1,
    // Pierwszy turniej to ten sam byt, który opisuje `tournament` wyżej —
    // czerpie z niego, żeby nie dało się rozjechać liczby drużyn ani adresu.
    name: tournament.name,
    slug: tournament.slug,
    status: 'active',
    sport: { name: tournament.sport },
    teamsCount: tournament.teamsCount,
  },
  {
    id: 2,
    name: 'Puchar Miasta — Kosz',
    slug: 'puchar-miasta-kosz',
    status: 'draft',
    sport: { name: 'Koszykówka' },
    teamsCount: 16,
  },
  {
    id: 3,
    name: 'Turniej Zimowy',
    slug: 'turniej-zimowy',
    status: 'finished',
    sport: { name: 'Piłka nożna' },
    teamsCount: 12,
  },
]

// Terminarz ligi w kształcie `Match` z kontraktu (makieta `admin-schedule`):
// osiem drużyn z `teams`, mecz i rewanż, czyli 14 kolejek po 4 mecze, jak
// w `tournament.rounds`. Pary układa ten sam przepis Bergera co backend
// (`RoundRobin`), żeby makieta nie pokazywała układu, którego generator nie
// zrobi. Kolejność drużyn jest stała — snapshoty Chromatica muszą być
// powtarzalne.
export type ScheduleDemoMatch = MatchRowData & { round: { id: number; name: string; order: number } }

/** Strefa makiet terminarza: zrzut nie może zależeć od strefy maszyny. */
export const scheduleTimeZone = 'Europe/Warsaw'

function bergerPairs(n: number): [number, number][][] {
  const shift = (x: number) => (x === n ? n : ((x - 1 + n / 2) % (n - 1)) + 1)
  let round: [number, number][] = [[1, n], ...Array.from({ length: n / 2 - 1 }, (_, k) => [2 + k, n - 1 - k] as [number, number])]
  const table = [round]
  for (let r = 1; r < n - 1; r++) {
    round = round.map(([home, away]): [number, number] =>
      away === n ? [n, shift(home)] : home === n ? [shift(away), n] : [shift(home), shift(away)],
    )
    table.push(round)
  }
  return [...table, ...table.map((pairs) => pairs.map(([home, away]): [number, number] => [away, home]))]
}

/**
 * Kolejki co tydzień w sobotę od 5 września 2026, mecze o 10:00 i 12:00
 * czasu polskiego na dwóch boiskach. Offset w UTC zmienia się 25 października
 * (ADR-0008), więc 10:00 to raz `08:00Z`, raz `09:00Z`.
 */
function demoKickoff(order: number, matchNumber: number): string {
  const day = new Date(Date.UTC(2026, 8, 5 + (order - 1) * 7))
  const offset = day < new Date(Date.UTC(2026, 9, 25)) ? 2 : 1
  day.setUTCHours((matchNumber <= 2 ? 10 : 12) - offset)
  return day.toISOString().replace('.000Z', '+00:00')
}

const scheduleVenues = [
  { id: 1, name: 'Boisko A' },
  { id: 2, name: 'Boisko B' },
]

/** Obiekty makiet terminarza i okna meczu, eksportowane dla ekranów demo. */
export { scheduleVenues }

/** Cały sezon bez dat i obiektów, tak jak oddaje go generator (#157). */
export const scheduleUndated: ScheduleDemoMatch[] = bergerPairs(teams.length).flatMap((pairs, index) =>
  pairs.map(([home, away], position) => ({
    id: index * 10 + position + 1,
    round: { id: index + 1, name: `Kolejka ${index + 1}`, order: index + 1 },
    homeTeam: { id: teams[home - 1].id, name: teams[home - 1].name },
    awayTeam: { id: teams[away - 1].id, name: teams[away - 1].name },
    homeScore: null,
    awayScore: null,
    status: 'scheduled' as const,
    kickoffAt: null,
    venue: null,
  })),
)

/**
 * Sezon w trakcie: cztery kolejki rozegrane, w piątej dwa mecze zakończone,
 * jeden trwa, jeden przed nami. Wyniki są deterministyczne. Do tego dwie
 * ręczne korekty dają kolizję terminu (#175): jedną boiska, jedną drużyny.
 */
export const scheduleInProgress: ScheduleDemoMatch[] = withCollisions(seedScheduleCollisions(scheduleSeason()))

function scheduleSeason(): ScheduleDemoMatch[] {
  return scheduleUndated.map((match) => {
    const matchNumber = (match.id - 1) % 10 + 1
    const dated = {
      ...match,
      kickoffAt: demoKickoff(match.round.order, matchNumber),
      venue: scheduleVenues[(matchNumber - 1) % 2],
    }
    const order = match.round.order
    if (order < 5 || (order === 5 && matchNumber === 1)) {
      return { ...dated, status: 'finished' as const, homeScore: (match.id * 7) % 4, awayScore: (match.id * 3) % 3 }
    }
    if (order === 5 && matchNumber === 2) {
      return { ...dated, status: 'live' as const, homeScore: 1, awayScore: 0 }
    }
    return dated
  })
}

/**
 * Dwie korekty, które dają kolizję terminu — po jednej na rodzaj, żeby makieta
 * pokazywała oba warianty plakietki (#175). Kolizja boiska siedzi w kolejce 5,
 * czyli w tej, którą ekran otwiera domyślnie. Reszta terminarza zostaje bez zmian.
 */
function seedScheduleCollisions(matches: ScheduleDemoMatch[]): ScheduleDemoMatch[] {
  const scheduled = (order: number) => matches.filter((match) => match.round.order === order && match.status === 'scheduled')
  const fifth = scheduled(5)
  if (fifth.length < 2) return matches

  const [first, second] = fifth
  // Kolizja boiska: drugi zaplanowany mecz kolejki 5 wchodzi na godzinę
  // i obiekt pierwszego.
  let seeded = matches.map((match) =>
    match.id === second.id ? { ...match, kickoffAt: first.kickoffAt, venue: first.venue } : match,
  )

  const sharesTeam = (a: ScheduleDemoMatch, b: ScheduleDemoMatch) =>
    [a.homeTeam?.id, a.awayTeam?.id].some((id) => id === b.homeTeam?.id || id === b.awayTeam?.id)

  // Kolizja drużyny: mecz kolejki 7 na godzinę meczu kolejki 6 z tą samą drużyną.
  const sixth = scheduled(6)
  const partner = scheduled(7).find((match) => sixth.some((other) => sharesTeam(match, other)))
  const target = partner && seeded.find((other) => other.round.order === 6 && sharesTeam(partner, other))
  if (partner && target) {
    seeded = seeded.map((match) => (match.id === partner.id ? { ...match, kickoffAt: target.kickoffAt } : match))
  }

  return seeded
}

/** Kolizje terminów, liczone tym samym przepisem co backend (#158). */
export function withCollisions(matches: ScheduleDemoMatch[], matchDuration = 60): ScheduleDemoMatch[] {
  const windows = matches
    .filter((match) => match.kickoffAt)
    .map((match) => ({
      match,
      start: Date.parse(match.kickoffAt!),
      end: Date.parse(match.kickoffAt!) + matchDuration * 60_000,
    }))
    .sort((a, b) => a.start - b.start)

  const found = new Map<number, MatchCollision[]>()
  const add = (id: number, collision: MatchCollision) => found.set(id, [...(found.get(id) ?? []), collision])
  const describe = (other: ScheduleDemoMatch) =>
    `${other.homeTeam?.name ?? 'Do ustalenia'} – ${other.awayTeam?.name ?? 'Do ustalenia'} (${other.round.name})`

  for (let i = 0; i < windows.length; i++) {
    for (let j = i + 1; j < windows.length && windows[j].start < windows[i].end; j++) {
      const a = windows[i].match
      const b = windows[j].match
      const teams = new Set([a.homeTeam?.id, a.awayTeam?.id].filter((id) => id !== undefined))
      if ((b.homeTeam && teams.has(b.homeTeam.id)) || (b.awayTeam && teams.has(b.awayTeam.id))) {
        add(a.id, { type: 'team', matchId: b.id, title: `Kolizja drużyny: ${describe(b)}` })
        add(b.id, { type: 'team', matchId: a.id, title: `Kolizja drużyny: ${describe(a)}` })
      }
      if (a.venue && b.venue && a.venue.id === b.venue.id) {
        add(a.id, { type: 'venue', matchId: b.id, title: `Kolizja boiska: ${describe(b)}` })
        add(b.id, { type: 'venue', matchId: a.id, title: `Kolizja boiska: ${describe(a)}` })
      }
    }
  }

  return matches.map((match) => ({ ...match, collisions: found.get(match.id) ?? [] }))
}

/** Kolejki z meczów, tak jak liczy je panel: zakres dat, kolizje i „zakończone/wszystkie”. */
export function scheduleRounds(matches: ScheduleDemoMatch[]): RoundSummary[] {
  const byRound = new Map<number, ScheduleDemoMatch[]>()
  for (const match of matches) byRound.set(match.round.id, [...(byRound.get(match.round.id) ?? []), match])
  return [...byRound.values()].map((roundMatches) => ({
    id: roundMatches[0].round.id,
    name: roundMatches[0].round.name,
    dates: formatRoundDates(roundMatches.map((match) => match.kickoffAt), scheduleTimeZone),
    finished: roundMatches.filter((match) => match.status === 'finished').length,
    total: roundMatches.length,
    collisions: roundMatches.filter((match) => (match.collisions?.length ?? 0) > 0).length,
  }))
}

// --- Strona publiczna (#206) -------------------------------------------------

/** Turniej strony publicznej, w kształcie `PublicTournament` z przykładu `pilka` w kontrakcie. */
export const publicTournament: PublicShellTournament = {
  name: tournament.name,
  slug: tournament.slug,
  status: 'active',
  sport: { code: 'football', name: 'Piłka nożna' },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
}

/** Mecz strony publicznej: `Match` z kontraktu, czyli bez kolizji panelu. */
function withoutCollisions({ collisions: _collisions, ...match }: ScheduleDemoMatch): ScheduleDemoMatch {
  return match
}

/** Termin rosnąco, mecz bez terminu na końcu, remis po kolejce — tak sortuje API. */
function byKickoff(a: ScheduleDemoMatch, b: ScheduleDemoMatch): number {
  if (a.kickoffAt === b.kickoffAt) return a.round.order - b.round.order
  if (a.kickoffAt === null) return 1
  if (b.kickoffAt === null) return -1
  return a.kickoffAt.localeCompare(b.kickoffAt)
}

/**
 * `GET /public/t/{slug}/fixtures` sezonu w trakcie: mecze zaplanowane
 * i trwające, rosnąco po terminie, bez terminu na końcu.
 */
export const publicFixtures: ScheduleDemoMatch[] = scheduleInProgress
  .filter((match) => match.status !== 'finished')
  .map(withoutCollisions)
  .toSorted(byKickoff)

/** `GET /public/t/{slug}/results` sezonu w trakcie: mecze zakończone, malejąco po terminie. */
export const publicResults: ScheduleDemoMatch[] = scheduleInProgress
  .filter((match) => match.status === 'finished')
  .map(withoutCollisions)
  .toSorted((a, b) => byKickoff(b, a))

// --- Zdarzenia meczu (#200) --------------------------------------------------

/** Typy zdarzeń sportów, dosłownie z przykładu `GET /sports` w kontrakcie. */
export const eventTypesBySport: Record<'football' | 'basketball', EventTypeOption[]> = {
  football: [
    { code: 'goal', label: 'Bramka', hasPlayer: true, value: 1, stat: 'goals' },
    { code: 'own_goal', label: 'Bramka samobójcza', hasPlayer: true, value: 1, stat: null },
    { code: 'yellow_card', label: 'Żółta kartka', hasPlayer: true, value: 1, stat: 'yellowCards' },
    { code: 'red_card', label: 'Czerwona kartka', hasPlayer: true, value: 1, stat: 'redCards' },
  ],
  basketball: [
    { code: 'free_throw', label: 'Rzut wolny', hasPlayer: true, value: 1, stat: 'points' },
    { code: 'two_pointer', label: 'Rzut za 2', hasPlayer: true, value: 2, stat: 'points' },
    { code: 'three_pointer', label: 'Rzut za 3', hasPlayer: true, value: 3, stat: 'points' },
    { code: 'foul', label: 'Faul', hasPlayer: true, value: 1, stat: 'fouls' },
  ],
}

/**
 * Statystyka-zdobycz sportu: pierwszy wpis `availableStats` (#190), czyli
 * bramki w piłce i punkty w koszu. Jej typy dostają wyróżnione przyciski.
 */
export const scoringStatBySport: Record<'football' | 'basketball', string> = {
  football: 'goals',
  basketball: 'points',
}

const ROSTER_FIRST = ['Jan', 'Piotr', 'Marek', 'Tomasz', 'Kamil', 'Paweł', 'Adam', 'Michał', 'Łukasz', 'Bartosz', 'Szymon']
const ROSTER_LAST = ['Kowalski', 'Nowak', 'Wiśniewski', 'Wójcik', 'Kamiński', 'Lewandowski', 'Zieliński', 'Szymański', 'Woźniak', 'Dąbrowski', 'Mazur']

/**
 * Skład drużyny do siatki numerów: jedenastu zawodników, dwóch ostatnich bez
 * numeru, w kolejności z API (numery rosnąco, bez numeru na końcu).
 * Deterministyczny, żeby snapshoty Chromatica się nie zmieniały.
 */
export function demoRoster(teamId: number): RosterPlayer[] {
  return ROSTER_FIRST.map((first, index) => ({
    id: teamId * 100 + index + 1,
    name: `${first} ${ROSTER_LAST[(index + teamId) % ROSTER_LAST.length]}`,
    number: index < 9 ? index * 2 + 1 + (teamId % 2) : null,
  }))
}

/** Mecz w trakcie z terminarza demo — na nim okno meczu pokazuje zdarzenia. */
export const matchInProgress: ScheduleDemoMatch = scheduleInProgress.find((match) => match.status === 'live')!

/**
 * Zdarzenia meczu w trakcie (wynik 1:0): bramka gospodarza, kartka gościa
 * i kartka bez minuty, która stoi na końcu osi (#188, reguła 10).
 */
export const matchInProgressEvents: MatchEventRow[] = (() => {
  const home = matchInProgress.homeTeam!
  const away = matchInProgress.awayTeam!
  const homeRoster = demoRoster(home.id)
  const awayRoster = demoRoster(away.id)
  return [
    { id: 1, team: home, player: homeRoster[6], type: 'goal', typeLabel: 'Bramka', minute: 23 },
    { id: 2, team: away, player: awayRoster[3], type: 'yellow_card', typeLabel: 'Żółta kartka', minute: 31 },
    { id: 3, team: home, player: homeRoster[2], type: 'yellow_card', typeLabel: 'Żółta kartka', minute: null },
  ].map((event) => ({
    ...event,
    team: { id: event.team.id, name: event.team.name },
    player: { id: event.player.id, name: event.player.name },
  }))
})()
