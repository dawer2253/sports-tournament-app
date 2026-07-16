// Spójne dane demo dla wszystkich ekranów (mock, docelowo z API).

export type MatchStatus = 'scheduled' | 'live' | 'finished'
export type FormResult = 'W' | 'D' | 'L'

export type Team = {
  id: number
  name: string
  abbr: string
  players: number
}

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

export type Player = { id: number; name: string; number: number; position: string; teamId: number }

export const players: Player[] = [
  { id: 1, name: 'Jan Kowalski', number: 9, position: 'Napastnik', teamId: 1 },
  { id: 2, name: 'Piotr Zieliński', number: 10, position: 'Pomocnik', teamId: 1 },
  { id: 3, name: 'Marek Lis', number: 1, position: 'Bramkarz', teamId: 1 },
  { id: 4, name: 'Adam Wójcik', number: 7, position: 'Skrzydłowy', teamId: 4 },
  { id: 5, name: 'Michał Nowak', number: 4, position: 'Obrońca', teamId: 4 },
  { id: 6, name: 'Tomasz Mazur', number: 11, position: 'Napastnik', teamId: 2 },
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

export type MatchEvent = {
  type: 'goal' | 'yellow' | 'red'
  playerName: string
  teamId: number
  minute: number
}

export type Match = {
  id: number
  round: number
  home: Team
  away: Team
  homeScore: number | null
  awayScore: number | null
  status: MatchStatus
  kickoff: string // ISO-ish label
  date: string
  venue: string
  collision?: boolean
  events?: MatchEvent[]
}

export const fixtures: Match[] = [
  {
    id: 1, round: 5, home: teams[0], away: teams[3], homeScore: 2, awayScore: 1, status: 'finished',
    kickoff: '17:00', date: '28.06.2026', venue: 'Boisko A',
    events: [
      { type: 'goal', playerName: 'J. Kowalski', teamId: 1, minute: 23 },
      { type: 'yellow', playerName: 'M. Nowak', teamId: 4, minute: 41 },
      { type: 'goal', playerName: 'J. Kowalski', teamId: 1, minute: 67 },
      { type: 'goal', playerName: 'A. Wójcik', teamId: 4, minute: 80 },
    ],
  },
  { id: 2, round: 5, home: teams[2], away: teams[1], homeScore: null, awayScore: null, status: 'scheduled', kickoff: '19:00', date: '28.06.2026', venue: 'Boisko A' },
  { id: 3, round: 5, home: teams[5], away: teams[4], homeScore: null, awayScore: null, status: 'scheduled', kickoff: '19:00', date: '28.06.2026', venue: 'Boisko A', collision: true },
  { id: 4, round: 5, home: teams[6], away: teams[7], homeScore: 1, awayScore: 1, status: 'live', kickoff: '20:30', date: '28.06.2026', venue: 'Boisko B' },
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

export type Venue = { id: number; name: string; address: string; matches: number }

export const venues: Venue[] = [
  { id: 1, name: 'Boisko A', address: 'ul. Sportowa 1', matches: 18 },
  { id: 2, name: 'Boisko B', address: 'ul. Parkowa 12', matches: 14 },
  { id: 3, name: 'Hala Miejska', address: 'ul. Główna 5', matches: 6 },
]

export const tiebreakers = [
  { key: 'points', label: 'Punkty' },
  { key: 'head_to_head', label: 'Bezpośredni mecz' },
  { key: 'goal_diff', label: 'Różnica bramek' },
  { key: 'goals_for', label: 'Bramki zdobyte' },
]

export const formColor: Record<FormResult, string> = {
  W: 'bg-primary',
  D: 'bg-muted-foreground',
  L: 'bg-destructive',
}
