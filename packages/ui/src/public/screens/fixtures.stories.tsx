import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import {
  publicBasketballLists,
  publicBasketballTournament,
  publicCupLists,
  publicCupTournament,
  publicGroupLists,
  publicLeagueLists,
  publicTournament,
} from '../../lib/demo-data'
import { expectLiveBadgeFits, expectNoSideScroll, expectScoreWindowsAligned, nameProblems } from '../../test/match-list'
import { desktop1280, phone375 } from '../../test/viewport'
import { RoundsDemo } from './rounds-demo'

const meta = {
  title: 'Strona publiczna/Ekrany/Terminarz',
  component: RoundsDemo,
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
  args: { mode: 'fixtures', tournament: publicTournament, lists: publicLeagueLists },
} satisfies Meta<typeof RoundsDemo>

export default meta
type Story = StoryObj<typeof meta>

/** Fakt w nagłówku ekranu, np. „27 meczów przed nami”. */
function pageFact(canvasElement: HTMLElement) {
  return canvasElement.querySelector('[data-slot="page-head"] [data-slot="fact"]')?.textContent
}

/**
 * Liga piłkarska w trakcie: kolejki rosnąco z postępem całej kolejki (w
 * piątej część meczów jest już w Wynikach), mecz trwający z plakietką,
 * herb FC Górki wgrany, reszta zastępcza.
 */
export const Liga: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 2, name: 'Terminarz' })).toBeInTheDocument()
    await expect(pageFact(canvasElement)).toBe(`${publicLeagueLists.fixtures.length} meczów przed nami`)
    await expect(canvas.getByRole('region', { name: 'Kolejka 5' })).toHaveTextContent('1 z 4 rozegrane')
    await expect(canvasElement.querySelector('[data-slot="crest"] img')).not.toBeNull()
    await expectScoreWindowsAligned(canvasElement)
    await expectLiveBadgeFits(canvasElement)
  },
}

/** Koszykówka: wyniki trzycyfrowe w tych samych okienkach, kolejka na dwa dni z dniem w wierszu. */
export const Koszykowka: Story = {
  name: 'Koszykówka',
  args: { tournament: publicBasketballTournament, lists: publicBasketballLists },
  play: async ({ canvasElement }) => {
    await expectScoreWindowsAligned(canvasElement)
    await expectLiveBadgeFits(canvasElement)
    await expect(within(canvasElement).getByRole('region', { name: 'Kolejka 4' })).toHaveTextContent('0 z 2 rozegrane')
  },
}

/** Puchar: etykiety pozycji, mecz trwający i puste sloty finału ze źródłem kursywą. */
export const Puchar: Story = {
  args: { tournament: publicCupTournament, lists: publicCupLists, stages: [{ type: 'knockout' }] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect([...canvasElement.querySelectorAll('[data-slot="match-label"]')].map((label) => label.textContent)).toContain('Finał')
    await expect(canvas.getAllByText(/^(Zwycięzca|Przegrany): Półfinał \d$/)[0]).toHaveClass('italic')
    await expectScoreWindowsAligned(canvasElement)
  },
}

/** Grupy i playoff: mecz grupy niesie nazwę grupy, mecz playoffu etykietę pozycji. */
export const Grupy: Story = {
  args: { tournament: { ...publicTournament, name: 'Grupy Osiedlowe 2026', slug: 'grupy-osiedlowe-2026' }, lists: publicGroupLists, stages: [{ type: 'group' }, { type: 'knockout' }] },
  play: async ({ canvasElement }) => {
    const labels = [...canvasElement.querySelectorAll('[data-slot="match-label"]')].map((label) => label.textContent)
    await expect(labels).toContain('Grupa B')
    await expect(labels).toContain('Półfinał 1')
    await expectScoreWindowsAligned(canvasElement)
  },
}

/** Turniej bez meczów: „Terminarz jeszcze nie jest ułożony” z odnośnikiem do Przeglądu. */
export const BezTerminarza: Story = {
  name: 'Bez terminarza',
  args: { lists: { fixtures: [], results: [] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Terminarz jeszcze nie jest ułożony' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Zobacz drużyny na Przeglądzie' })).toHaveAttribute('href', `/t/${publicTournament.slug}`)
    await expect(pageFact(canvasElement)).toBeUndefined()
  },
}

/** Wszystko rozegrane: pusty Terminarz prowadzi do Wyników. */
export const WszystkoRozegrane: Story = {
  name: 'Wszystko rozegrane',
  args: { lists: { fixtures: [], results: publicLeagueLists.results } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Wszystkie mecze rozegrane' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Zobacz wyniki' })).toHaveAttribute('href', `/t/${publicTournament.slug}/wyniki`)
  },
}

/**
 * Telefon 375: termin z lewej, dwie linie drużyna–wynik, okienka w jednej
 * kolumnie, nazwy bez wielokropka i bez przewijania strony w bok.
 */
export const Telefon: Story = {
  ...phone375,
  args: { tournament: publicCupTournament, lists: publicCupLists, stages: [{ type: 'knockout' }] },
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBe(375)
    await expectScoreWindowsAligned(canvasElement)
    await expectLiveBadgeFits(canvasElement)
    await expect(nameProblems(canvasElement)).toEqual([])
    await expectNoSideScroll()
  },
}

/** Pierwsze wczytanie: szkielet w kształcie ekranu (`role="status"`), który znika po danych. */
export const Wczytywanie: Story = {
  args: { loadingMs: 400 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status', { name: 'Wczytywanie terminarza' })).toBeInTheDocument()
    await expect(canvasElement.querySelectorAll('[data-slot="skeleton-block"]').length).toBeGreaterThan(4)
    await waitFor(() => expect(canvas.queryByRole('status', { name: 'Wczytywanie terminarza' })).not.toBeInTheDocument(), { timeout: 3000 })
    await expect(canvas.getAllByRole('region').length).toBeGreaterThan(0)
  },
}
