import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
import { expect, waitFor, within } from 'storybook/test'
import {
  publicBasketballSchedule,
  publicBasketballStandingsRows,
  publicBasketballTiebreakers,
  publicBasketballTournament,
  publicGroupSchedule,
  publicGroupStandings,
  publicStandingsRows,
  publicStandingsTiebreakers,
  publicTournament,
  scheduleBeforeStart,
  scheduleFinished,
  scheduleInProgress,
  scheduleTimeZone,
} from '../../lib/demo-data'
import { desktop1280, expectTextFits, phone375 } from '../../test/viewport'
import type { PublicShellTournament } from '../public-shell-tournament'
import { publicTabs, type PublicNavKey } from '../public-nav'
import { scheduleProgress } from '../schedule-progress'
import { Shell } from '../shell'
import { StandingsLoading, StandingsScreen, type StandingsScreenProps, type StandingsScreenTable } from './standings'

/** Adres zakładki jak w `apps/public` (`tabHref`): trasy po polsku. */
const PATHS: Record<PublicNavKey, string> = { home: '', standings: 'tabela', bracket: 'drabinka', fixtures: 'terminarz', results: 'wyniki', stats: 'statystyki' }
const hrefFor = (slug: string) => (key: PublicNavKey) => (PATHS[key] ? `/t/${slug}/${PATHS[key]}` : `/t/${slug}`)

const leagueTabs = publicTabs([{ type: 'league' }])
const groupTabs = publicTabs([{ type: 'group' }, { type: 'knockout' }])

const groupsTournament: PublicShellTournament = { ...publicTournament, name: 'Grupy Osiedlowe 2026', slug: 'grupy-osiedlowe-2026' }

/** Tabela ligi demo w kształcie, w jakim podaje ją strona. */
function leagueTable(rows: StandingsScreenTable['rows'], overrides: Partial<StandingsScreenTable> = {}): StandingsScreenTable {
  return { groupId: null, groupName: null, rows, qualifiers: null, scoreLabel: 'Bramki', allowsDraw: true, tiebreakers: publicStandingsTiebreakers, ...overrides }
}

const groupTables: StandingsScreenTable[] = publicGroupStandings.map((group) => ({
  groupId: group.id,
  groupName: group.name,
  rows: group.rows,
  qualifiers: group.qualifiers,
  scoreLabel: 'Bramki',
  allowsDraw: true,
  tiebreakers: publicStandingsTiebreakers,
}))

/** Ekran w shellu turnieju, tak jak rysuje go `apps/public`. */
function Screen({ tournament = publicTournament, tabs = leagueTabs, ...props }: StandingsScreenProps & { tournament?: PublicShellTournament; tabs?: readonly PublicNavKey[] }) {
  const href = hrefFor(tournament.slug)
  return (
    <Shell tournament={tournament} tabs={tabs} active="standings" navHref={href}>
      <StandingsScreen {...props} />
    </Shell>
  )
}

const meta = {
  title: 'Strona publiczna/Ekrany/Tabela',
  component: Screen,
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
  args: {
    format: 'league',
    stageName: 'Faza zasadnicza',
    tables: [leagueTable(publicStandingsRows.inProgress)],
    status: 'active',
    schedule: scheduleProgress(scheduleInProgress),
    overview: { href: hrefFor(publicTournament.slug)('home') },
    timeZone: scheduleTimeZone,
  },
} satisfies Meta<typeof Screen>

export default meta
type Story = StoryObj<typeof meta>

const fact = (canvas: HTMLElement) => [...canvas.querySelectorAll('[data-slot="fact"]')].map((element) => element.textContent?.trim())

/** Liga w trakcie: cztery kolejki rozegrane, piąta w grze, bez pasa „Mistrz”. */
export const Liga: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 2, name: 'Tabela' })).toBeInTheDocument()
    await expect(fact(canvasElement)).toEqual(['4 z 14 kolejek rozegrane'])
    await expect(canvas.queryByRole('region', { name: 'Mistrz' })).not.toBeInTheDocument()
    await expect(within(canvas.getByRole('region', { name: 'Faza zasadnicza' })).getAllByRole('row')).toHaveLength(9)
  },
}

/** Koszykówka: zdobycze to „Punkty”, bez `R` i bez remisu w formie. */
export const Koszykowka: Story = {
  name: 'Koszykówka',
  args: {
    tournament: publicBasketballTournament,
    tables: [leagueTable(publicBasketballStandingsRows, { scoreLabel: 'Punkty', allowsDraw: false, tiebreakers: publicBasketballTiebreakers })],
    schedule: publicBasketballSchedule,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('columnheader', { name: 'Punkty' })).toBeInTheDocument()
    await expect(canvas.queryByRole('columnheader', { name: 'R' })).not.toBeInTheDocument()
    await expect(canvasElement.querySelectorAll('[data-result="draw"]')).toHaveLength(0)
  },
}

/**
 * Grupy: dwie tabele w dwóch kolumnach od `lg`, w kolejności `Group.order`,
 * z linią wyjścia; jedno zdanie o kolejności pod obiema i odnośnik do
 * wygenerowanej drabinki.
 */
export const Grupy: Story = {
  args: {
    tournament: groupsTournament,
    tabs: groupTabs,
    format: 'groups',
    stageName: 'Faza grupowa',
    tables: groupTables,
    schedule: publicGroupSchedule,
    status: 'active',
    bracket: { href: hrefFor(groupsTournament.slug)('bracket') },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 2, name: 'Tabele grup' })).toBeInTheDocument()
    await expect(fact(canvasElement)).toEqual(['2 grupy', '3 z 3 kolejek rozegrane'])
    const a = canvas.getByRole('region', { name: 'Grupa A' })
    const b = canvas.getByRole('region', { name: 'Grupa B' })
    // Dwie kolumny: Grupa B stoi obok Grupy A, nie pod nią.
    await expect(Math.round(b.getBoundingClientRect().top)).toBe(Math.round(a.getBoundingClientRect().top))
    await expect(canvas.getAllByText(/^Przy równej liczbie punktów:/)).toHaveLength(1)
    await expect(canvas.getByRole('link', { name: 'Drabinka playoffu' })).toHaveAttribute('href', `/t/${groupsTournament.slug}/drabinka`)
    await expect(canvas.queryByRole('region', { name: 'Mistrz' })).not.toBeInTheDocument()
  },
}

/** Grupy przed wygenerowaniem drabinki: zdanie, kiedy powstanie, bez odnośnika. */
export const GrupyPrzedDrabinka: Story = {
  name: 'Grupy przed drabinką',
  args: { ...Grupy.args, bracket: undefined, schedule: { roundsPlayed: 2, roundsTotal: 3, startsAt: null } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Drabinka playoffu powstanie po fazie grupowej')).toBeInTheDocument()
    await expect(within(canvasElement.querySelector('main')!).queryByRole('link', { name: /Drabinka/ })).not.toBeInTheDocument()
  },
}

/** Przed startem: terminarz ułożony, bez wyników. Tabela zer bez paska lidera, w nagłówku data startu. */
export const PrzedStartem: Story = {
  name: 'Przed startem',
  args: { tables: [leagueTable(publicStandingsRows.beforeStart)], schedule: scheduleProgress(scheduleBeforeStart) },
  play: async ({ canvasElement }) => {
    await expect(fact(canvasElement)).toEqual(['Startuje 5 września'])
    await expect(canvasElement.querySelector('[data-slot="standings-bar"]')).toBeNull()
  },
}

/** Sezon zakończony: pas „Mistrz” nad tabelą z drużyną z pierwszego miejsca. */
export const Zakonczona: Story = {
  name: 'Zakończona',
  args: { tables: [leagueTable(publicStandingsRows.finished)], schedule: scheduleProgress(scheduleFinished), status: 'finished' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const champion = canvas.getByRole('region', { name: 'Mistrz' })
    const leader = publicStandingsRows.finished[0]!
    await expect(within(champion).getByText(leader.team.name)).toBeInTheDocument()
    await expect(within(champion).getByText(String(leader.points))).toBeInTheDocument()
    await expect(fact(canvasElement)).toEqual(['14 kolejek rozegranych, sezon zakończony'])
  },
}

/** Bez terminarza: faza nie ma meczów, więc zamiast tabeli zer pusty stan z odnośnikiem do Przeglądu. */
export const BezTerminarza: Story = {
  name: 'Bez terminarza',
  args: { tables: [leagueTable(publicStandingsRows.beforeStart)], schedule: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Tabela ruszy z terminarzem' })).toBeInTheDocument()
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Zobacz drużyny na Przeglądzie' })).toHaveAttribute('href', `/t/${publicTournament.slug}`)
  },
}

/** Grupy bez składu: tabel grup jeszcze nie ma. */
export const GrupyBezSkladu: Story = {
  name: 'Grupy bez składu',
  args: { ...Grupy.args, tables: [], schedule: null, bracket: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { name: 'Grupy jeszcze nie są ułożone' })).toBeInTheDocument()
  },
}

/** Telefon 375 px: pięć kolumn, bez przewijania w bok i bez ucinania nazw. */
export const Telefon: Story = {
  ...phone375,
  args: { tables: [leagueTable(publicStandingsRows.finished)], schedule: scheduleProgress(scheduleFinished), status: 'finished' },
  play: async ({ canvasElement }) => {
    await document.fonts.ready
    const canvas = within(canvasElement)
    const visible = canvas.getAllByRole('columnheader').filter((header) => header.checkVisibility())
    await expect(visible.map((header) => header.textContent)).toEqual(['#', 'Drużyna', 'M', '+/−', 'Pkt'])
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
    await expectTextFits([...canvasElement.querySelectorAll<HTMLElement>('[data-slot="team-name"]')])
  },
}

/** Pierwsze wczytanie: szkielet w kształcie ekranu, który znika, gdy przyjdą dane. */
function LoadingThenData(props: StandingsScreenProps) {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    const timer = setTimeout(() => setReady(true), 600)
    return () => clearTimeout(timer)
  }, [])
  return (
    <Shell tournament={publicTournament} tabs={leagueTabs} active="standings">
      {ready ? <StandingsScreen {...props} /> : <StandingsLoading />}
    </Shell>
  )
}

export const Wczytywanie: Story = {
  render: (args) => <LoadingThenData {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const status = canvas.getByRole('status', { name: 'Wczytywanie tabeli' })
    await expect(status.querySelectorAll('[data-slot="skeleton-block"]').length).toBeGreaterThan(8)
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
    await waitFor(() => expect(canvas.getByRole('table')).toBeInTheDocument(), { timeout: 3000 })
    await expect(canvas.queryByRole('status', { name: 'Wczytywanie tabeli' })).not.toBeInTheDocument()
  },
}
