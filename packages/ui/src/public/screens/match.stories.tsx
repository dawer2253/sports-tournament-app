import type { Meta, StoryObj } from '@storybook/react-vite'
import { useEffect, useState } from 'react'
import { expect, waitFor, within } from 'storybook/test'
import type { MatchPageData } from '../../components/data/match-page-data'
import {
  matchPageBasketball,
  matchPageFinished,
  matchPageLive,
  matchPageScheduled,
  publicBasketballTournament,
  publicCupTournament,
  publicTournament,
  scheduleTimeZone,
} from '../../lib/demo-data'
import { desktop1280, phone375 } from '../../test/viewport'
import { publicTabs } from '../public-nav'
import type { PublicShellTournament } from '../public-shell-tournament'
import { Shell } from '../shell'
import { MatchLoading, MatchScreen } from './match'

const meta = {
  title: 'Strona publiczna/Ekrany/Mecz',
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const leagueTabs = publicTabs([{ type: 'league' }])
const cupTabs = publicTabs([{ type: 'knockout' }])

/** Adres zakładki powrotu jak w `apps/public` (`tabHref`). */
const backHref = (slug: string) => (key: 'fixtures' | 'results') => `/t/${slug}/${key === 'fixtures' ? 'terminarz' : 'wyniki'}`

function Screen({ match, tournament = publicTournament, tabs = leagueTabs }: { match: MatchPageData; tournament?: PublicShellTournament; tabs?: typeof leagueTabs }) {
  return (
    <Shell tournament={tournament} tabs={tabs}>
      <MatchScreen match={match} backHref={backHref(tournament.slug)} timeZone={scheduleTimeZone} />
    </Shell>
  )
}

/** Powrót w `main`, poza zakładkami shella. */
function back(canvasElement: HTMLElement) {
  return within(within(canvasElement).getByRole('main')).getAllByRole('link')[0]!
}

/** Kolejność bloków ekranu: powrót, tablica, relacja. */
async function expectOrder(canvasElement: HTMLElement) {
  const blocks = ['[data-slot="back-to"]', '[data-slot="match-board"]', '[data-slot="match-relation"], [data-slot="empty-board"]'].map(
    (selector) => canvasElement.querySelector<HTMLElement>(selector)!.getBoundingClientRect().top,
  )
  await expect(blocks).toEqual([...blocks].sort((a, b) => a - b))
}

export const PilkaPoMeczu: Story = {
  name: 'Piłka po meczu',
  render: () => <Screen match={matchPageFinished} />,
  play: async ({ canvasElement }) => {
    await expect(back(canvasElement)).toHaveTextContent('Wyniki')
    await expect(back(canvasElement)).toHaveAttribute('href', `/t/${publicTournament.slug}/wyniki`)
    await expect(within(canvasElement).getByRole('region', { name: 'Przebieg meczu' })).toBeInTheDocument()
    await expectOrder(canvasElement)
  },
}

export const PilkaNaZywo: Story = {
  name: 'Piłka na żywo',
  render: () => <Screen match={matchPageLive} />,
  play: async ({ canvasElement }) => {
    await expect(back(canvasElement)).toHaveTextContent('Wyniki')
    await expect(within(canvasElement).getByRole('region', { name: 'Relacja na żywo' })).toBeInTheDocument()
  },
}

/** Telefon: ta sama kolejność, bez przewijania w bok. */
export const PilkaNaZywoTelefon: Story = {
  name: 'Piłka na żywo, telefon',
  render: () => <Screen match={matchPageLive} />,
  parameters: { ...phone375.parameters },
  globals: phone375.globals,
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBe(375)
    await expectOrder(canvasElement)
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  },
}

export const Zaplanowany: Story = {
  render: () => <Screen match={matchPageScheduled} />,
  play: async ({ canvasElement }) => {
    await expect(back(canvasElement)).toHaveTextContent('Terminarz')
    await expect(back(canvasElement)).toHaveAttribute('href', `/t/${publicTournament.slug}/terminarz`)
    await expect(within(canvasElement).getByRole('heading', { name: 'Mecz jeszcze się nie zaczął' })).toBeInTheDocument()
  },
}

const thirdPlace: MatchPageData = {
  ...matchPageFinished,
  round: { name: 'Finał' },
  homeScore: 1,
  awayScore: 1,
  homePenalties: 3,
  awayPenalties: 4,
  bracket: { label: 'Mecz o 3. miejsce', penaltySlot: true },
}

export const MeczOTrzecieMiejscePoKarnych: Story = {
  name: 'Mecz o 3. miejsce po karnych',
  render: () => <Screen match={thirdPlace} tournament={publicCupTournament} tabs={cupTabs} />,
  play: async ({ canvasElement }) => {
    const board = within(canvasElement.querySelector<HTMLElement>('[data-slot="match-board"]')!)
    await expect(board.getByText('Mecz o 3. miejsce')).toBeInTheDocument()
    await expect(board.getByLabelText('Wynik 1 : 1, karne 3 : 4')).toBeInTheDocument()
  },
}

export const KoszykowkaPoMeczu: Story = {
  name: 'Koszykówka po meczu',
  render: () => <Screen match={matchPageBasketball} tournament={publicBasketballTournament} />,
}

export const KoszykowkaNaZywo: Story = {
  name: 'Koszykówka na żywo',
  render: () => <Screen match={{ ...matchPageBasketball, status: 'live' }} tournament={publicBasketballTournament} />,
}

/** Pierwsze wczytanie: szkielet w kształcie ekranu, który znika, gdy przyjdą dane. */
function FirstLoad() {
  const [match, setMatch] = useState<MatchPageData | null>(null)
  useEffect(() => {
    const timer = setTimeout(() => setMatch(matchPageFinished), 400)
    return () => clearTimeout(timer)
  }, [])
  return (
    <Shell tournament={publicTournament} tabs={leagueTabs}>
      {match ? <MatchScreen match={match} backHref={backHref(publicTournament.slug)} timeZone={scheduleTimeZone} /> : <MatchLoading />}
    </Shell>
  )
}

export const Wczytywanie: Story = {
  render: () => <FirstLoad />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const status = canvas.getByRole('status', { name: 'Wczytywanie meczu' })
    await expect(status.querySelector('[data-slot="match-skeleton-board"]')).not.toBeNull()
    await waitFor(() => expect(canvas.getByRole('region', { name: /^Mecz: / })).toBeInTheDocument())
    await expect(canvas.queryByRole('status', { name: 'Wczytywanie meczu' })).not.toBeInTheDocument()
  },
}
