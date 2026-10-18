/**
 * PROTOTYP S7 (#287) — dane Przeglądu w trzech stanach turnieju.
 *
 * Bierze sezon demo z `lib/demo-data.ts`, a tabelę i formę liczy z meczów
 * zakończonych, żeby wynik, tabela i forma mówiły to samo (demo-data ma
 * tabelę statyczną, niezgodną z terminarzem).
 */
import { groupByRound, latestRoundMatches, nextRoundMatches, type RoundWithMatches } from '../../components/data/round-groups'
import type { Leaderboard } from '../../components/data/leaderboard-data'
import type { StandingsTableRow } from '../../components/data/standings-table-row'
import type { PublicShellTournament } from '../../components/layout/public-shell-tournament'
import {
  leaderboardsBySport,
  publicFixtures,
  publicResults,
  publicTournament,
  scheduleTimeZone,
  teams,
  type ScheduleDemoMatch,
} from '../../lib/demo-data'

/**
 * `bez-terminarza`: drużyny są, kolejek jeszcze nie ma (organizator nie
 * ułożył terminarza). Liga oddaje wtedy z `/standings` wszystkie drużyny
 * z zerami (`TournamentStandings::of` bierze `tournament->teams`).
 */
export type TournamentState = 'bez-terminarza' | 'przed-startem' | 'w-trakcie' | 'zakonczony'

export type FormResult = 'W' | 'R' | 'P'

export type TableRow = StandingsTableRow & {
  /** Ostatnie pięć wyników, od najstarszego. Kontrakt tego nie ma (#287, „nowe dane”). */
  form: FormResult[]
}

export type OverviewData = {
  tournament: PublicShellTournament
  state: TournamentState
  timeZone: string
  live: ScheduleDemoMatch[]
  upcoming: ScheduleDemoMatch[]
  latest: ScheduleDemoMatch[]
  /** Kolejka „bieżąca”: ta z meczem trwającym, a bez niego najbliższa albo ostatnia. */
  currentRound: RoundWithMatches<ScheduleDemoMatch> | undefined
  /** Ostatnia rozegrana kolejka (dla Ostatnich wyników). */
  latestRound: RoundWithMatches<ScheduleDemoMatch> | undefined
  /** Najbliższa kolejka z meczem zaplanowanym. */
  nextRound: RoundWithMatches<ScheduleDemoMatch> | undefined
  /** Kolejka po bieżącej. */
  followingRound: RoundWithMatches<ScheduleDemoMatch> | undefined
  roundsTotal: number
  table: TableRow[]
  leaderboard: Leaderboard
}

const allMatches: ScheduleDemoMatch[] = [...publicResults, ...publicFixtures].toSorted((a, b) =>
  (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? '') || a.id - b.id,
)

function seasonFor(state: TournamentState): ScheduleDemoMatch[] {
  if (state === 'bez-terminarza') return []
  if (state === 'w-trakcie') return allMatches
  if (state === 'przed-startem') {
    return allMatches.map((match) => ({ ...match, status: 'scheduled' as const, homeScore: null, awayScore: null, scorers: [] }))
  }
  return allMatches.map((match) =>
    match.status === 'finished'
      ? match
      : { ...match, status: 'finished' as const, homeScore: (match.id * 7) % 4, awayScore: (match.id * 3) % 3, scorers: [] },
  )
}

function standingsFrom(matches: ScheduleDemoMatch[]): TableRow[] {
  const rows = new Map<number, TableRow>()
  for (const team of teams) {
    rows.set(team.id, {
      position: 0,
      team: { id: team.id, name: team.name, logoUrl: null },
      played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, scoreDifference: 0, points: 0,
      form: [],
    })
  }
  for (const match of matches) {
    if (match.status !== 'finished' || !match.homeTeam || !match.awayTeam) continue
    const sides = [
      [rows.get(match.homeTeam.id)!, match.homeScore!, match.awayScore!],
      [rows.get(match.awayTeam.id)!, match.awayScore!, match.homeScore!],
    ] as const
    for (const [row, own, other] of sides) {
      row.played++
      row.scoreFor += own
      row.scoreAgainst += other
      row.scoreDifference = row.scoreFor - row.scoreAgainst
      const result: FormResult = own > other ? 'W' : own === other ? 'R' : 'P'
      if (result === 'W') { row.won++; row.points += 3 }
      if (result === 'R') { row.drawn++; row.points += 1 }
      if (result === 'P') row.lost++
      row.form = [...row.form, result].slice(-5)
    }
  }
  return [...rows.values()]
    .toSorted((a, b) => b.points - a.points || b.scoreDifference - a.scoreDifference || b.scoreFor - a.scoreFor || a.team.name.localeCompare(b.team.name, 'pl'))
    .map((row, index) => ({ ...row, position: index + 1 }))
}

function leaderboardFor(state: TournamentState): Leaderboard {
  const goals = leaderboardsBySport.football.goals!
  if (state === 'przed-startem' || state === 'bez-terminarza') return { ...goals, rows: [] }
  if (state === 'w-trakcie') return goals
  return { ...goals, rows: goals.rows.map((row) => ({ ...row, value: Math.round(row.value * 2.6) })) }
}

export function overviewData(state: TournamentState): OverviewData {
  const season = seasonFor(state)
  const fixtures = groupByRound(season.filter((match) => match.status !== 'finished'), { timeZone: scheduleTimeZone })
  const results = groupByRound(season.filter((match) => match.status === 'finished'), { direction: 'desc', timeZone: scheduleTimeZone })
  const rounds = groupByRound(season, { timeZone: scheduleTimeZone })
  const live = season.filter((match) => match.status === 'live')

  const liveRound = live[0] && rounds.find((round) => round.summary.id === live[0]!.round.id)
  const nextRound = rounds.find((round) => round.matches.some((match) => match.status === 'scheduled'))
  const latestRound = results[0] && rounds.find((round) => round.summary.id === results[0]!.summary.id)

  const currentRound = liveRound ?? nextRound ?? latestRound
  const followingRound = currentRound && rounds[rounds.indexOf(currentRound) + 1]

  return {
    tournament: { ...publicTournament, status: state === 'zakonczony' ? 'finished' : 'active' },
    state,
    timeZone: scheduleTimeZone,
    live,
    upcoming: nextRoundMatches(fixtures),
    latest: latestRoundMatches(results),
    currentRound,
    followingRound,
    latestRound,
    nextRound,
    roundsTotal: rounds.length,
    table: standingsFrom(season),
    leaderboard: leaderboardFor(state),
  }
}
