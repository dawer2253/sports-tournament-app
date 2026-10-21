/**
 * Pomocnik stories Przeglądu: ekran w shellu turnieju z danymi demo,
 * policzonymi tak jak w aplikacji (`groupByRound`, `overviewRounds`,
 * `overviewBracketStage`). Nie jest ekranem i nie trafia do barrela.
 */
import * as React from 'react'
import type { Leaderboard } from '../../components/data/leaderboard-data'
import { groupByRound } from '../../components/data/round-groups'
import { scheduleTimeZone, type DemoBracketMatch, type PublicMatchLists, type PublicTeam } from '../../lib/demo-data'
import { overviewBracketStage, overviewRounds } from '../overview-stage'
import { publicTabs, type PublicNavKey } from '../public-nav'
import type { PublicShellTournament } from '../public-shell-tournament'
import { Shell } from '../shell'
import type { GroupTableData } from '../standings-table'
import { TeamsShowcase } from '../teams-showcase'
import { OverviewLoading, OverviewScreen, type Loadable, type OverviewLeagueTable, type OverviewMode, type OverviewSchedule } from './overview'

const PATHS: Record<PublicNavKey, string> = { home: '', standings: 'tabela', bracket: 'drabinka', fixtures: 'terminarz', results: 'wyniki', stats: 'statystyki' }

const STAGES: Record<OverviewMode, { type: string }[]> = {
  league: [{ type: 'league' }],
  knockout: [{ type: 'knockout' }],
  groups: [{ type: 'group' }, { type: 'knockout' }],
  playoff: [{ type: 'group' }, { type: 'knockout' }],
}

const ready = <T,>(data: T): Loadable<T> => ({ status: 'ready', data })

export type OverviewDemoProps = {
  mode: OverviewMode
  tournament: PublicShellTournament
  /** Stan „Bez terminarza”: same drużyny. */
  teams?: PublicTeam[]
  lists?: PublicMatchLists
  /** Liga: tabela. */
  table?: OverviewLeagueTable
  /** Grupy: tabele grup. */
  groups?: GroupTableData[]
  /** Puchar i playoff: komplet meczów drabinki. */
  bracket?: DemoBracketMatch[]
  leaderboard: Leaderboard
  /** Turniej `finished`. */
  finished?: boolean
  /** Ile milisekund trwa pierwsze wczytanie (story „Wczytywanie”); bez tego dane są od razu. */
  loadingMs?: number
  /** Sekcja tabeli (albo drabinki) z błędem zamiast danych. */
  mainError?: boolean
}

export function OverviewDemo({ mode, tournament, teams, lists, table, groups, bracket, leaderboard, finished = false, loadingMs, mainError = false }: OverviewDemoProps) {
  const [loaded, setLoaded] = React.useState(loadingMs === undefined)
  React.useEffect(() => {
    if (loadingMs === undefined) return
    const timer = setTimeout(() => setLoaded(true), loadingMs)
    return () => clearTimeout(timer)
  }, [loadingMs])

  const navHref = (key: PublicNavKey) => (PATHS[key] ? `/t/${tournament.slug}/${PATHS[key]}` : `/t/${tournament.slug}`)
  const matchHref = (match: { id: number }) => `/t/${tournament.slug}/mecze/${match.id}`
  const knockout = mode === 'knockout' || mode === 'playoff'
  const error = { status: 'error', message: 'Usługa chwilowo niedostępna.', onRetry: () => {} } as const

  let content: React.ReactNode = <OverviewLoading />
  if (loaded && teams) content = <TeamsShowcase teams={teams} />
  else if (loaded && lists) {
    const all = [...lists.fixtures, ...lists.results]
    let schedule: OverviewSchedule
    if (knockout) {
      const stageId = bracket?.[0]?.stageId
      const { stage, next } = overviewBracketStage(
        all.filter((match) => match.stageId === stageId),
        scheduleTimeZone,
      )
      schedule = { stage: stage!, next }
    } else {
      const rounds = overviewRounds(
        groupByRound(lists.fixtures, { timeZone: scheduleTimeZone }),
        groupByRound(lists.results, { direction: 'desc', timeZone: scheduleTimeZone }),
        scheduleTimeZone,
      )
      schedule = { stage: rounds.stage!, next: rounds.next, roundsTotal: rounds.roundsTotal, startsAt: rounds.startsAt }
    }
    content = (
      <OverviewScreen
        mode={mode}
        finished={finished}
        schedule={ready(schedule)}
        table={table && (mainError ? error : ready(table))}
        groups={groups && (mainError ? error : ready(groups))}
        bracket={bracket && (mainError ? error : ready(bracket))}
        leaderboard={ready(leaderboard)}
        hasFinishedMatches={lists.results.length > 0}
        timeZone={scheduleTimeZone}
        matchHref={matchHref}
        navHref={navHref}
      />
    )
  }

  return (
    <Shell tournament={tournament} tabs={publicTabs(STAGES[mode])} active="home" navHref={navHref}>
      {content}
    </Shell>
  )
}
