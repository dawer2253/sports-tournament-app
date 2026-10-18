/**
 * PROTOTYP S7 (#288) — dane pozostałych ekranów w czterech formatach
 * turnieju (liga piłkarska, liga koszykówki, puchar, grupy z playoffem)
 * i czterech stanach z #287.
 *
 * Tabele liczy z meczów, żeby wynik, tabela i forma mówiły to samo. Liga
 * piłkarska to ten sam sezon co Przegląd (`seasonFor`), koszykówka to ten
 * sam terminarz z wynikami przeliczonymi na kosze, puchar i playoff biorą
 * `demoBracket` (reguły generatora z #215).
 */
import { bracketPosition, type BracketMatch } from '../../../lib/bracket'
import type { Leaderboard, StatOption } from '../../../components/data/leaderboard-data'
import type { MatchScorer } from '../../../components/data/match-row-data'
import { groupByRound, type RoundWithMatches } from '../../../components/data/round-groups'
import { GROUP_TABS, CUP_TABS, LEAGUE_TABS, type PublicNavKey } from '../../../components/layout/public-nav'
import type { PublicShellTournament } from '../../../components/layout/public-shell-tournament'
import {
  cupExampleTeams,
  demoBracket,
  groupStandings,
  leaderboardsBySport,
  publicBasketballTournament,
  publicCupTournament,
  publicTournament,
  scheduleTimeZone,
  sportSettings,
  statOptionsBySport,
  type DemoBracketMatch,
  type ScheduleDemoMatch,
} from '../../../lib/demo-data'
import { seasonFor, type FormResult, type TableRow, type TournamentState } from '../demo'

export type Format = 'liga' | 'kosz' | 'puchar' | 'grupy'

export const FORMATS: Record<Format, string> = {
  liga: 'Liga piłkarska',
  kosz: 'Liga koszykówki',
  puchar: 'Puchar',
  grupy: 'Grupy i playoff',
}

/** Mecz ekranu: wiersz terminarza z fazą (grupy przed playoffem). */
export type ScreenMatch = ScheduleDemoMatch & { stageId?: number }

export type GroupTable = { id: number; name: string; qualifiers: number; rows: TableRow[] }

export type Season = {
  format: Format
  state: TournamentState
  tournament: PublicShellTournament
  tabs: readonly PublicNavKey[]
  sport: 'football' | 'basketball'
  allowsDraw: boolean
  /** „Bramki” albo „Punkty” (ADR-0006). */
  scoreLabel: string
  /** Zdanie o kolejności przy równych punktach, z tiebreaków sportu. */
  tiebreakers: string[]
  timeZone: string
  matches: ScreenMatch[]
  /** Liczba kolejek (rund) w całym turnieju, także jeszcze niegranych. */
  roundsTotal: number
  /** Tabela ligi; w pucharze pusta. */
  table: TableRow[]
  groups: GroupTable[]
  /** Mecze fazy pucharowej: puchar albo playoff po grupach. */
  bracket: DemoBracketMatch[]
  stats: StatOption[]
  leaderboards: Record<string, Leaderboard>
}

const POINTS = {
  football: { win: 3, draw: 1, loss: 0 },
  basketball: { win: 2, draw: 0, loss: 1 },
} as const

/** Tabela z meczów zakończonych: punkty sportu, forma z pięciu ostatnich. */
export function tableFrom(
  teams: readonly { id: number; name: string }[],
  matches: readonly ScheduleDemoMatch[],
  points: { win: number; draw: number; loss: number },
): TableRow[] {
  const rows = new Map<number, TableRow>()
  for (const team of teams) {
    rows.set(team.id, {
      position: 0,
      team: { id: team.id, name: team.name, logoUrl: null },
      played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, scoreDifference: 0, points: 0,
      form: [],
    })
  }
  const played = matches
    .filter((match) => match.status === 'finished' && match.homeTeam && match.awayTeam)
    .toSorted((a, b) => (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? ''))
  for (const match of played) {
    const home = rows.get(match.homeTeam!.id)
    const away = rows.get(match.awayTeam!.id)
    if (!home || !away) continue
    const sides = [
      [home, match.homeScore!, match.awayScore!],
      [away, match.awayScore!, match.homeScore!],
    ] as const
    for (const [row, own, other] of sides) {
      row.played++
      row.scoreFor += own
      row.scoreAgainst += other
      row.scoreDifference = row.scoreFor - row.scoreAgainst
      const result: FormResult = own > other ? 'W' : own === other ? 'R' : 'P'
      if (result === 'W') { row.won++; row.points += points.win }
      if (result === 'R') { row.drawn++; row.points += points.draw }
      if (result === 'P') { row.lost++; row.points += points.loss }
      row.form = [...row.form, result].slice(-5)
    }
  }
  return [...rows.values()]
    .toSorted((a, b) => b.points - a.points || b.scoreDifference - a.scoreDifference || b.scoreFor - a.scoreFor || a.team.name.localeCompare(b.team.name, 'pl'))
    .map((row, index) => ({ ...row, position: index + 1 }))
}

function leaderboardsFor(sport: 'football' | 'basketball', state: TournamentState): Record<string, Leaderboard> {
  return Object.fromEntries(
    Object.entries(leaderboardsBySport[sport]).map(([code, board]) => {
      if (state === 'przed-startem' || state === 'bez-terminarza') return [code, { ...board, rows: [] }]
      if (state === 'zakonczony') return [code, { ...board, rows: board.rows.map((row) => ({ ...row, value: Math.round(row.value * 2.6) })) }]
      return [code, board]
    }),
  )
}

const TIEBREAKERS = (sport: 'football' | 'basketball') =>
  sportSettings[sport].tiebreakers.filter((item) => item.code !== 'points').map((item) => item.label.toLocaleLowerCase('pl'))

// --- Liga koszykówki -----------------------------------------------------------

/** Drużyny ligi koszykówki w miejscu ośmiu drużyn piłkarskich demo (po id). */
const BASKETBALL_NAMES: Record<number, string> = {
  1: 'Żubry Wola', 2: 'Rysie Mokotów', 3: 'Kosze Ochota', 4: 'Orlęta Praga',
  5: 'Grizzly Bemowo', 6: 'Kangury Ursus', 7: 'Pelikany Wawer', 8: 'Bizony Targówek',
}

const BASKETBALL_FIRST = ['Oskar Dąb', 'Bruno Klon', 'Filip Sarna', 'Hubert Łoś', 'Kacper Lipa', 'Wiktor Bóbr', 'Igor Jodła', 'Szymon Wiąz']

/** Wynik piłkarski przeliczony na kosz: kolejność zwycięzcy zostaje, remisu nie ma. */
function basketballScore(match: ScheduleDemoMatch): Pick<ScheduleDemoMatch, 'homeScore' | 'awayScore' | 'scorers'> {
  if (match.status === 'scheduled' || match.homeScore === null || match.awayScore === null) {
    return { homeScore: null, awayScore: null, scorers: [] }
  }
  const scale = match.status === 'live' ? 0.55 : 1
  let home = Math.round((66 + match.homeScore * 8 + ((match.id * 7) % 13)) * scale)
  const away = Math.round((66 + match.awayScore * 8 + ((match.id * 11) % 13)) * scale)
  if (home === away) home += 2
  // Kosz w turnieju bywa trzycyfrowy: pole wyniku musi to zmieścić.
  if (match.id % 9 === 0 && match.status === 'finished') home += 34
  const scorer = (team: { id: number; name: string }, value: number, index: number): MatchScorer => ({
    team,
    player: { id: team.id * 100 + index, name: BASKETBALL_FIRST[(team.id + index) % BASKETBALL_FIRST.length]! },
    value,
    minutes: [],
    ownGoal: false,
  })
  return {
    homeScore: home,
    awayScore: away,
    scorers: [
      scorer(match.homeTeam!, Math.round(home * 0.31), 0),
      scorer(match.homeTeam!, Math.round(home * 0.22), 1),
      scorer(match.awayTeam!, Math.round(away * 0.29), 0),
      scorer(match.awayTeam!, Math.round(away * 0.2), 1),
    ],
  }
}

function basketballSeason(state: TournamentState): ScheduleDemoMatch[] {
  const rename = (team: { id: number; name: string } | null) => team && { id: team.id, name: BASKETBALL_NAMES[team.id] ?? team.name }
  return seasonFor(state).map((match) => {
    const renamed = { ...match, homeTeam: rename(match.homeTeam), awayTeam: rename(match.awayTeam) }
    return { ...renamed, ...basketballScore(renamed), venue: { id: 41, name: match.venue?.id === 2 ? 'Hala Bemowo' : 'Hala Ursus' } }
  })
}

// --- Puchar i playoff ---------------------------------------------------------

/** Kolejne rundy pucharu demo co tydzień: po fazie grupowej przesuwamy playoff o `days`. */
function shift(matches: DemoBracketMatch[], days: number): DemoBracketMatch[] {
  if (days === 0) return matches
  return matches.map((match) => ({
    ...match,
    kickoffAt: match.kickoffAt && new Date(new Date(match.kickoffAt).getTime() + days * 86_400_000).toISOString().replace('.000Z', '+00:00'),
  }))
}

export const CUP_SIZES = { 6: '6 drużyn', 8: '8 drużyn', 16: '16 drużyn' } as const
export type CupSize = keyof typeof CUP_SIZES

/** Puchar w stanie turnieju: w trakcie to druga od końca runda, jeden mecz trwa. */
export function cupBracket(state: TournamentState, teams: CupSize = 8, names?: readonly string[]): DemoBracketMatch[] {
  if (state === 'bez-terminarza') return []
  const rounds = Math.log2(teams === 6 ? 8 : teams)
  const progress = state === 'przed-startem' ? 'before' : state === 'zakonczony' ? 'done' : { round: rounds - 1, finished: 1, live: 1 }
  return demoBracket({ teams, progress, names })
}

/** Mecz pucharu jako wiersz terminarza: z pozycją w drabince i źródłami pustych slotów. */
export function bracketRow(match: DemoBracketMatch, all: readonly BracketMatch[]): ScreenMatch {
  const position = bracketPosition(match.id, all)
  return {
    ...match,
    scorers: [],
    bracket: position && { ...position, penaltySlot: true },
  }
}

// --- Grupy --------------------------------------------------------------------

const GROUP_PAIRS = [[[0, 3], [1, 2]], [[0, 2], [3, 1]], [[0, 1], [2, 3]]] as const

/**
 * Faza grupowa: dwie grupy po cztery, każdy z każdym w trzech kolejkach.
 * W trakcie: dwie kolejki rozegrane, w trzeciej po jednym meczu zakończonym,
 * jeden trwa, jeden przed nami.
 */
function groupMatches(state: TournamentState): ScreenMatch[] {
  if (state === 'bez-terminarza') return []
  return GROUP_PAIRS.flatMap((pairs, round) =>
    groupStandings.flatMap((group, groupIndex) =>
      pairs.map(([home, away], pairIndex): ScreenMatch => {
        const id = 500 + round * 10 + groupIndex * 2 + pairIndex
        const homeTeam = group.rows.toSorted((a, b) => a.team.id - b.team.id)[home]!.team
        const awayTeam = group.rows.toSorted((a, b) => a.team.id - b.team.id)[away]!.team
        const kickoff = new Date(Date.UTC(2026, 8, 5 + round * 7, 8 + groupIndex * 2))
        const order = round * 4 + groupIndex * 2 + pairIndex
        const finished = state === 'zakonczony' || round < 2 || (state === 'w-trakcie' && round === 2 && order % 4 < 2)
        const live = state === 'w-trakcie' && round === 2 && order % 4 === 2
        const status = state === 'przed-startem' ? 'scheduled' : finished ? 'finished' : live ? 'live' : 'scheduled'
        const played = status !== 'scheduled'
        return {
          id,
          stageId: 1,
          round: { id: 300 + round, name: `Kolejka ${round + 1}`, order: round + 1 },
          group: group.name,
          homeTeam: { id: homeTeam.id, name: homeTeam.name },
          awayTeam: { id: awayTeam.id, name: awayTeam.name },
          homeScore: played ? (id * 7) % 4 : null,
          awayScore: played ? (live ? 0 : (id * 5) % 3) : null,
          status,
          kickoffAt: kickoff.toISOString().replace('.000Z', '+00:00'),
          venue: { id: pairIndex + 1, name: pairIndex === 0 ? 'Boisko A' : 'Boisko B' },
          scorers: [],
        }
      }),
    ),
  )
}

function groupTables(matches: readonly ScreenMatch[]): GroupTable[] {
  return groupStandings.map((group) => ({
    id: group.id,
    name: group.name,
    qualifiers: group.qualifiers,
    rows: tableFrom(group.rows.map((row) => row.team), matches.filter((match) => match.group === group.name), POINTS.football),
  }))
}

/** Playoff po grupach: krzyżowo A1–B2, B1–A2, rusza tydzień po ostatniej kolejce grup. */
function playoff(state: TournamentState, groups: GroupTable[]): DemoBracketMatch[] {
  if (state !== 'zakonczony') return []
  const [a, b] = groups as [GroupTable, GroupTable]
  const names = [a.rows[0]!.team.name, b.rows[0]!.team.name, a.rows[1]!.team.name, b.rows[1]!.team.name]
  return shift(demoBracket({ teams: 4, progress: 'done', names }), 21).map((match) => ({ ...match, stageId: 2 }))
}

// --- Sezon --------------------------------------------------------------------

export function season(format: Format, state: TournamentState, cupSize: CupSize = 8): Season {
  const finished = state === 'zakonczony'
  const status = finished ? ('finished' as const) : ('active' as const)
  const base = { format, state, timeZone: scheduleTimeZone, groups: [], bracket: [], table: [] }

  if (format === 'kosz') {
    const matches = basketballSeason(state)
    return {
      ...base,
      tournament: { ...publicBasketballTournament, status },
      tabs: LEAGUE_TABS,
      sport: 'basketball',
      allowsDraw: false,
      scoreLabel: sportSettings.basketball.scoreLabel,
      tiebreakers: TIEBREAKERS('basketball'),
      matches,
      roundsTotal: 14,
      table: tableFrom(Object.entries(BASKETBALL_NAMES).map(([id, name]) => ({ id: Number(id), name })), matches, POINTS.basketball),
      stats: statOptionsBySport.basketball,
      leaderboards: leaderboardsFor('basketball', state),
    }
  }

  if (format === 'puchar') {
    const bracket = cupBracket(state, cupSize, cupSize === 6 ? cupExampleTeams : undefined)
    return {
      ...base,
      tournament: { ...publicCupTournament, status },
      tabs: CUP_TABS,
      sport: 'football',
      allowsDraw: true,
      scoreLabel: sportSettings.football.scoreLabel,
      tiebreakers: [],
      // Jak API: po terminie, więc mecz o 3. miejsce (10:00) stoi przed finałem.
      matches: bracket.map((match) => bracketRow(match, bracket)).toSorted((a, b) => (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? '')),
      roundsTotal: Math.log2(cupSize === 6 ? 8 : cupSize),
      bracket,
      stats: statOptionsBySport.football,
      leaderboards: leaderboardsFor('football', state),
    }
  }

  if (format === 'grupy') {
    const groupPhase = groupMatches(state)
    const groups = groupTables(groupPhase)
    const bracket = playoff(state, groups)
    return {
      ...base,
      tournament: { ...publicTournament, name: 'Grupy Osiedlowe 2026', slug: 'grupy-osiedlowe-2026', status },
      tabs: GROUP_TABS,
      sport: 'football',
      allowsDraw: true,
      scoreLabel: sportSettings.football.scoreLabel,
      tiebreakers: TIEBREAKERS('football'),
      matches: [...groupPhase, ...bracket.map((match) => bracketRow(match, bracket))],
      roundsTotal: 5,
      groups,
      bracket,
      stats: statOptionsBySport.football,
      leaderboards: leaderboardsFor('football', state),
    }
  }

  const matches = seasonFor(state)
  return {
    ...base,
    tournament: { ...publicTournament, status },
    tabs: LEAGUE_TABS,
    sport: 'football',
    allowsDraw: true,
    scoreLabel: sportSettings.football.scoreLabel,
    tiebreakers: TIEBREAKERS('football'),
    matches,
    roundsTotal: 14,
    table: tableFrom(
      [...new Map(seasonFor('w-trakcie').flatMap((match) => [match.homeTeam!, match.awayTeam!]).map((team) => [team.id, team])).values()],
      matches,
      POINTS.football,
    ),
    stats: statOptionsBySport.football,
    leaderboards: leaderboardsFor('football', state),
  }
}

/** Terminarz: mecze zaplanowane i trwające po kolejce, rosnąco. */
export function fixtureRounds(data: Season): RoundWithMatches<ScreenMatch>[] {
  return groupByRound(data.matches.filter((match) => match.status !== 'finished'), { timeZone: data.timeZone })
}

/** Wyniki: mecze zakończone po kolejce, od najnowszej. */
export function resultRounds(data: Season): RoundWithMatches<ScreenMatch>[] {
  return groupByRound(data.matches.filter((match) => match.status === 'finished'), { direction: 'desc', timeZone: data.timeZone })
}

/** Wszystkie kolejki turnieju, rosnąco (pas kolejki, inne mecze kolejki). */
export function allRounds(data: Season): RoundWithMatches<ScreenMatch>[] {
  return groupByRound(data.matches, { timeZone: data.timeZone })
}
