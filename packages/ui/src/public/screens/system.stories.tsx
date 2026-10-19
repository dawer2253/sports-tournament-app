import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { publicCupTournament, publicTournament } from '../../lib/demo-data'
import { ownBrand } from '../../test/brand'
import { desktop1280 } from '../../test/viewport'
import { publicTabs, type PublicNavKey } from '../public-nav'
import { Shell } from '../shell'
import { LoadError, LoadingScreen, MatchNotFound, PageNotFound, TournamentNotFound } from './system'

/** Adres zakładki jak w `apps/public` (`tabHref`): trasy po polsku. */
const PATHS: Record<PublicNavKey, string> = { home: '', standings: 'tabela', bracket: 'drabinka', fixtures: 'terminarz', results: 'wyniki', stats: 'statystyki' }
const hrefFor = (slug: string) => (key: PublicNavKey) => (PATHS[key] ? `/t/${slug}/${PATHS[key]}` : `/t/${slug}`)

const meta = {
  title: 'Strona publiczna/Ekrany/Nie znaleziono i błędy',
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const leagueTabs = publicTabs([{ type: 'league' }])

/**
 * Brak turnieju: bez shella i na domyślnej zieleni, także przy przełączniku
 * „Kolor turnieju” na granacie — turnieju i jego koloru nie ma.
 */
export const BrakTurnieju: Story = {
  name: 'Brak turnieju',
  parameters: ownBrand,
  globals: { brandColor: 'granat' },
  render: () => <TournamentNotFound path="/t/liga-osiedlowa-2025" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 1, name: 'Nie ma takiego turnieju' })).toBeInTheDocument()
    await expect(canvas.queryByRole('navigation', { name: 'Sekcje turnieju' })).not.toBeInTheDocument()
    await expect(canvas.getByText('TournamentApp')).toBeInTheDocument()
    const root = canvasElement.querySelector<HTMLElement>('[data-slot="public-site"]')!
    await expect(getComputedStyle(root).getPropertyValue('--brand').trim()).toBe('#1F7A45')
  },
}

/** Nieznana podstrona pucharu: odnośniki do zakładek **tego** turnieju, bez Tabeli. */
export const NieznanaPodstrona: Story = {
  name: 'Nieznana podstrona',
  render: () => {
    const tabs = publicTabs([{ type: 'knockout' }])
    const navHref = hrefFor(publicCupTournament.slug)
    return (
      <Shell tournament={publicCupTournament} tabs={tabs} navHref={navHref}>
        <PageNotFound tabs={tabs} navHref={navHref} />
      </Shell>
    )
  },
  play: async ({ canvasElement }) => {
    const links = within(within(canvasElement).getByRole('navigation', { name: 'Zakładki turnieju' })).getAllByRole('link')
    const slug = publicCupTournament.slug
    await expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Przegląd', `/t/${slug}`],
      ['Drabinka', `/t/${slug}/drabinka`],
      ['Terminarz', `/t/${slug}/terminarz`],
      ['Wyniki', `/t/${slug}/wyniki`],
      ['Statystyki', `/t/${slug}/statystyki`],
    ])
    for (const link of within(within(canvasElement).getByRole('navigation', { name: 'Sekcje turnieju' })).getAllByRole('link')) {
      await expect(link).not.toHaveAttribute('aria-current')
    }
  },
}

/** Brak meczu: w shellu, z odnośnikiem do Terminarza. */
export const BrakMeczu: Story = {
  name: 'Brak meczu',
  render: () => (
    <Shell tournament={publicTournament} tabs={leagueTabs} navHref={hrefFor(publicTournament.slug)}>
      <MatchNotFound fixturesHref={hrefFor(publicTournament.slug)('fixtures')} />
    </Shell>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('link', { name: 'Wróć do terminarza' })).toHaveAttribute('href', '/t/liga-osiedlowa/terminarz')
  },
}

const onRetry = fn()

/** Błąd wczytywania zakładki: treść błędu i „Spróbuj ponownie”. */
export const Blad: Story = {
  name: 'Błąd',
  render: () => (
    <Shell tournament={publicTournament} tabs={leagueTabs} active="fixtures" navHref={hrefFor(publicTournament.slug)}>
      <LoadError title="Terminarz" label="terminarza" message="Brak połączenia z serwerem. Sprawdź internet i spróbuj jeszcze raz." onRetry={onRetry} />
    </Shell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 2, name: 'Nie udało się wczytać terminarza' })).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Spróbuj ponownie' }))
    await expect(onRetry).toHaveBeenCalled()
  },
}

/** Wczytywanie zakładki: szkielet w kształcie ekranu. */
export const Wczytywanie: Story = {
  render: () => (
    <Shell tournament={publicTournament} tabs={leagueTabs} active="fixtures" navHref={hrefFor(publicTournament.slug)}>
      <LoadingScreen label="terminarza" />
    </Shell>
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status', { name: 'Wczytywanie terminarza' })).toBeInTheDocument()
  },
}
