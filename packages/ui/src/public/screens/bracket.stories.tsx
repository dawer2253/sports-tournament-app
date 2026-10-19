import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
import { expect, waitFor, within } from 'storybook/test'
import { bracketTeamIds } from '../../lib/bracket'
import {
  cupExampleTeams,
  demoBracket,
  groupStandings,
  publicBasketballCupTournament,
  publicCupTournament,
  publicTournament,
  scheduleTimeZone,
  type DemoBracketMatch,
} from '../../lib/demo-data'
import { desktop1280, phone375 } from '../../test/viewport'
import { divergenceNote } from '../bracket-notes'
import { publicTabs, type PublicNavKey } from '../public-nav'
import type { PublicShellTournament } from '../public-shell-tournament'
import { Shell } from '../shell'
import { BracketLoading, BracketScreen, type BracketFormat } from './bracket'

/** Adres zakładki jak w `apps/public` (`tabHref`): trasy po polsku. */
const PATHS: Record<PublicNavKey, string> = { home: '', standings: 'tabela', bracket: 'drabinka', fixtures: 'terminarz', results: 'wyniki', stats: 'statystyki' }

const STAGES: Record<BracketFormat, { type: string }[]> = {
  league: [{ type: 'league' }],
  knockout: [{ type: 'knockout' }],
  groups_playoff: [{ type: 'group' }, { type: 'knockout' }],
}

const groupsTournament: PublicShellTournament = { ...publicTournament, name: 'Grupy Osiedlowe 2026', slug: 'grupy-osiedlowe-2026' }

type ScreenArgs = {
  format: BracketFormat
  matches: DemoBracketMatch[]
  tournament?: PublicShellTournament
  divergence?: string | null
}

/** Ekran w shellu turnieju, jak pod trasą `/t/:slug/drabinka`. */
function Screen({ format, matches, tournament = format === 'groups_playoff' ? groupsTournament : format === 'knockout' ? publicCupTournament : publicTournament, divergence }: ScreenArgs) {
  const href = (key: PublicNavKey) => (PATHS[key] ? `/t/${tournament.slug}/${PATHS[key]}` : `/t/${tournament.slug}`)
  return (
    <Shell tournament={tournament} tabs={publicTabs(STAGES[format])} active="bracket" navHref={href}>
      <BracketScreen
        format={format}
        matches={matches}
        groups={groupStandings}
        divergence={divergence}
        timeZone={scheduleTimeZone}
        matchHref={(match) => `/t/${tournament.slug}/mecze/${match.id}`}
        navHref={href}
      />
    </Shell>
  )
}

/**
 * Drabinka strony publicznej (#293): każdy format i stan osobno. Kolor
 * turnieju z globalnego przełącznika „Kolor turnieju”.
 */
const meta = {
  title: 'Strona publiczna/Ekrany/Drabinka',
  component: Screen,
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
} satisfies Meta<typeof Screen>

export default meta
type Story = StoryObj<typeof meta>

const fact = (canvasElement: HTMLElement) => canvasElement.querySelector('[data-slot="fact"]')

/** Puchar sześciu drużyn w trakcie ćwierćfinałów: wolni losy dla seedów 1 i 2. */
export const Puchar6: Story = {
  name: 'Puchar 6 drużyn w trakcie',
  args: { format: 'knockout', matches: demoBracket({ teams: 6, names: cupExampleTeams, progress: { round: 1, finished: 1 } }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 2, name: 'Drabinka' })).toBeInTheDocument()
    await expect(canvas.getByText('Puchar')).toBeInTheDocument()
    await expect(canvas.getAllByRole('group', { name: /^Wolny los:/ })).toHaveLength(2)
    await expect(fact(canvasElement)).toHaveTextContent('5 z 6 drużyn w grze')
  },
}

/** Puchar 16 w ćwierćfinałach, jeden trwa: cztery kolumny, „Na żywo” w kaflu i nad kolumną. */
export const Puchar16NaZywo: Story = {
  name: 'Puchar 16 drużyn z meczem na żywo',
  args: { format: 'knockout', matches: demoBracket({ teams: 16, progress: { round: 2, finished: 2, live: 1 } }) },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll('[data-slot="bracket-column"]')).toHaveLength(4))
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    await expect(within(canvasElement).getAllByText('Na żywo').length).toBeGreaterThanOrEqual(2)
    await expect(fact(canvasElement)).toHaveTextContent('6 z 16 drużyn w grze')
  },
}

/** Puchar 128 na telefonie: jedna runda listą, strona bez przewijania w bok. */
export const Puchar128Telefon: Story = {
  ...phone375,
  name: 'Puchar 128 drużyn na telefonie',
  args: { format: 'knockout', matches: demoBracket({ teams: 128, longNames: true, progress: { round: 1, finished: 40, live: 2 } }) },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll('[data-slot="bracket-round-head"]')).toHaveLength(1))
    await expect(document.documentElement.scrollWidth).toBe(window.innerWidth)
  },
}

/** Po finale: mistrz nad finałem i fakt „16 drużyn, puchar rozstrzygnięty”. */
export const PucharPoFinale: Story = {
  name: 'Puchar po finale',
  args: { format: 'knockout', matches: demoBracket({ teams: 16, progress: 'done' }) },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status', { name: 'Mistrz' })).toBeInTheDocument()
    await expect(fact(canvasElement)).toHaveTextContent('16 drużyn, puchar rozstrzygnięty')
  },
}

/** Koszykówka: trzycyfrowe wyniki w tym samym okienku, bez karnych. */
export const Koszykowka: Story = {
  name: 'Koszykówka',
  args: {
    format: 'knockout',
    tournament: publicBasketballCupTournament,
    matches: demoBracket({ teams: 16, sport: 'basketball', progress: { round: 2, finished: 3, live: 1 } }),
  },
}

/**
 * Playoff po grupach: dwie czołowe drużyny każdej grupy z `groupStandings`,
 * a mecze 1. rundy krzyżują grupy. `third` podmienia trzecią drużynę
 * Grupy A na miejsce drugiej — tak powstaje rozjazd z tabelą.
 */
function playoff(swap = false): DemoBracketMatch[] {
  const [a, b] = groupStandings as [(typeof groupStandings)[number], (typeof groupStandings)[number]]
  const seeded = [a.rows[0]!, b.rows[0]!, swap ? a.rows[2]! : a.rows[1]!, b.rows[1]!].map((row) => row.team)
  const byName = new Map(seeded.map((team) => [team.name, team]))
  const team = (value: DemoBracketMatch['homeTeam']) => value && byName.get(value.name)!
  return demoBracket({ teams: 4, names: seeded.map((entry) => entry.name), progress: { round: 1, finished: 1 } }).map((match) => ({
    ...match,
    homeTeam: team(match.homeTeam),
    awayTeam: team(match.awayTeam),
  }))
}

const note = (matches: DemoBracketMatch[]) =>
  divergenceNote(
    groupStandings.map((group) => ({ rows: group.rows, qualifiers: group.qualifiers })),
    bracketTeamIds(matches),
  )

/** Playoff po grupach z czołówki tabel: podpis „Playoff”, bez notki. */
export const PlayoffPoGrupach: Story = {
  name: 'Playoff po grupach',
  args: { format: 'groups_playoff', matches: playoff(), divergence: note(playoff()) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Playoff')).toBeInTheDocument()
    await expect(canvasElement.querySelector('[data-slot="bracket-divergence"]')).toBeNull()
  },
}

/** Playoff z notką o rozjeździe: w drabince gra trzecia drużyna Grupy A. */
export const PlayoffZNotka: Story = {
  name: 'Playoff z notką o rozjeździe',
  args: { format: 'groups_playoff', matches: playoff(true), divergence: note(playoff(true)) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="bracket-divergence"]')).toHaveTextContent(
      'Drabinka różni się od dzisiejszych tabel grup: w drabince gra Orły Bielany, a w tabeli grupy nad linią stoi dziś Wilki Bemowo.',
    )
  },
}

/** Puchar bez wygenerowanej drabinki: odnośnik do Przeglądu, który pokazuje drużyny. */
export const PucharBezDrabinki: Story = {
  name: 'Puchar bez drabinki',
  args: { format: 'knockout', matches: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Drabinka jeszcze nie jest ułożona' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Zobacz drużyny na Przeglądzie' })).toHaveAttribute('href', `/t/${publicCupTournament.slug}`)
  },
}

/** Grupy przed drabinką: liczba wychodzących z `Group.qualifiers` i odnośnik do tabel grup. */
export const GrupyPrzedDrabinka: Story = {
  name: 'Grupy przed drabinką',
  args: { format: 'groups_playoff', matches: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Drabinka powstanie po fazie grupowej' })).toBeInTheDocument()
    await expect(canvas.getByText(/^Z każdej grupy wychodzą 2 drużyny\./)).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Zobacz tabele grup' })).toHaveAttribute('href', `/t/${groupsTournament.slug}/tabela`)
  },
}

/** Liga pod `/drabinka`: odnośnik do Tabeli. */
export const Liga: Story = {
  args: { format: 'league', matches: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Ten turniej nie ma drabinki' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Przejdź do tabeli' })).toHaveAttribute('href', `/t/${publicTournament.slug}/tabela`)
  },
}

/** Pierwsze wczytanie: szkielet w kształcie ekranu, a po danych drzewo. */
function LoadingThenData() {
  const [loaded, setLoaded] = React.useState(false)
  React.useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 600)
    return () => clearTimeout(timer)
  }, [])
  return (
    <Shell tournament={publicCupTournament} tabs={publicTabs(STAGES.knockout)} active="bracket">
      {loaded ? <BracketScreen format="knockout" matches={demoBracket({ teams: 8 })} timeZone={scheduleTimeZone} /> : <BracketLoading />}
    </Shell>
  )
}

export const Wczytywanie: Story = {
  args: { format: 'knockout', matches: [] },
  render: () => <LoadingThenData />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status', { name: 'Wczytywanie drabinki' })).toBeInTheDocument()
    await waitFor(() => expect(canvas.queryByRole('status', { name: 'Wczytywanie drabinki' })).not.toBeInTheDocument(), { timeout: 3000 })
    await expect(canvas.getByRole('heading', { level: 2, name: 'Drabinka' })).toBeInTheDocument()
  },
}
