import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
import { expect, within } from 'storybook/test'
import type { Leaderboard, StatOption } from '../../components/data/leaderboard-data'
import { leaderboardsBySport, publicBasketballTournament, publicTournament, statOptionsBySport } from '../../lib/demo-data'
import { desktop1280, phone375 } from '../../test/viewport'
import type { PublicShellTournament } from '../public-shell-tournament'
import { Shell } from '../shell'
import type { StatBoard } from '../stats'
import { NoStats, StatsLoading, StatsScreen } from './stats'

/**
 * Ekran jak w `apps/public`: wybór w stanie (w aplikacji w `?stat=`),
 * klasyfikacje wszystkich statystyk turnieju, główna i boczna kolumna z nich.
 */
function Demo({
  tournament,
  stats,
  leaderboards,
  hasFinishedMatches,
}: {
  tournament: PublicShellTournament
  stats: StatOption[]
  leaderboards: Record<string, Leaderboard>
  hasFinishedMatches?: boolean
}) {
  const [value, setValue] = React.useState(stats[0]!.code)
  const boards = Object.fromEntries(Object.entries(leaderboards).map(([code, leaderboard]) => [code, { status: 'ready', leaderboard } as StatBoard]))
  return (
    <Shell tournament={tournament} active="stats">
      <StatsScreen
        stats={stats}
        value={value}
        leaderboard={leaderboards[value]!}
        boards={boards}
        statHref={(code) => (code === stats[0]!.code ? `/t/${tournament.slug}/statystyki` : `/t/${tournament.slug}/statystyki?stat=${code}`)}
        onValueChange={setValue}
        hasFinishedMatches={hasFinishedMatches ?? false}
      />
    </Shell>
  )
}

const meta = {
  title: 'Strona publiczna/Ekrany/Statystyki',
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const football = leaderboardsBySport.football
const basketball = leaderboardsBySport.basketball

/** Piłka: lider, klasyfikacja ze zdaniem pod nią i dwie pozostałe statystyki obok. */
export const Pilka: Story = {
  name: 'Piłka',
  render: () => <Demo tournament={publicTournament} stats={statOptionsBySport.football} leaderboards={football} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 2, name: 'Statystyki' })).toBeInTheDocument()
    await expect(canvas.getByText('Klasyfikacja zawodników')).toBeInTheDocument()
    await expect(canvas.getAllByRole('table')).toHaveLength(1)
    await expect(canvas.getByText(/Klasyfikacja obejmuje mecze zakończone ze wszystkich faz turnieju\./)).toBeInTheDocument()
    const aside = canvas.getByRole('complementary', { name: 'Pozostałe statystyki' })
    await expect(within(aside).getAllByRole('heading').map((heading) => heading.textContent)).toEqual(['Żółte kartki', 'Czerwone kartki'])
    // Od `lg` boczna kolumna stoi obok klasyfikacji.
    const table = canvas.getByRole('table')
    await expect(aside.getBoundingClientRect().left).toBeGreaterThanOrEqual(table.getBoundingClientRect().right)
  },
}

/** Telefon: boczna kolumna pod klasyfikacją, strona bez przewijania w bok. */
export const PilkaNaTelefonie: Story = {
  name: 'Piłka na telefonie',
  parameters: phone375.parameters,
  globals: phone375.globals,
  render: () => <Demo tournament={publicTournament} stats={statOptionsBySport.football} leaderboards={football} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const aside = canvas.getByRole('complementary', { name: 'Pozostałe statystyki' })
    await expect(aside.getBoundingClientRect().top).toBeGreaterThanOrEqual(canvas.getByRole('table').getBoundingClientRect().bottom)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}

/** Piłka z dwoma liderami Bramek (po 8): dwie karty „Liderzy ex aequo”. */
export const PilkaExAequo: Story = {
  name: 'Piłka, liderzy ex aequo',
  render: () => {
    const [first, second, ...rest] = football.goals!.rows
    const goals = { ...football.goals!, rows: [first!, { ...second!, position: 1, value: first!.value }, ...rest] }
    return <Demo tournament={publicTournament} stats={statOptionsBySport.football} leaderboards={{ ...football, goals }} />
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByText('Liderzy ex aequo')).toHaveLength(2)
  },
}

/** Koszykówka: dwie statystyki, więc w bocznej kolumnie jedna. */
export const Koszykowka: Story = {
  name: 'Koszykówka',
  render: () => <Demo tournament={publicBasketballTournament} stats={statOptionsBySport.basketball} leaderboards={basketball} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('columnheader', { name: 'Punkty' })).toBeInTheDocument()
    const aside = canvas.getByRole('complementary', { name: 'Pozostałe statystyki' })
    await expect(within(aside).getAllByRole('region').map((region) => within(region).getByRole('heading').textContent)).toEqual(['Faule'])
  },
}

/** Przed pierwszym meczem zakończonym: pusty stan na całą szerokość, bez bocznej kolumny i bez tabeli. */
export const PrzedStartem: Story = {
  name: 'Przed startem',
  render: () => {
    const empty = Object.fromEntries(Object.entries(football).map(([code, board]) => [code, { ...board, rows: [] }]))
    return <Demo tournament={publicTournament} stats={statOptionsBySport.football} leaderboards={empty} />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Klasyfikacja ruszy po pierwszym zakończonym meczu' })).toBeInTheDocument()
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
    await expect(canvas.queryByRole('complementary', { name: 'Pozostałe statystyki' })).not.toBeInTheDocument()
    await expect(canvas.getByRole('tab', { name: 'Bramki' })).toHaveAttribute('aria-selected', 'true')
  },
}

/**
 * Mecze zakończone są, ale bez wpisanych zdarzeń (#306): ekran nie obiecuje,
 * że klasyfikacja „ruszy po pierwszym meczu”, tylko mówi, że jest pusta.
 */
export const MeczeBezZdarzen: Story = {
  name: 'Mecze bez zdarzeń',
  render: () => {
    const empty = Object.fromEntries(Object.entries(football).map(([code, board]) => [code, { ...board, rows: [] }]))
    return <Demo tournament={publicTournament} stats={statOptionsBySport.football} leaderboards={empty} hasFinishedMatches />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Ta klasyfikacja jest jeszcze pusta' })).toBeInTheDocument()
    await expect(canvas.queryByText('Klasyfikacja ruszy po pierwszym zakończonym meczu')).not.toBeInTheDocument()
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
  },
}

/** Turniej bez statystyk: zamiast zakładek jedno zdanie. */
export const BezStatystyk: Story = {
  name: 'Bez statystyk',
  render: () => (
    <Shell tournament={publicTournament} active="stats">
      <NoStats />
    </Shell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Ten turniej nie ma statystyk' })).toBeInTheDocument()
    await expect(canvas.queryByRole('tablist')).not.toBeInTheDocument()
  },
}

/** Pierwsze wczytanie: szkielet w kształcie ekranu, który ustępuje danym. */
function LoadingThenData() {
  const [loaded, setLoaded] = React.useState(false)
  React.useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 600)
    return () => clearTimeout(timer)
  }, [])
  if (loaded) return <Demo tournament={publicTournament} stats={statOptionsBySport.football} leaderboards={football} />
  return (
    <Shell tournament={publicTournament} active="stats">
      <StatsLoading />
    </Shell>
  )
}

export const Wczytywanie: Story = {
  render: () => <LoadingThenData />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const status = canvas.getByRole('status', { name: 'Wczytywanie statystyk' })
    // Kształt ekranu: nagłówek, zakładki, karta lidera, wiersze i boczna kolumna.
    await expect(status.querySelectorAll('[data-slot="skeleton-block"]').length).toBeGreaterThan(8)
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()

    await expect(await canvas.findByRole('table', {}, { timeout: 3000 })).toBeInTheDocument()
    await expect(canvas.queryByRole('status', { name: 'Wczytywanie statystyk' })).not.toBeInTheDocument()
  },
}
