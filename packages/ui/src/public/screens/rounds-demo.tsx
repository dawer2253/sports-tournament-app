/**
 * Pomocnik stories Terminarza i Wyników: ekran w shellu turnieju z danymi
 * demo, pogrupowanymi tak jak w aplikacji (`groupByRound`, Terminarz
 * rosnąco, Wyniki od najnowszej). Nie jest ekranem i nie trafia do barrela.
 */
import * as React from 'react'
import { groupByRound } from '../../components/data/round-groups'
import { scheduleTimeZone, type PublicMatchLists } from '../../lib/demo-data'
import type { PublicShellTournament } from '../public-shell-tournament'
import { publicTabs, type PublicNavKey } from '../public-nav'
import { Shell } from '../shell'
import { FixturesScreen, MatchListLoading, ResultsScreen } from './rounds'

const PATHS: Record<PublicNavKey, string> = { home: '', standings: 'tabela', bracket: 'drabinka', fixtures: 'terminarz', results: 'wyniki', stats: 'statystyki' }

export type RoundsDemoProps = {
  mode: 'fixtures' | 'results'
  tournament: PublicShellTournament
  lists: PublicMatchLists
  /** Typy faz turnieju, z których shell liczy zakładki. */
  stages?: { type: 'league' | 'knockout' | 'group' }[]
  /** Ile milisekund trwa pierwsze wczytanie (story „Wczytywanie”); bez tego dane są od razu. */
  loadingMs?: number
}

export function RoundsDemo({ mode, tournament, lists, stages = [{ type: 'league' }], loadingMs }: RoundsDemoProps) {
  const [loaded, setLoaded] = React.useState(loadingMs === undefined)
  React.useEffect(() => {
    if (loadingMs === undefined) return
    const timer = setTimeout(() => setLoaded(true), loadingMs)
    return () => clearTimeout(timer)
  }, [loadingMs])

  const navHref = (key: PublicNavKey) => (PATHS[key] ? `/t/${tournament.slug}/${PATHS[key]}` : `/t/${tournament.slug}`)
  const Screen = mode === 'fixtures' ? FixturesScreen : ResultsScreen
  return (
    <Shell tournament={tournament} tabs={publicTabs(stages)} active={mode} navHref={navHref}>
      {loaded ? (
        <Screen
          fixtures={groupByRound(lists.fixtures, { timeZone: scheduleTimeZone })}
          results={groupByRound(lists.results, { direction: 'desc', timeZone: scheduleTimeZone })}
          timeZone={scheduleTimeZone}
          matchHref={(match) => `/t/${tournament.slug}/mecze/${match.id}`}
          navHref={navHref}
        />
      ) : (
        <MatchListLoading label={mode === 'fixtures' ? 'terminarza' : 'wyników'} />
      )}
    </Shell>
  )
}
