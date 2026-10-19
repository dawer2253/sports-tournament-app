import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import {
  publicBasketballLists,
  publicBasketballTournament,
  publicCupLists,
  publicCupTournament,
  publicFinishedLists,
  publicGroupLists,
  publicLeagueLists,
  publicTournament,
} from '../../lib/demo-data'
import { expectNoSideScroll, expectScoreWindowsAligned, nameProblems } from '../../test/match-list'
import { desktop1280, phone375 } from '../../test/viewport'
import { RoundsDemo } from './rounds-demo'

const meta = {
  title: 'Strona publiczna/Ekrany/Wyniki',
  component: RoundsDemo,
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
  args: { mode: 'results', tournament: publicTournament, lists: publicLeagueLists },
} satisfies Meta<typeof RoundsDemo>

export default meta
type Story = StoryObj<typeof meta>

/** Nazwy pokazanych kolejek w kolejności z DOM-u. */
function shownRounds(canvasElement: HTMLElement) {
  return within(canvasElement)
    .getAllByRole('region')
    .map((region) => within(region).getByRole('heading', { level: 2 }).textContent)
}

/** Liga piłkarska: kolejki od najnowszej, krótki dzień w wierszu, bez postępu, przegrany przygaszony. */
export const Liga: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 2, name: 'Wyniki' })).toBeInTheDocument()
    await expect(shownRounds(canvasElement)).toEqual(['Kolejka 5', 'Kolejka 4', 'Kolejka 3'])
    await expect(canvasElement.querySelector('[data-slot="page-head"] [data-slot="fact"]')?.textContent).toBe(
      `${publicLeagueLists.results.length} meczów zakończonych`,
    )
    await expect(canvasElement).not.toHaveTextContent(/rozegrane/)
    await expectScoreWindowsAligned(canvasElement)
  },
}

/** Koszykówka: wynik trzycyfrowy mieści się w tym samym okienku. */
export const Koszykowka: Story = {
  name: 'Koszykówka',
  args: { tournament: publicBasketballTournament, lists: publicBasketballLists },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent('102')
    await expectScoreWindowsAligned(canvasElement)
  },
}

/** Puchar: karne przy nazwie, przegrany po karnych przygaszony. */
export const Puchar: Story = {
  args: { tournament: publicCupTournament, lists: publicCupLists, stages: [{ type: 'knockout' }] },
  play: async ({ canvasElement }) => {
    const penalties = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="penalties"]')]
    await expect(penalties).toHaveLength(2)
    await expect(penalties[0]).toHaveTextContent(/\(\d\) w karnych/)
    const dimmed = penalties.filter((pens) => pens.parentElement!.classList.contains('text-muted-foreground'))
    await expect(dimmed).toHaveLength(1)
    await expectScoreWindowsAligned(canvasElement)
  },
}

/** Grupy i playoff: mecz grupy z nazwą grupy. */
export const Grupy: Story = {
  args: { tournament: { ...publicTournament, name: 'Grupy Osiedlowe 2026', slug: 'grupy-osiedlowe-2026' }, lists: publicGroupLists, stages: [{ type: 'group' }, { type: 'knockout' }] },
  play: async ({ canvasElement }) => {
    const labels = [...canvasElement.querySelectorAll('[data-slot="match-label"]')].map((label) => label.textContent)
    await expect(labels).toContain('Grupa A')
    await expect(labels).toContain('Grupa B')
  },
}

/** Turniej bez meczów: na Wynikach ten sam stan co na Terminarzu. */
export const BezTerminarza: Story = {
  name: 'Bez terminarza',
  args: { lists: { fixtures: [], results: [] } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { name: 'Terminarz jeszcze nie jest ułożony' })).toBeInTheDocument()
  },
}

/** Przed pierwszym meczem: „Jeszcze nie ma wyników” z odnośnikiem do Terminarza. */
export const PrzedPierwszymMeczem: Story = {
  name: 'Przed pierwszym meczem',
  args: { lists: { fixtures: publicLeagueLists.fixtures, results: [] } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Jeszcze nie ma wyników' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Zobacz terminarz' })).toHaveAttribute('href', `/t/${publicTournament.slug}/terminarz`)
  },
}

/** Wszystko rozegrane: pełne Wyniki zakończonego sezonu. */
export const WszystkoRozegrane: Story = {
  name: 'Wszystko rozegrane',
  args: { lists: publicFinishedLists },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('button', { name: 'Pokaż więcej' })).toBeInTheDocument()
  },
}

/** Telefon 375: okienka w jednej kolumnie, nazwy bez wielokropka, bez przewijania w bok. */
export const Telefon: Story = {
  ...phone375,
  args: { tournament: publicCupTournament, lists: publicCupLists, stages: [{ type: 'knockout' }] },
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBe(375)
    await expectScoreWindowsAligned(canvasElement)
    await expect(nameProblems(canvasElement)).toEqual([])
    await expectNoSideScroll()
  },
}

/** Pierwsze wczytanie: szkielet w kształcie ekranu, który znika po danych. */
export const Wczytywanie: Story = {
  args: { loadingMs: 400 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status', { name: 'Wczytywanie wyników' })).toBeInTheDocument()
    await waitFor(() => expect(canvas.queryByRole('status', { name: 'Wczytywanie wyników' })).not.toBeInTheDocument(), { timeout: 3000 })
    await expect(canvas.getAllByRole('region').length).toBeGreaterThan(0)
  },
}
