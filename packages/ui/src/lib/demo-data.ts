// Spójne dane demo dla wszystkich ekranów (mock, docelowo z API).

import type { BracketMatchRowData } from '../components/data/bracket-match-row-data'
import type { Leaderboard, LeaderboardRow, StatOption } from '../components/data/leaderboard-data'
import type { EventTypeOption, MatchEventRow, RosterPlayer } from '../components/data/match-event-data'
import type { MatchPageData, MatchRelationEvent, MatchRelationPeriod } from '../components/data/match-page-data'
import type { MatchCollision, MatchRowData, MatchRowTeam, MatchScorer } from '../components/data/match-row-data'
import type { PlayerRow } from '../components/data/player-row'
import type { RegistrationRow } from '../components/data/registration-row'
import type { RoundSummary } from '../components/data/round-summary'
import type { StandingsTableRow } from '../components/data/standings-table-row'
import type { TeamRow } from '../components/data/team-row'
import type { TiebreakerItem } from '../components/data/tiebreaker-item'
import type { TournamentRow } from '../components/data/tournament-row'
import type { VenueRow } from '../components/data/venue-row'
import type { FormResult } from '../public/form'
import type { PublicShellTournament } from '../public/public-shell-tournament'
import type { ScheduleProgress } from '../public/schedule-progress'
import type { StandingsTableRow as PublicStandingsTableRow } from '../public/standings-table-row'
import { bracketPosition, bracketSeedPositions, bracketSize, bracketWinnerSide, type BracketMatch } from './bracket'
import { formatRoundDates } from './kickoff'
import { periodLabel, type MatchClockSettings } from './match-clock'
import type { SetFormat } from './sets'

export type MatchStatus = 'scheduled' | 'live' | 'finished'

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
  { pos: 1, team: teams[0], p: 5, w: 4, d: 1, l: 0, gf: 12, ga: 4, pts: 13, form: ['win', 'win', 'draw', 'win', 'win'] },
  { pos: 2, team: teams[1], p: 5, w: 3, d: 1, l: 1, gf: 9, ga: 6, pts: 10, form: ['win', 'loss', 'win', 'draw', 'win'] },
  { pos: 3, team: teams[2], p: 5, w: 3, d: 1, l: 1, gf: 8, ga: 7, pts: 10, form: ['win', 'win', 'loss', 'draw', 'win'] },
  { pos: 4, team: teams[3], p: 5, w: 2, d: 0, l: 3, gf: 7, ga: 8, pts: 6, form: ['loss', 'win', 'loss', 'win', 'loss'] },
  { pos: 5, team: teams[5], p: 5, w: 2, d: 0, l: 3, gf: 6, ga: 9, pts: 6, form: ['loss', 'win', 'loss', 'loss', 'win'] },
  { pos: 6, team: teams[6], p: 5, w: 1, d: 2, l: 2, gf: 5, ga: 7, pts: 5, form: ['draw', 'loss', 'draw', 'win', 'loss'] },
  { pos: 7, team: teams[7], p: 5, w: 1, d: 1, l: 3, gf: 4, ga: 8, pts: 4, form: ['loss', 'loss', 'win', 'draw', 'loss'] },
  { pos: 8, team: teams[4], p: 5, w: 0, d: 0, l: 5, gf: 3, ga: 14, pts: 0, form: ['loss', 'loss', 'loss', 'loss', 'loss'] },
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

// Tabela grupy (#259): cztery drużyny, wychodzą dwie. Miejsca 2 i 3 mają po
// 4 punkty, więc linia wyjścia przecina remis — `withQualifiers` daje im
// plakietkę „remis na linii”.
export const groupStandingsQualifiers = 2

export const groupStandingsTableRows: StandingsTableRow[] = [
  { position: 1, team: { id: 21, name: 'Wilki Bemowo', logoUrl: null }, played: 3, won: 3, drawn: 0, lost: 0, scoreFor: 7, scoreAgainst: 1, scoreDifference: 6, points: 9 },
  { position: 2, team: { id: 22, name: 'Sokoły Ursus', logoUrl: null }, played: 3, won: 1, drawn: 1, lost: 1, scoreFor: 4, scoreAgainst: 4, scoreDifference: 0, points: 4 },
  { position: 3, team: { id: 23, name: 'Orły Bielany', logoUrl: null }, played: 3, won: 1, drawn: 1, lost: 1, scoreFor: 3, scoreAgainst: 4, scoreDifference: -1, points: 4 },
  { position: 4, team: { id: 24, name: 'Lwy Targówek', logoUrl: null }, played: 3, won: 0, drawn: 0, lost: 3, scoreFor: 2, scoreAgainst: 7, scoreDifference: -5, points: 0 },
]

// Tabele grup z przykładu `grupy` w kontrakcie (#268): dwie grupy po cztery,
// z każdej wychodzą dwie, faza grupowa rozegrana.
/** Tabela grupy demo: nazwa, liczba wychodzących (`Group.qualifiers`) i wiersze z `/standings`. */
export type GroupStandings = {
  id: number
  name: string
  qualifiers: number
  rows: StandingsTableRow[]
}

export const groupStandings: GroupStandings[] = [
  {
    id: 1,
    name: 'Grupa A',
    qualifiers: 2,
    rows: [
      { position: 1, team: { id: 2, name: 'Sokoły Ursus', logoUrl: null }, played: 3, won: 2, drawn: 1, lost: 0, scoreFor: 5, scoreAgainst: 2, scoreDifference: 3, points: 7 },
      { position: 2, team: { id: 1, name: 'Wilki Bemowo', logoUrl: null }, played: 3, won: 1, drawn: 2, lost: 0, scoreFor: 5, scoreAgainst: 2, scoreDifference: 3, points: 5 },
      { position: 3, team: { id: 3, name: 'Orły Bielany', logoUrl: null }, played: 3, won: 1, drawn: 1, lost: 1, scoreFor: 4, scoreAgainst: 3, scoreDifference: 1, points: 4 },
      { position: 4, team: { id: 4, name: 'Rysie Wola', logoUrl: null }, played: 3, won: 0, drawn: 0, lost: 3, scoreFor: 0, scoreAgainst: 7, scoreDifference: -7, points: 0 },
    ],
  },
  {
    id: 2,
    name: 'Grupa B',
    qualifiers: 2,
    rows: [
      { position: 1, team: { id: 5, name: 'Żubry Praga', logoUrl: null }, played: 3, won: 3, drawn: 0, lost: 0, scoreFor: 6, scoreAgainst: 1, scoreDifference: 5, points: 9 },
      { position: 2, team: { id: 7, name: 'Lwy Ochota', logoUrl: null }, played: 3, won: 1, drawn: 1, lost: 1, scoreFor: 3, scoreAgainst: 3, scoreDifference: 0, points: 4 },
      { position: 3, team: { id: 6, name: 'Niedźwiedzie Mokotów', logoUrl: null }, played: 3, won: 1, drawn: 0, lost: 2, scoreFor: 4, scoreAgainst: 5, scoreDifference: -1, points: 3 },
      { position: 4, team: { id: 8, name: 'Jastrzębie Wawer', logoUrl: null }, played: 3, won: 0, drawn: 1, lost: 2, scoreFor: 1, scoreAgainst: 5, scoreDifference: -4, points: 1 },
    ],
  },
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

// Obiekty turnieju w kształcie `VenueRow`. Hala bez adresu pokazuje stan
// `address: null`, który kontrakt dopuszcza.
export const venueRows: VenueRow[] = [
  { id: 1, name: 'Boisko A', address: 'ul. Sportowa 1' },
  { id: 2, name: 'Boisko B', address: 'ul. Parkowa 12' },
  { id: 3, name: 'Hala Miejska', address: null },
]

// Zgłoszenia drużyn (#300) w kształcie `RegistrationRow`, przepisane
// z przykładu `GET /tournaments/{tournament}/registrations`: odrzucone
// (bez danych osobowych), przyjęte i dwa oczekujące, od najstarszego.
export const registrationRows: RegistrationRow[] = [
  {
    id: 3,
    teamName: 'Rysie Wola',
    status: 'rejected',
    contact: null,
    players: [],
    createdAt: '2026-10-02T09:15:00+00:00',
    decidedAt: '2026-10-03T18:00:00+00:00',
  },
  {
    id: 4,
    teamName: 'Żubry Targówek',
    status: 'accepted',
    contact: { name: 'Tomasz Zieliński', email: 'tomasz.zielinski@example.com', phone: null },
    players: [{ name: 'Tomasz Zieliński', number: 1 }],
    createdAt: '2026-10-04T12:00:00+00:00',
    decidedAt: '2026-10-05T08:30:00+00:00',
  },
  {
    id: 5,
    teamName: 'Lwy Mokotów',
    status: 'pending',
    contact: { name: 'Anna Wiśniewska', email: 'anna.wisniewska@example.com', phone: '+48 600 100 200' },
    players: [
      { name: 'Paweł Lis', number: 1 },
      { name: 'Kamil Dąb', number: 9 },
      { name: 'Igor Wrzos', number: null },
    ],
    createdAt: '2026-10-10T17:42:00+00:00',
    decidedAt: null,
  },
  {
    id: 6,
    teamName: 'Smoki Ochota',
    status: 'pending',
    contact: { name: 'Michał Kruk', email: 'michal.kruk@example.com', phone: null },
    players: [],
    createdAt: '2026-10-12T08:05:00+00:00',
    decidedAt: null,
  },
]

// Ustawienia turnieju w sporcie demo, w kształcie `SportConfig` z kontraktu
// (przykład `GET /sports`), ograniczone do tego, co pokazuje ekran ustawień.
// Tiebreaki to domyślna kolejność sportu z etykietami z `tiebreakerLabels`
// (#117) — tymi samymi, które niesie `StandingTable.tiebreakers`.
export type DemoSportSettings = {
  name: string
  allowsDraw: boolean
  /** W sporcie z setami (#301) także punkty za wygraną i porażkę w secie decydującym. */
  defaultPoints: { win: number; draw: number; loss: number; winDecidingSet?: number; lossDecidingSet?: number }
  /** `SportConfig.defaultSetFormat`: format seta sportu z setami, w pozostałych brak. */
  setFormat?: SetFormat
  /** `SportConfig.defaultMatchDuration`: długość meczu w minutach razem z przerwą. */
  defaultMatchDuration: number
  /** `StandingTable.rallyPointsLabel`: kolumna punktów w setach, tylko w sporcie z setami. */
  rallyPointsLabel?: string
  tiebreakers: TiebreakerItem[]
  /**
   * `availableTiebreakers` z etykietami, w kolejności sportu: z tego
   * wybiera edytor przy tabeli (#173).
   */
  availableTiebreakers: TiebreakerItem[]
  /** `StandingTable.scoreLabel` w turnieju tego sportu (ADR-0006). */
  scoreLabel: string
}

export const sportSettings: Record<'football' | 'basketball' | 'volleyball', DemoSportSettings> = {
  football: {
    name: 'Piłka nożna',
    allowsDraw: true,
    defaultPoints: { win: 3, draw: 1, loss: 0 },
    defaultMatchDuration: 60,
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
    defaultMatchDuration: 40,
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
  volleyball: {
    name: 'Siatkówka',
    allowsDraw: false,
    defaultPoints: { win: 3, draw: 0, loss: 0, winDecidingSet: 2, lossDecidingSet: 1 },
    setFormat: { setsToWin: 3, setPoints: 25, decidingSetPoints: 15, minLead: 2 },
    defaultMatchDuration: 90,
    rallyPointsLabel: 'Punkty w setach',
    tiebreakers: [
      { code: 'points', label: 'Punkty w tabeli' },
      { code: 'wins', label: 'Zwycięstwa' },
      { code: 'set_ratio', label: 'Stosunek setów' },
      { code: 'point_ratio', label: 'Stosunek punktów w setach' },
      { code: 'head_to_head', label: 'Bezpośredni mecz' },
    ],
    availableTiebreakers: [
      { code: 'points', label: 'Punkty w tabeli' },
      { code: 'wins', label: 'Zwycięstwa' },
      { code: 'set_ratio', label: 'Stosunek setów' },
      { code: 'point_ratio', label: 'Stosunek punktów w setach' },
      { code: 'head_to_head', label: 'Bezpośredni mecz' },
    ],
    scoreLabel: 'Sety',
  },
}

// Szkic kolejności w podglądzie (#173): różnica bramek przed meczem
// bezpośrednim. Według niego ułożone jest `standingsTablePreviewRows`.
export const standingsTablePreviewDraft = ['points', 'score_diff', 'head_to_head', 'score_for']

// Lista turniejów organizera (ekran startowy panelu). Kształt zgodny
// z `Tournament` z kontraktu, ograniczony do pól, które pokazuje tabela.
//
// Jedno źródło dla tabeli turniejów i dla ekranu Dashboardu
// (`screens/admin-dashboard.tsx`) oraz dla listy bieżących w sidebarze
// (`screens/shell-demo.tsx`), więc lista jest jedna.
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

/** Drużyna meczu makiety: herb ma tylko FC Górka, jak w `teamRows`. */
function scheduleTeam(seat: number): MatchRowTeam {
  const { id, name } = teams[seat - 1]
  return { id, name, logoUrl: id === 1 ? demoTeamLogoUrl : null }
}

/** Cały sezon bez dat i obiektów, tak jak oddaje go generator (#157). */
export const scheduleUndated: ScheduleDemoMatch[] = bergerPairs(teams.length).flatMap((pairs, index) =>
  pairs.map(([home, away], position) => ({
    id: index * 10 + position + 1,
    round: { id: index + 1, name: `Kolejka ${index + 1}`, order: index + 1 },
    homeTeam: scheduleTeam(home),
    awayTeam: scheduleTeam(away),
    homeScore: null,
    awayScore: null,
    status: 'scheduled' as const,
    kickoffAt: null,
    venue: null,
  })),
)

/** Start 2. połowy meczu trwającego demo: 55 minut po rozpoczęciu (45 gry i 10 przerwy). */
const demoLiveHalfStart = Date.parse(demoKickoff(5, 2)) + 55 * 60_000

/**
 * „Teraz” zegara meczów demo (#297): 20 minut po starcie 2. połowy, więc mecz
 * trwający pokazuje 66′. Stała chwila, żeby obraz stories się nie zmieniał;
 * podaje ją `MatchClockProvider` w dekoratorze stories strony publicznej.
 */
export const DEMO_CLOCK_NOW = new Date(demoLiveHalfStart + 20 * 60_000)

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
      const clock = { livePeriod: 2, periodStartedAt: new Date(demoLiveHalfStart).toISOString().replace('.000Z', '+00:00'), onBreak: false }
      return { ...dated, status: 'live' as const, homeScore: 1, awayScore: 0, ...clock }
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

// --- Strzelcy przy wyniku (#208) ---------------------------------------------

/** Zdarzenie liczone do strzelców: bramka albo samobój, z minutą lub bez. */
type ScoringEvent = { team: { id: number; name: string }; player: { id: number; name: string }; minute: number | null; ownGoal: boolean }

/**
 * Wiersze strzelców tak, jak składa je serwer: jeden na zawodnika, samobój
 * osobno, minuty rosnąco, wiersze po pierwszej minucie, bez minut na końcu,
 * remis po id zawodnika.
 */
function scorersFromEvents(events: ScoringEvent[]): MatchScorer[] {
  const rows = new Map<string, MatchScorer>()
  for (const event of events) {
    const key = `${event.player.id}-${event.ownGoal}`
    const row = rows.get(key) ?? { team: event.team, player: event.player, value: 0, minutes: [], ownGoal: event.ownGoal }
    row.value += 1
    if (event.minute !== null) row.minutes = [...row.minutes, event.minute].toSorted((a, b) => a - b)
    rows.set(key, row)
  }
  const firstMinute = (row: MatchScorer) => row.minutes[0] ?? Number.POSITIVE_INFINITY
  return [...rows.values()].toSorted((a, b) => firstMinute(a) - firstMinute(b) || a.player.id - b.player.id)
}

/**
 * Strzelcy meczu demo, zgodni z jego wynikiem. Mecz w trakcie bierze bramki
 * z `matchInProgressEvents`. W zakończonych bramki rozdziela deterministyczny
 * przepis, a co czwarty mecz ma samobój, co piąty bramkę bez minuty — żeby
 * makieta Wyników pokazała oba przypadki.
 */
function demoScorers(match: ScheduleDemoMatch): MatchScorer[] {
  if (match.id === matchInProgress.id) {
    return scorersFromEvents(
      matchInProgressEvents
        .filter((event) => event.type === 'goal' && event.player)
        .map((event) => ({ team: event.team, player: event.player!, minute: event.minute, ownGoal: false })),
    )
  }
  if (match.status !== 'finished' || !match.homeTeam || !match.awayTeam) return []

  const goals = (team: { id: number; name: string }, count: number, offset: number): ScoringEvent[] =>
    Array.from({ length: count }, (_, index) => {
      const player = demoRoster(team.id)[6 + ((match.id + index + offset) % 5)]!
      return {
        team: { id: team.id, name: team.name },
        player: { id: player.id, name: player.name },
        minute: 3 + ((match.id * 13 + index * 29 + offset * 7) % 87),
        ownGoal: false,
      }
    })

  const home = goals(match.homeTeam, match.homeScore ?? 0, 0)
  const away = goals(match.awayTeam, match.awayScore ?? 0, 2)
  if (match.id % 4 === 0 && home.length > 0) {
    const unlucky = demoRoster(match.awayTeam.id)[3]!
    home[0] = { ...home[0]!, team: { id: match.awayTeam.id, name: match.awayTeam.name }, player: { id: unlucky.id, name: unlucky.name }, ownGoal: true }
  }
  if (match.id % 5 === 0 && away.length > 0) away[0] = { ...away[0]!, minute: null }

  return scorersFromEvents([...home, ...away])
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

/**
 * Mecz strony publicznej: `PublicMatch` z kontraktu, czyli bez kolizji panelu,
 * za to ze strzelcami (#208).
 */
function asPublicMatch({ collisions: _collisions, ...match }: ScheduleDemoMatch): ScheduleDemoMatch {
  return { ...match, scorers: demoScorers(match) }
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
  .map(asPublicMatch)
  .toSorted(byKickoff)

/** `GET /public/t/{slug}/results` sezonu w trakcie: mecze zakończone, malejąco po terminie. */
export const publicResults: ScheduleDemoMatch[] = scheduleInProgress
  .filter((match) => match.status === 'finished')
  .map(asPublicMatch)
  .toSorted((a, b) => byKickoff(b, a))

// --- Tabela strony publicznej (#291) ----------------------------------------

/**
 * Tabela ligi demo liczona z meczów terminarza demo tymi samymi regułami co
 * backend (`StandingsCalculator`): bilans i forma tylko z meczów `finished`,
 * forma po kolejce (najnowszy wynik na końcu, najwyżej pięć), kolejność po
 * punktach, bilansie i zdobyczach, na końcu po nazwie. Dzięki temu forma,
 * liczby wiersza i fakty w nagłówku zgadzają się z Wynikami demo.
 */
function demoLeagueTable(
  matches: readonly ScheduleDemoMatch[],
  entrants: readonly MatchRowTeam[] = teamRows,
  points: Record<FormResult, number> = { win: 3, draw: 1, loss: 0 },
): PublicStandingsTableRow[] {
  const finished = matches
    .filter((match) => match.status === 'finished')
    .toSorted((a, b) => a.round.order - b.round.order || a.id - b.id)
  const rows = entrants.map((team) => ({
    team: { id: team.id, name: team.name, logoUrl: team.logoUrl },
    played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, points: 0,
    results: [] as FormResult[],
  }))
  const byId = new Map(rows.map((row) => [row.team.id, row]))
  const record = (teamId: number | undefined, scored: number, conceded: number) => {
    const row = teamId === undefined ? undefined : byId.get(teamId)
    if (!row) return
    const result: FormResult = scored > conceded ? 'win' : scored < conceded ? 'loss' : 'draw'
    row.played++
    row.scoreFor += scored
    row.scoreAgainst += conceded
    row[result === 'win' ? 'won' : result === 'loss' ? 'lost' : 'drawn']++
    row.points += points[result]
    row.results.push(result)
  }
  for (const match of finished) {
    record(match.homeTeam?.id, match.homeScore!, match.awayScore!)
    record(match.awayTeam?.id, match.awayScore!, match.homeScore!)
  }
  return rows
    .map(({ results, ...row }) => ({ ...row, scoreDifference: row.scoreFor - row.scoreAgainst, form: results.slice(-5) }))
    .toSorted(
      (a, b) =>
        b.points - a.points ||
        b.scoreDifference - a.scoreDifference ||
        b.scoreFor - a.scoreFor ||
        a.team.name.localeCompare(b.team.name, 'pl'),
    )
    .map((row, index) => ({ ...row, position: index + 1 }))
}

/** Sezon zakończony: cały terminarz rozegrany, wyniki tym samym przepisem co w trakcie. */
export const scheduleFinished: ScheduleDemoMatch[] = scheduleInProgress.map((match) => ({
  ...match,
  status: 'finished' as const,
  homeScore: match.homeScore ?? (match.id * 7) % 4,
  awayScore: match.awayScore ?? (match.id * 3) % 3,
}))

/** Sezon przed startem: terminarz z datami, bez żadnego wyniku. */
export const scheduleBeforeStart: ScheduleDemoMatch[] = scheduleInProgress.map((match) => ({
  ...match,
  status: 'scheduled' as const,
  homeScore: null,
  awayScore: null,
}))

/**
 * `GET /public/t/{slug}/standings` ligi demo w trzech chwilach sezonu,
 * z terminarza demo (`scheduleInProgress` i pochodnych).
 */
export const publicStandingsRows = {
  inProgress: demoLeagueTable(scheduleInProgress),
  finished: demoLeagueTable(scheduleFinished),
  beforeStart: demoLeagueTable(scheduleBeforeStart),
}

/** Kryteria ligi demo jak w `StandingTable.tiebreakers`: pierwsze zawsze `points`. */
export const publicStandingsTiebreakers = [
  { code: 'points', label: 'Punkty w tabeli' },
  { code: 'head_to_head', label: 'Bezpośredni mecz' },
  { code: 'score_diff', label: 'Różnica bramek' },
  { code: 'score_for', label: 'Bramki zdobyte' },
]

/**
 * Tabela ligi koszykówki (`basketballStandingsTableRows`) z formą zgodną
 * z bilansem wierszy; bez remisów, bo koszykówka ich nie zna. Trzy z sześciu
 * kolejek rozegrane.
 */
export const publicBasketballStandingsRows: PublicStandingsTableRow[] = basketballStandingsTableRows.map((row, index) => ({
  ...row,
  form: ([['win', 'win', 'win'], ['win', 'loss', 'win'], ['loss', 'win', 'loss'], ['loss', 'loss', 'loss']] as const)[index]!,
}))

export const publicBasketballSchedule: ScheduleProgress = { roundsPlayed: 3, roundsTotal: 6, startsAt: null }

export const publicBasketballTiebreakers = [
  { code: 'points', label: 'Punkty w tabeli' },
  { code: 'head_to_head', label: 'Bezpośredni mecz' },
  { code: 'score_diff', label: 'Różnica punktów' },
]

/**
 * Tabele grup z przykładu `grupy` w kontrakcie (`groupStandings`) z tą samą
 * formą co przykład: faza grupowa rozegrana, trzy kolejki.
 */
const GROUP_FORMS: Record<number, readonly FormResult[]> = {
  2: ['draw', 'win', 'win'],
  1: ['draw', 'win', 'draw'],
  3: ['win', 'loss', 'draw'],
  4: ['loss', 'loss', 'loss'],
  5: ['win', 'win', 'win'],
  7: ['draw', 'loss', 'win'],
  6: ['loss', 'win', 'loss'],
  8: ['draw', 'loss', 'loss'],
}

export const publicGroupStandings = groupStandings.map((group) => ({
  ...group,
  rows: group.rows.map((row): PublicStandingsTableRow => ({ ...row, form: GROUP_FORMS[row.team.id] ?? [] })),
}))

export const publicGroupSchedule: ScheduleProgress = { roundsPlayed: 3, roundsTotal: 3, startsAt: null }

// --- Drabinka pucharu (#227) -------------------------------------------------

// Puchar sześciu drużyn z `teams` (seedy 1–6) z meczem o 3. miejsce, w kształcie
// z generatora (#215): drabinka na osiem, więc w ćwierćfinale grają pozycje
// 2 i 4, a seedy 1 i 2 stoją od razu w półfinałach. Stan jak w przykładzie
// `puchar` z kontraktu: ćwierćfinały rozegrane (jeden po karnych), pierwszy
// półfinał też. Etykiety i krawędzie są gotowymi napisami, bo tak dostaje je
// `BracketMatchRow` od ekranu.
const seed = (n: number) => {
  const { id, name } = teams[n - 1]!
  return { id, name }
}

const cupMatch = (match: Omit<BracketMatchRowData, 'homePenalties' | 'awayPenalties'> & Partial<BracketMatchRowData>): BracketMatchRowData => ({
  homePenalties: null,
  awayPenalties: null,
  ...match,
})

const cupQuarterFinals: BracketMatchRowData[] = [
  cupMatch({
    id: 102,
    label: 'Ćwierćfinał 2',
    kickoffAt: '2026-10-03T10:00:00+00:00',
    status: 'finished',
    home: { team: seed(4) },
    away: { team: seed(5) },
    homeScore: 2,
    awayScore: 2,
    homePenalties: 4,
    awayPenalties: 3,
    winnerTo: 'Półfinał 1',
  }),
  cupMatch({
    id: 104,
    label: 'Ćwierćfinał 4',
    kickoffAt: '2026-10-03T12:00:00+00:00',
    status: 'finished',
    home: { team: seed(3) },
    away: { team: seed(6) },
    homeScore: 1,
    awayScore: 0,
    winnerTo: 'Półfinał 2',
  }),
]

const cupSemiFinals: BracketMatchRowData[] = [
  cupMatch({
    id: 201,
    label: 'Półfinał 1',
    kickoffAt: '2026-10-10T10:00:00+00:00',
    status: 'finished',
    home: { team: seed(1) },
    away: { team: seed(4) },
    homeScore: 3,
    awayScore: 1,
    winnerTo: 'Finał',
    loserTo: 'o 3. miejsce',
  }),
  cupMatch({
    id: 202,
    label: 'Półfinał 2',
    kickoffAt: '2026-10-10T12:00:00+00:00',
    status: 'scheduled',
    home: { team: seed(2) },
    away: { team: seed(3) },
    homeScore: null,
    awayScore: null,
    winnerTo: 'Finał',
    loserTo: 'o 3. miejsce',
  }),
]

// Mecz o 3. miejsce gra przed finałem, więc stoi nad nim (#227).
const cupFinalRound: BracketMatchRowData[] = [
  cupMatch({
    id: 302,
    label: 'Mecz o 3. miejsce',
    kickoffAt: '2026-10-17T10:00:00+00:00',
    status: 'scheduled',
    home: { team: seed(4) },
    away: { team: null, source: 'Przegrany: Półfinał 2' },
    homeScore: null,
    awayScore: null,
  }),
  cupMatch({
    id: 301,
    label: 'Finał',
    kickoffAt: '2026-10-17T12:00:00+00:00',
    status: 'scheduled',
    home: { team: seed(1) },
    away: { team: null, source: 'Zwycięzca: Półfinał 2' },
    homeScore: null,
    awayScore: null,
  }),
]

function cupRound(id: number, name: string, matches: BracketMatchRowData[]): { summary: RoundSummary; matches: BracketMatchRowData[] } {
  return {
    summary: {
      id,
      name,
      dates: formatRoundDates(matches.map((match) => match.kickoffAt), scheduleTimeZone),
      finished: matches.filter((match) => match.status === 'finished').length,
      total: matches.length,
    },
    matches,
  }
}

/** Rundy drabinki sześciu drużyn w trakcie, po `order`. */
export const cupRounds = [
  cupRound(10, 'Ćwierćfinał', cupQuarterFinals),
  cupRound(11, 'Półfinał', cupSemiFinals),
  cupRound(12, 'Finał', cupFinalRound),
]

/** Wolne losy tej drabinki: notka pod 1. i 2. rundą. */
export const cupByes = [
  { team: seed(1).name, target: 'Półfinał 1' },
  { team: seed(2).name, target: 'Półfinał 2' },
]

/** Ta sama drabinka rozegrana do końca: finał po karnych, mistrzem seed 1. */
export const cupFinishedRounds = [
  cupRounds[0]!,
  cupRound(11, 'Półfinał', [cupSemiFinals[0]!, { ...cupSemiFinals[1]!, status: 'finished', homeScore: 2, awayScore: 0 }]),
  cupRound(12, 'Finał', [
    { ...cupFinalRound[0]!, status: 'finished', away: { team: seed(3) }, homeScore: 0, awayScore: 2 },
    {
      ...cupFinalRound[1]!,
      status: 'finished',
      away: { team: seed(2) },
      homeScore: 1,
      awayScore: 1,
      homePenalties: 5,
      awayPenalties: 4,
    },
  ]),
]

export const cupChampion = seed(1)

// --- Strona meczu (#210) -----------------------------------------------------

/** Typ zdarzenia demo: etykieta i zdobycz (0 — zdarzenie nie zmienia wyniku). */
const PAGE_EVENT_TYPES: Record<string, { label: string; value: number }> = {
  goal: { label: 'Bramka', value: 1 },
  own_goal: { label: 'Bramka samobójcza', value: 1 },
  yellow_card: { label: 'Żółta kartka', value: 0 },
  red_card: { label: 'Czerwona kartka', value: 0 },
  free_throw: { label: 'Rzut wolny', value: 1 },
  two_pointer: { label: 'Rzut za 2', value: 2 },
  three_pointer: { label: 'Rzut za 3', value: 3 },
  foul: { label: 'Faul', value: 0 },
}

/** Zdarzenie demo: minuta, strona drużyny zdarzenia, zawodnik (indeks w składzie) i typ. */
type PageEventSpec = [minute: number | null, side: 'home' | 'away', player: number, type: string]

/**
 * Strona meczu tak, jak składa ją serwer (`MatchRelation`): kolejność osi,
 * część z minuty i podziału turnieju, wynik po zdarzeniu, wyniki części
 * i strzelcy. Wynik meczu to suma zdarzeń, więc demo jest zgodne z tablicą.
 */
function demoMatchPage(
  base: Omit<MatchPageData, 'events' | 'periods' | 'scorers' | 'homeScore' | 'awayScore'>,
  specs: PageEventSpec[],
  periods: { count: number; minutes: number | null },
): MatchPageData {
  const teams = { home: base.homeTeam!, away: base.awayTeam! }
  const ordered = specs
    .map((spec, index) => ({ spec, id: index + 1 }))
    .toSorted((a, b) => (a.spec[0] ?? Infinity) - (b.spec[0] ?? Infinity) || a.id - b.id)

  let home = 0
  let away = 0
  const periodScores = new Map<number, [number, number]>()
  const scorers = new Map<string, MatchScorer>()
  const events: MatchRelationEvent[] = ordered.map(({ spec: [minute, side, index, type], id }) => {
    const team = { id: teams[side].id, name: teams[side].name }
    const roster = demoRoster(team.id)
    const player = roster[index % roster.length]!
    const value = PAGE_EVENT_TYPES[type]!.value
    const ownGoal = type === 'own_goal'
    const forHome = (side === 'home') !== ownGoal
    const period = minute === null || periods.count === 1 ? null : Math.min(periods.count, Math.ceil(minute / periods.minutes!))
    if (period !== null) {
      const score = periodScores.get(period) ?? [0, 0]
      periodScores.set(period, forHome ? [score[0] + value, score[1]] : [score[0], score[1] + value])
    }
    let scoreAfter = null
    if (value > 0) {
      if (forHome) home += value
      else away += value
      scoreAfter = { home, away }
      const key = `${player.id}-${ownGoal}`
      const row = scorers.get(key) ?? { team, player: { id: player.id, name: player.name }, value: 0, minutes: [], ownGoal }
      scorers.set(key, { ...row, value: row.value + value, minutes: minute === null ? row.minutes : [...row.minutes, minute] })
    }
    return { id, team, player: { id: player.id, name: player.name }, type, typeLabel: PAGE_EVENT_TYPES[type]!.label, minute, period, scoreAfter }
  })

  const relationPeriods: MatchRelationPeriod[] = [...periodScores.entries()]
    .toSorted(([a], [b]) => a - b)
    .map(([number, [homeScore, awayScore]]) => ({
      number,
      label: periodLabel(number, periods.count),
      homeScore,
      awayScore,
    }))
  const firstMinute = (row: MatchScorer) => row.minutes[0] ?? Number.POSITIVE_INFINITY

  return {
    ...base,
    homeScore: home,
    awayScore: away,
    scorers: [...scorers.values()].toSorted((a, b) => firstMinute(a) - firstMinute(b) || a.player.id - b.player.id),
    events,
    periods: relationPeriods,
  }
}

/** Mecz demo jako baza strony meczu: z herbami z danych drużyn. */
function pageBase(match: ScheduleDemoMatch, status: MatchPageData['status']) {
  const team = (summary: { id: number; name: string }) => ({ ...summary, logoUrl: null })
  return { ...match, status, collisions: undefined, homeTeam: team(match.homeTeam!), awayTeam: team(match.awayTeam!) }
}

/** Podział meczu demo: piłka 2 × 45, kosz 4 × 10 — domyślne sportów. */
export const demoPeriods = {
  football: { count: 2, minutes: 45 },
  basketball: { count: 4, minutes: 10 },
  volleyball: { count: 1, minutes: null },
} as const

/** Ustawienia zegara demo (#297): podział meczu, długość i `runningClock` sportu, jak w `PublicTournament`. */
export const demoClockSettings = {
  football: { periods: demoPeriods.football, matchDuration: 60, runningClock: true },
  basketball: { periods: demoPeriods.basketball, matchDuration: 40, runningClock: false },
} satisfies Record<string, MatchClockSettings>

/**
 * Piłka po meczu: bramki obu drużyn, samobój gościa, kartki i kartka bez
 * minuty, która stoi na końcu, w „Bez minuty”.
 */
export const matchPageFinished: MatchPageData = demoMatchPage(
  pageBase(publicResults[0]!, 'finished'),
  [
    [9, 'home', 6, 'goal'],
    [27, 'away', 3, 'yellow_card'],
    [38, 'away', 7, 'goal'],
    [44, 'home', 2, 'yellow_card'],
    [51, 'away', 4, 'own_goal'],
    [67, 'home', 8, 'goal'],
    [90, 'away', 3, 'red_card'],
    [null, 'home', 9, 'yellow_card'],
  ],
  demoPeriods.football,
)

/** Piłka na żywo, w 2. połowie: relacja od najnowszego zdarzenia. */
export const matchPageLive: MatchPageData = demoMatchPage(
  pageBase(matchInProgress, 'live'),
  [
    [12, 'home', 6, 'goal'],
    [31, 'away', 3, 'yellow_card'],
    [49, 'away', 8, 'goal'],
    [58, 'home', 2, 'yellow_card'],
    [63, 'home', 7, 'goal'],
  ],
  demoPeriods.football,
)

/** Mecz zaplanowany: godzina w miejscu wyniku, bez strzelców i bez relacji. */
export const matchPageScheduled: MatchPageData = {
  ...demoMatchPage(pageBase(publicFixtures.find((match) => match.status === 'scheduled')!, 'scheduled'), [], demoPeriods.football),
  homeScore: null,
  awayScore: null,
}

/** Turniej koszykarski strony publicznej, ten sam co w przykładzie `koszykowka` kontraktu. */
export const publicBasketballTournament: PublicShellTournament = {
  ...publicTournament,
  name: 'Liga Koszykówki 2026',
  slug: 'liga-koszykowki-2026',
  sport: { code: 'basketball', name: 'Koszykówka' },
}

/**
 * Kosz po meczu: 32 zdarzenia w czterech kwartach, więc kwarty startują
 * zwinięte (#210), a na tablicy stoją wszyscy zawodnicy z punktami.
 */
export const matchPageBasketball: MatchPageData = demoMatchPage(
  {
    ...pageBase(publicResults[1]!, 'finished'),
    homeTeam: { id: 401, name: 'Żubry Wola', logoUrl: null },
    awayTeam: { id: 402, name: 'Rysie Mokotów', logoUrl: null },
    venue: { id: 41, name: 'Hala Bemowo' },
  },
  Array.from({ length: 32 }, (_, index): PageEventSpec => {
    const minute = 1 + Math.floor(index * 1.25)
    const side = index % 2 === 0 ? 'home' : 'away'
    const types = ['two_pointer', 'three_pointer', 'free_throw', 'foul', 'two_pointer']
    return [minute, side, 6 + (index % 5), types[index % types.length]!]
  }),
  demoPeriods.basketball,
)

// --- Drabinka strony publicznej (#234) ---------------------------------------

/** Puchar strony publicznej, ten sam co w przykładzie `puchar` kontraktu i w seedzie demo. */
export const publicCupTournament: PublicShellTournament = {
  ...publicTournament,
  name: 'Puchar Osiedlowy 2026',
  slug: 'puchar-osiedlowy-2026',
}

/** Puchar koszykarski: pole wyniku kafla bez miejsca na karne. */
export const publicBasketballCupTournament: PublicShellTournament = {
  ...publicCupTournament,
  name: 'Puchar Koszykówki 2026',
  slug: 'puchar-koszykowki-2026',
  sport: { code: 'basketball', name: 'Koszykówka' },
}

/** Drużyny przykładu `puchar` w kolejności rozstawienia (seedy 1–6). */
export const cupExampleTeams = ['Wilki Bemowo', 'Sokoły Ursus', 'Orły Bielany', 'Rysie Wola', 'Żubry Praga', 'Niedźwiedzie Mokotów'] as const

/**
 * Mecz pucharu demo w kształcie `Match` z kontraktu: pasuje i do reguł
 * drabinki (`BracketMatch`), i do wierszy Terminarza (`MatchInRound`).
 */
export type DemoBracketMatch = Omit<BracketMatch, 'homeTeam' | 'awayTeam'> & {
  /** Drużyna jak `TeamSummary` z kontraktu, bez wgranego herbu. */
  homeTeam: MatchRowTeam | null
  awayTeam: MatchRowTeam | null
  stageId: number
  venue: { id: number; name: string } | null
}

/**
 * Postęp pucharu demo: przed startem, po finale albo w trakcie rundy
 * `round` (po `order`), w której zakończonych jest pierwszych `finished`
 * meczów w kolejności gry, a następne `live` trwają. Wcześniejsze rundy są
 * rozegrane. W rundzie finału mecz o 3. miejsce gra przed finałem.
 */
export type DemoBracketProgress = 'before' | 'done' | { round: number; finished: number; live?: number }

export type DemoBracketOptions = {
  teams: number
  progress?: DemoBracketProgress
  /** Domyślnie tak, gdy drużyn jest co najmniej cztery. */
  thirdPlace?: boolean
  sport?: 'football' | 'basketball'
  /** Długie nazwy klubów: sprawdzają ucinanie i szerokość okna. */
  longNames?: boolean
  /** Nazwy w kolejności rozstawienia zamiast generowanych. */
  names?: readonly string[]
}

const BRACKET_NICKS = ['Wilki', 'Orły', 'Sokoły', 'Lwy', 'Żubry', 'Rysie', 'Jastrzębie', 'Niedźwiedzie', 'Pantery', 'Byki', 'Kruki', 'Borsuki', 'Dziki', 'Lisy', 'Tygrysy', 'Smoki']
const BRACKET_PLACES = ['Bemowo', 'Wola', 'Mokotów', 'Praga', 'Ursynów', 'Bielany', 'Targówek', 'Wawer', 'Ochota', 'Żoliborz', 'Białołęka', 'Wilanów', 'Rembertów', 'Ursus', 'Wesoła', 'Śródmieście']
const BRACKET_VENUES = [
  { id: 1, name: 'Boisko Bemowo' },
  { id: 2, name: 'Stadion OSiR Wola' },
  { id: 3, name: 'Hala Ursus' },
]

/** Nazwa rundy jak w generatorze (`BracketGenerator::roundName`). */
function demoRoundName(teamsInRound: number): string {
  if (teamsInRound === 2) return 'Finał'
  if (teamsInRound === 4) return 'Półfinał'
  if (teamsInRound === 8) return 'Ćwierćfinał'
  return `1/${teamsInRound / 2} finału`
}

/** Powtarzalna losowość: zrzuty Chromatica i testy muszą widzieć te same wyniki. */
function demoRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state += 0x6d2b79f5
    let r = Math.imul(state ^ (state >>> 15), 1 | state)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Puchar demo ułożony regułami generatora (#215): rozstawienie, wolne losy
 * dla najwyżej rozstawionych, numery z dziurami, krawędzie i strony według
 * ADR-0004, mecz o 3. miejsce w rundzie finału z numerem 2. Wyniki i awans
 * jak w #216: awansuje się przy `finished`, remis w piłce rozstrzygają karne,
 * a kosz remisu nie zna. Id meczu to `order · 1000 + matchNumber`, drużyny
 * mają id równe rozstawieniu.
 */
export function demoBracket({
  teams: count,
  progress = 'before',
  thirdPlace = count >= 4,
  sport = 'football',
  longNames = false,
  names,
}: DemoBracketOptions): DemoBracketMatch[] {
  const size = bracketSize(count)
  const rounds = Math.log2(size)
  const positions = bracketSeedPositions(size)
  const entrants = Array.from({ length: count }, (_, index) => {
    const nick = BRACKET_NICKS[index % 16]!
    const place = BRACKET_PLACES[(index * 5 + Math.floor(index / 16)) % 16]!
    const name = names?.[index] ?? (longNames ? `Uczniowski Klub Sportowy ${nick} ${place} Warszawa` : `${nick} ${place}`)
    return { id: index + 1, name, logoUrl: null }
  })

  const blank = (order: number, matchNumber: number): DemoBracketMatch => ({
    id: order * 1000 + matchNumber,
    stageId: 2,
    round: { id: 100 + order, name: demoRoundName(2 ** (rounds - order + 1)), order },
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
  })

  // Mecze pozycyjne po rundzie i numerze; `null` w miejscu wolnego losu.
  const grid = Array.from({ length: rounds }, (_, r) =>
    Array.from({ length: size / 2 ** (r + 1) }, (_, p) =>
      r === 0 && positions[2 * p + 1]! > count ? null : blank(r + 1, p + 1),
    ),
  )
  const third = thirdPlace && rounds >= 2 ? blank(rounds, 2) : null

  grid.forEach((row, r) =>
    row.forEach((match, p) => {
      if (!match || r === rounds - 1) return
      match.winnerToMatchId = grid[r + 1]![Math.floor(p / 2)]!.id
      match.loserToMatchId = r === rounds - 2 && third ? third.id : null
      match.advancesToSlot = p % 2 === 0 ? 'home' : 'away'
    }),
  )

  grid[0]!.forEach((match, p) => {
    const home = entrants[positions[2 * p]! - 1]!
    if (match) {
      match.homeTeam = home
      match.awayTeam = entrants[positions[2 * p + 1]! - 1]!
      return
    }
    const target = grid[1]![Math.floor(p / 2)]!
    if (p % 2 === 0) target.homeTeam = home
    else target.awayTeam = home
  })

  // Rundy co tydzień od soboty 5 września, osiem meczów dziennie od 9:00
  // UTC; w rundzie finału mecz o 3. miejsce o 10:00, finał o 12:00.
  const inPlayOrder = grid.map((row, r) => {
    const played = row.filter((match): match is DemoBracketMatch => match !== null)
    return r === rounds - 1 && third ? [third, ...played] : played
  })
  inPlayOrder.forEach((matches, r) =>
    matches.forEach((match, index) => {
      const day = Date.UTC(2026, 8, 5) + (r * 7 + Math.floor(index / 8)) * 86_400_000
      const hour = r === rounds - 1 ? (match === third ? 10 : 12) : 9 + (index % 8)
      match.kickoffAt = new Date(day + hour * 3_600_000).toISOString().replace('.000Z', '+00:00')
      match.venue = BRACKET_VENUES[index % BRACKET_VENUES.length]!
    }),
  )

  const random = demoRandom(count * 7919 + (sport === 'football' ? 1 : 2))
  const byId = new Map([...grid.flat(), third].filter((match): match is DemoBracketMatch => match !== null).map((match) => [match.id, match]))

  function play(match: DemoBracketMatch, status: 'live' | 'finished') {
    match.status = status
    if (sport === 'basketball') {
      const scale = status === 'live' ? 0.5 : 1
      const home = Math.round((58 + random() * 38) * scale)
      const away = Math.round((58 + random() * 38) * scale)
      match.homeScore = home
      match.awayScore = status === 'finished' && home === away ? away + 3 : away
      return
    }
    // Wyżej rozstawiony (niższe id) częściej wygrywa, żeby drabinka wyglądała prawdopodobnie.
    const goals = () => [0, 0, 1, 1, 1, 2, 2, 3][Math.floor(random() * 8)]!
    let home = goals()
    let away = goals()
    if (random() < 0.35) {
      if (match.homeTeam!.id < match.awayTeam!.id) home += 1
      else away += 1
    }
    match.homeScore = status === 'live' ? Math.min(home, 2) : home
    match.awayScore = status === 'live' ? Math.min(away, 1) : away
    if (status === 'finished' && home === away) {
      const winner = 4 + Math.floor(random() * 2)
      const loser = winner - 1 - Math.floor(random() * 2)
      const homeWins = random() < 0.5
      match.homePenalties = homeWins ? winner : loser
      match.awayPenalties = homeWins ? loser : winner
    }
  }

  function advance(match: DemoBracketMatch) {
    const winner = bracketWinnerSide(match)
    if (!winner || !match.advancesToSlot) return
    const slot = match.advancesToSlot === 'home' ? 'homeTeam' : 'awayTeam'
    const next = match.winnerToMatchId === null ? undefined : byId.get(match.winnerToMatchId)
    if (next) next[slot] = winner === 'home' ? match.homeTeam : match.awayTeam
    const consolation = match.loserToMatchId === null ? undefined : byId.get(match.loserToMatchId)
    if (consolation) consolation[slot] = winner === 'home' ? match.awayTeam : match.homeTeam
  }

  const current = progress === 'before' ? { round: 1, finished: 0, live: 0 } : progress === 'done' ? { round: rounds + 1, finished: 0, live: 0 } : progress
  inPlayOrder.forEach((matches, r) =>
    matches.forEach((match, index) => {
      const order = r + 1
      const status =
        order < current.round || (order === current.round && index < current.finished)
          ? 'finished'
          : order === current.round && index < current.finished + (current.live ?? 0)
            ? 'live'
            : 'scheduled'
      if (status === 'scheduled' || !match.homeTeam || !match.awayTeam) return
      play(match, status)
      if (status === 'finished') advance(match)
    }),
  )

  return [...byId.values()].toSorted((a, b) => a.round.order - b.round.order || a.matchNumber - b.matchNumber)
}

// --- Terminarz i Wyniki strony publicznej (#292) ------------------------------

/** Mecz listy Terminarza i Wyników: `PublicMatch` z kolejką i fazą. */
export type PublicListMatch = ScheduleDemoMatch & { stageId?: number }

/** `/fixtures` i `/results` jednego turnieju demo. */
export type PublicMatchLists = { fixtures: PublicListMatch[]; results: PublicListMatch[] }

/** Ten sam moment dobę później, w zapisie z API. */
function nextDay(iso: string): string {
  return new Date(new Date(iso).getTime() + 86_400_000).toISOString().replace('.000Z', '+00:00')
}

function splitLists(matches: PublicListMatch[]): PublicMatchLists {
  return {
    fixtures: matches.filter((match) => match.status !== 'finished'),
    results: matches.filter((match) => match.status === 'finished').toReversed(),
  }
}

/** Liga piłkarska w trakcie: `publicFixtures` i `publicResults` (herb ma FC Górka). */
export const publicLeagueLists: PublicMatchLists = { fixtures: publicFixtures, results: publicResults }

/**
 * Liga koszykówki: drużyny z `basketballStandingsTableRows`, mecz i rewanż,
 * czyli sześć kolejek po dwa mecze. Trzy kolejki rozegrane z wynikami
 * trzycyfrowymi, w czwartej jeden mecz trwa, a drugi gra następnego dnia,
 * więc kolejka pokazuje dzień w wierszu.
 */
export const publicBasketballLists: PublicMatchLists = (() => {
  const [a, b, c, d] = basketballStandingsTableRows.map((row) => row.team) as [MatchRowTeam, MatchRowTeam, MatchRowTeam, MatchRowTeam]
  const pairs: [MatchRowTeam, MatchRowTeam][][] = [
    [[a, d], [b, c]],
    [[d, c], [a, b]],
    [[b, d], [c, a]],
  ]
  const season = [...pairs, ...pairs.map((round) => round.map(([home, away]): [MatchRowTeam, MatchRowTeam] => [away, home]))]
  const scores: [number, number][] = [[102, 88], [79, 84], [91, 99], [110, 104], [87, 72], [95, 101]]
  return splitLists(
    season.flatMap((round, index) =>
      round.map(([home, away], position): PublicListMatch => {
        const order = index + 1
        const finished = order <= 3
        const live = order === 4 && position === 0
        const score = finished ? scores[index * 2 + position]! : live ? ([54, 61] as const) : null
        const kickoff = demoKickoff(order, position + 1)
        return {
          id: 500 + order * 10 + position,
          round: { id: 50 + order, name: `Kolejka ${order}`, order },
          homeTeam: home,
          awayTeam: away,
          homeScore: score?.[0] ?? null,
          awayScore: score?.[1] ?? null,
          status: finished ? 'finished' : live ? 'live' : 'scheduled',
          // Drugi mecz czwartej kolejki gra dzień później.
          kickoffAt: order === 4 && position === 1 ? nextDay(kickoff) : kickoff,
          venue: { id: 7, name: 'Hala Ochota' },
        }
      }),
    ),
  )
})()

/** Wiersze fazy pucharowej z pozycją w drabince, jak `useBracketRows` w aplikacji. */
function withDemoPositions(matches: DemoBracketMatch[], penaltySlot: boolean): PublicListMatch[] {
  return matches.map((match) => {
    const position = bracketPosition(match.id, matches)
    return { ...match, bracket: position && { ...position, penaltySlot } }
  })
}

/**
 * Puchar ośmiu drużyn w trakcie półfinałów: ćwierćfinały rozegrane (pierwszy
 * po karnych), pierwszy półfinał zakończony, drugi trwa, a finał i mecz
 * o 3. miejsce czekają na drużyny (puste sloty ze źródłem).
 */
export const publicCupLists: PublicMatchLists = (() => {
  const matches = demoBracket({ teams: 8, progress: { round: 2, finished: 1, live: 1 } })
  // Pierwszy ćwierćfinał po karnych, z tym samym zwycięzcą, który już awansował.
  const quarter = matches[0]!
  const winner = bracketWinnerSide(quarter)
  Object.assign(quarter, { homeScore: 1, awayScore: 1, homePenalties: winner === 'home' ? 4 : 3, awayPenalties: winner === 'home' ? 3 : 4 })
  return splitLists(withDemoPositions(matches, true).toSorted(byKickoff))
})()

/** Drużyny grup demo po grupie, jak `groupStandings`. */
const groupTeams = (groupIndex: number): MatchRowTeam[] => groupStandings[groupIndex]!.rows.map((row) => row.team)

/**
 * Turniej z grupami i playoffem (#268): trzy kolejki grup po dwa mecze na
 * grupę, w trzeciej kolejce gra jeszcze Grupa B, a półfinały playoffu czekają
 * na terminarz grup.
 */
export const publicGroupLists: PublicMatchLists = (() => {
  const rounds = [
    [[0, 1], [2, 3]],
    [[0, 2], [3, 1]],
    [[3, 0], [1, 2]],
  ] as const
  const groupMatches = rounds.flatMap((pairs, index) =>
    [0, 1].flatMap((groupIndex) =>
      pairs.map(([home, away], position): PublicListMatch => {
        const order = index + 1
        const finished = order < 3 || groupIndex === 0
        const teams = groupTeams(groupIndex)
        return {
          id: 700 + order * 10 + groupIndex * 2 + position,
          stageId: 3,
          round: { id: 70 + order, name: `Kolejka ${order}`, order },
          homeTeam: teams[home]!,
          awayTeam: teams[away]!,
          homeScore: finished ? (order + position + groupIndex) % 3 : null,
          awayScore: finished ? (order * 2 + position) % 2 : null,
          status: finished ? 'finished' : 'scheduled',
          kickoffAt: demoKickoff(order, groupIndex * 2 + position + 1),
          venue: scheduleVenues[position]!,
          group: groupStandings[groupIndex]!.name,
        }
      }),
    ),
  )
  const playoff = demoBracket({ teams: 4, thirdPlace: false, names: [groupTeams(0)[0]!.name, groupTeams(1)[0]!.name, groupTeams(0)[1]!.name, groupTeams(1)[1]!.name] }).map(
    (match): DemoBracketMatch => ({ ...match, stageId: 4, round: { ...match.round, id: match.round.id + 100, order: match.round.order + 3 }, kickoffAt: demoKickoff(match.round.order + 3, match.matchNumber) }),
  )
  return splitLists([...groupMatches, ...withDemoPositions(playoff, true)].toSorted(byKickoff))
})()

/** Turniej, w którym terminarz już się rozegrał: wszystkie mecze w Wynikach. */
export const publicFinishedLists: PublicMatchLists = {
  fixtures: [],
  results: scheduleInProgress
    .map((match) => (match.status === 'finished' ? match : { ...match, status: 'finished' as const, homeScore: match.id % 3, awayScore: (match.id + 1) % 2 }))
    .map(({ collisions: _collisions, ...match }) => match)
    .toSorted((a, b) => byKickoff(b, a)),
}

// --- Przegląd strony publicznej (#296) ----------------------------------------
//
// Jeden turniej na format w czterech chwilach: przed terminarzem (same
// drużyny), przed startem, w trakcie i po końcu. Listy meczów, tabele
// i drabinki każdego formatu biorą się z tych samych meczów, więc pas etapu,
// tabela i drabinka mówią to samo.

/** Drużyna prezentacji (`TeamSummary` z kontraktu). */
export type PublicTeam = MatchRowTeam

/** Drużyny z meczów w kolejności pierwszego wystąpienia, bez pustych slotów. */
function teamsOf(matches: readonly { homeTeam: MatchRowTeam | null; awayTeam: MatchRowTeam | null }[]): PublicTeam[] {
  const byId = new Map<number, PublicTeam>()
  for (const match of matches) {
    for (const team of [match.homeTeam, match.awayTeam]) if (team && !byId.has(team.id)) byId.set(team.id, team)
  }
  return [...byId.values()]
}

/** Mecze sezonu jako `/fixtures` i `/results`: strzelcy jak w API, rosnąco po terminie przed podziałem. */
function seasonLists(matches: readonly ScheduleDemoMatch[]): PublicMatchLists {
  return splitLists(matches.map(asPublicMatch).toSorted(byKickoff))
}

/** Chwila turnieju na Przeglądzie: listy meczów i tabela ligi. */
export type PublicLeagueMoment = { lists: PublicMatchLists; rows: PublicStandingsTableRow[] }

/** Liga piłkarska demo (`teams`): drużyny i trzy chwile sezonu. */
export const publicLeagueSeason = {
  teams: teamRows.map(({ id, name, logoUrl }): PublicTeam => ({ id, name, logoUrl })),
  beforeStart: { lists: seasonLists(scheduleBeforeStart), rows: publicStandingsRows.beforeStart },
  inProgress: { lists: publicLeagueLists, rows: publicStandingsRows.inProgress },
  finished: { lists: seasonLists(scheduleFinished), rows: publicStandingsRows.finished },
} satisfies Record<string, PublicLeagueMoment | PublicTeam[]>

/** Wszystkie mecze ligi koszykówki demo (`publicBasketballLists`) rosnąco po terminie. */
const basketballSeason: ScheduleDemoMatch[] = [...publicBasketballLists.fixtures, ...publicBasketballLists.results].toSorted(byKickoff)
const basketballTeams = basketballStandingsTableRows.map((row) => row.team)
/** Koszykówka: 2 punkty za wygraną, 1 za porażkę, bez remisów. */
const BASKETBALL_POINTS = { win: 2, draw: 0, loss: 1 }

/** Liga koszykówki demo: te same mecze przed startem, w trakcie i po końcu, tabela z nich. */
export const publicBasketballSeason = (() => {
  const beforeStart = basketballSeason.map((match) => ({ ...match, status: 'scheduled' as const, homeScore: null, awayScore: null }))
  const finished = basketballSeason.map((match, index) =>
    match.status === 'finished' ? match : { ...match, status: 'finished' as const, homeScore: 80 + ((index * 7) % 25), awayScore: 76 + ((index * 11) % 23) },
  )
  const moment = (matches: ScheduleDemoMatch[]): PublicLeagueMoment => ({
    lists: splitLists(matches),
    rows: demoLeagueTable(matches, basketballTeams, BASKETBALL_POINTS),
  })
  return {
    teams: basketballTeams,
    beforeStart: moment(beforeStart),
    inProgress: moment(basketballSeason),
    finished: moment(finished),
  }
})()

/** Chwila pucharu: komplet meczów drabinki (`/matches`) i listy z pozycją w drabince. */
export type PublicCupMoment = { matches: DemoBracketMatch[]; lists: PublicMatchLists }

function cupMoment(matches: DemoBracketMatch[]): PublicCupMoment {
  return { matches, lists: splitLists(withDemoPositions(matches, true).toSorted(byKickoff)) }
}

/**
 * Puchar ośmiu drużyn demo: przed startem, w półfinałach (pierwszy
 * zakończony, drugi trwa) i po finale rozstrzygniętym karnymi.
 */
export const publicCupSeason = (() => {
  const before = demoBracket({ teams: 8 })
  const finished = demoBracket({ teams: 8, progress: 'done' })
  // Finał 2:2, karne 5:4 dla gospodarza: mistrz wychodzi z karnych.
  const final = finished.find((match) => match.round.order === 3 && match.matchNumber === 1)!
  Object.assign(final, { homeScore: 2, awayScore: 2, homePenalties: 5, awayPenalties: 4 })
  return {
    teams: teamsOf(before),
    beforeStart: cupMoment(before),
    inProgress: cupMoment(demoBracket({ teams: 8, progress: { round: 2, finished: 1, live: 1 } })),
    finished: cupMoment(finished),
  }
})()

/** Chwila fazy grupowej: listy meczów grup i tabele obu grup z nich. */
export type PublicGroupMoment = {
  lists: PublicMatchLists
  tables: { groupId: number; groupName: string; qualifiers: number; rows: PublicStandingsTableRow[] }[]
}

/** Mecze grup z `publicGroupLists` (bez playoffu), rosnąco po terminie. */
const groupSeason: PublicListMatch[] = [...publicGroupLists.fixtures, ...publicGroupLists.results]
  .filter((match) => match.stageId === 3)
  .toSorted(byKickoff)

function groupMoment(matches: PublicListMatch[]): PublicGroupMoment {
  return {
    lists: splitLists(matches),
    tables: groupStandings.map((group) => ({
      groupId: group.id,
      groupName: group.name,
      qualifiers: group.qualifiers,
      rows: demoLeagueTable(
        matches.filter((match) => match.group === group.name),
        group.rows.map((row) => row.team),
      ),
    })),
  }
}

/** Playoff po grupach: drabinka na czterech z czołówki grup, w fazie `id: 4`. */
function demoPlayoff(progress: DemoBracketProgress): DemoBracketMatch[] {
  const [a, b] = [groupStandings[0]!.rows, groupStandings[1]!.rows]
  const seeds = [a[0]!.team, b[0]!.team, a[1]!.team, b[1]!.team]
  const byName = new Map(seeds.map((team) => [team.name, team]))
  const ownTeam = (team: MatchRowTeam | null) => team && (byName.get(team.name) ?? team)
  return demoBracket({ teams: 4, thirdPlace: false, progress, names: seeds.map((team) => team.name) }).map((match) => ({
    ...match,
    stageId: 4,
    homeTeam: ownTeam(match.homeTeam),
    awayTeam: ownTeam(match.awayTeam),
    round: { ...match.round, id: match.round.id + 100, order: match.round.order + 3 },
    kickoffAt: demoKickoff(match.round.order + 3, match.matchNumber),
  }))
}

/**
 * Grupy z playoffem demo (drużyny z przykładu `grupy`): faza grupowa przed
 * startem i w trzeciej kolejce, a po niej playoff w półfinałach i po finale.
 */
export const publicGroupsSeason = (() => {
  const finishedGroups = groupSeason.map((match) =>
    match.status === 'finished' ? match : { ...match, status: 'finished' as const, homeScore: match.id % 3, awayScore: (match.id + 1) % 2 },
  )
  const playoffLists = (progress: DemoBracketProgress): PublicCupMoment => {
    const matches = demoPlayoff(progress)
    return { matches, lists: splitLists([...finishedGroups, ...withDemoPositions(matches, true)].toSorted(byKickoff)) }
  }
  return {
    teams: teamsOf(groupSeason),
    beforeStart: groupMoment(groupSeason.map((match) => ({ ...match, status: 'scheduled' as const, homeScore: null, awayScore: null }))),
    inProgress: groupMoment(groupSeason),
    playoff: playoffLists({ round: 1, finished: 1, live: 1 }),
    playoffFinished: playoffLists('done'),
  }
})()

/** Klasyfikacja przed pierwszym zakończonym meczem: pusta. */
export const emptyLeaderboard = (stat: string, label: string): Leaderboard => ({ stat, label, rows: [] })

// --- Siatkówka (#301) ----------------------------------------------------------

/**
 * Tabela ligi siatkówki z przykładu `siatkowka` kontraktu i seeda demo
 * (`liga-siatkowki-2026`): zdobycze to sety, a punkty w setach stoją w osobnej
 * kolumnie. Czaple i Mewy mają po 3 pkt i jednym zwycięstwie, a rozdziela je
 * stosunek setów (4:4 przed 3:4).
 */
export const publicVolleyballStandingsRows: PublicStandingsTableRow[] = [
  { position: 1, team: { id: 501, name: 'Orlęta Wawer', logoUrl: null }, played: 2, won: 2, drawn: 0, lost: 0, scoreFor: 6, scoreAgainst: 2, scoreDifference: 4, rallyPointsFor: 183, rallyPointsAgainst: 162, points: 5, form: ['win', 'win'] },
  { position: 2, team: { id: 503, name: 'Czaple Ursynów', logoUrl: null }, played: 2, won: 1, drawn: 0, lost: 1, scoreFor: 4, scoreAgainst: 4, scoreDifference: 0, rallyPointsFor: 183, rallyPointsAgainst: 188, points: 3, form: ['win', 'loss'] },
  { position: 3, team: { id: 502, name: 'Mewy Żoliborz', logoUrl: null }, played: 2, won: 1, drawn: 0, lost: 1, scoreFor: 3, scoreAgainst: 4, scoreDifference: -1, rallyPointsFor: 155, rallyPointsAgainst: 161, points: 3, form: ['loss', 'win'] },
  { position: 4, team: { id: 504, name: 'Jaskółki Targówek', logoUrl: null }, played: 2, won: 0, drawn: 0, lost: 2, scoreFor: 3, scoreAgainst: 6, scoreDifference: -3, rallyPointsFor: 195, rallyPointsAgainst: 205, points: 1, form: ['loss', 'loss'] },
]

/** Ta sama tabela w panelu: bez formy. */
export const volleyballStandingsTableRows: StandingsTableRow[] = publicVolleyballStandingsRows.map(({ form: _form, ...row }) => row)

export const publicVolleyballTiebreakers = [
  { code: 'points', label: 'Punkty w tabeli' },
  { code: 'wins', label: 'Zwycięstwa' },
  { code: 'set_ratio', label: 'Stosunek setów' },
  { code: 'point_ratio', label: 'Stosunek punktów w setach' },
  { code: 'head_to_head', label: 'Bezpośredni mecz' },
]

/** Ustawienia zegara siatkówki: jedna część bez czasu, bez biegnącego zegara, więc samo „Na żywo”. */
export const volleyballClockSettings: MatchClockSettings = { periods: { count: 1, minutes: null }, matchDuration: 90, runningClock: false }

const volleyballTeam = (id: number, name: string) => ({ id, name, logoUrl: null })

/** Mecz siatkówki 3:2 z piątym setem do 15, jak mecz 3 przykładu `siatkowka`. */
export const matchPageVolleyball: MatchPageData = {
  ...pageBase(publicResults[0]!, 'finished'),
  id: 5003,
  homeTeam: volleyballTeam(501, 'Orlęta Wawer'),
  awayTeam: volleyballTeam(504, 'Jaskółki Targówek'),
  venue: { id: 51, name: 'Hala Targówek' },
  homeScore: 3,
  awayScore: 2,
  sets: [
    { home: 25, away: 23 },
    { home: 23, away: 25 },
    { home: 25, away: 21 },
    { home: 20, away: 25 },
    { home: 15, away: 11 },
  ],
  scorers: [],
  events: [],
  periods: [],
}

/** Mecz siatkówki trwający: 1:1 w setach, trzeci set niedokończony (14:12). */
export const matchPageVolleyballLive: MatchPageData = {
  ...matchPageVolleyball,
  id: 5005,
  status: 'live',
  awayTeam: volleyballTeam(503, 'Czaple Ursynów'),
  homeScore: 1,
  awayScore: 1,
  sets: [
    { home: 25, away: 21 },
    { home: 18, away: 25 },
    { home: 14, away: 12 },
  ],
  livePeriod: 1,
  periodStartedAt: DEMO_CLOCK_NOW.toISOString(),
  onBreak: false,
}
