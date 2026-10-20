import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import type { MatchRowData } from '../components/data/match-row-data'
import {
  DEMO_CLOCK_NOW,
  demoBracket,
  demoClockSettings,
  matchPageLive,
  publicFixtures,
  scheduleTimeZone,
  volleyballClockSettings,
} from '../lib/demo-data'
import type { MatchClockSettings, MatchClockState } from '../lib/match-clock'
import { nameProblems } from '../test/match-list'
import { phone375, textFitProblems } from '../test/viewport'
import { BracketTile } from './bracket'
import { MatchClockProvider } from './live'
import { MatchBoard } from './match-board'
import { MatchRow } from './match-row'
import { StageMatchBoard } from './stage-band'

/**
 * Zegar meczu na żywo (#297): ten sam dopisek przy „Na żywo” w wierszu
 * Terminarza, na tablicy pasa Przeglądu, na kaflu Drabinki i na tablicy
 * strony meczu. Każda story to jeden stan zegara; „teraz” stoi w miejscu
 * (`DEMO_CLOCK_NOW`), więc minuta się nie zmienia.
 */
const meta = {
  title: 'Strona publiczna/Komponenty/Zegar meczu',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const MINUTE = 60_000

/** Start części `minutes` minut przed „teraz” demo. */
function startedAgo(minutes: number): string {
  return new Date(DEMO_CLOCK_NOW.getTime() - minutes * MINUTE).toISOString()
}

const running = (livePeriod: number, minutesAgo: number): MatchClockState => ({
  livePeriod,
  periodStartedAt: startedAgo(minutesAgo),
  onBreak: false,
})

const liveRow = publicFixtures.find((match) => match.status === 'live')!

/** Ten sam mecz trwający we wszystkich czterech miejscach z „Na żywo”. */
function Everywhere({
  clock,
  settings = demoClockSettings.football,
  longNames = false,
}: {
  clock: MatchClockState
  settings?: MatchClockSettings
  /** Nazwy po 20 znaków (#239): zegar nie może odebrać im miejsca. */
  longNames?: boolean
}) {
  const names = longNames
    ? { homeTeam: { id: 31, name: 'Niedźwiedzie Mokotów', logoUrl: null }, awayTeam: { id: 32, name: 'Jastrzębie Białołęka', logoUrl: null } }
    : {}
  const row: MatchRowData = { ...liveRow, ...clock, ...names }
  const cup = demoBracket({ teams: 4 }).map((match) => (match.id === 1001 ? { ...match, status: 'live' as const, homeScore: 1, awayScore: 0, ...clock } : match))
  const tile = cup.find((match) => match.id === 1001)!
  return (
    <MatchClockProvider settings={settings} now={DEMO_CLOCK_NOW}>
      <div className="grid max-w-3xl gap-6">
        <section data-place="Wiersz Terminarza">
          <MatchRow match={row} mode="fixtures" timeZone={scheduleTimeZone} href="/t/demo/mecze/1" />
        </section>
        <section data-place="Tablica Przeglądu" className="w-72">
          <StageMatchBoard match={row} timeZone={scheduleTimeZone} href="/t/demo/mecze/1" />
        </section>
        <section data-place="Kafel Drabinki" className="w-60">
          <BracketTile match={tile} matches={cup} timeZone={scheduleTimeZone} href="/t/demo/mecze/1001" />
        </section>
        <section data-place="Tablica strony meczu">
          <MatchBoard match={{ ...matchPageLive, ...clock, ...names }} timeZone={scheduleTimeZone} />
        </section>
      </div>
    </MatchClockProvider>
  )
}

const places = (canvasElement: HTMLElement) => [...canvasElement.querySelectorAll<HTMLElement>('[data-place]')]

/** W każdym z czterech miejsc przy „Na żywo” stoi ten sam napis zegara (albo żaden). */
async function expectClockEverywhere(canvasElement: HTMLElement, expected: string | null) {
  const all = places(canvasElement)
  await expect(all).toHaveLength(4)
  for (const place of all) {
    const live = place.querySelector('[data-slot="live-badge"], [data-slot="live-tag"]')
    await expect(live, place.dataset.place).not.toBeNull()
    const clocks = [...place.querySelectorAll<HTMLElement>('[data-slot="live-clock"]')].map((clock) => clock.textContent)
    await expect({ place: place.dataset.place, clocks }).toEqual({ place: place.dataset.place, clocks: expected === null ? [] : [expected] })
  }
}

/** Zegar mieści się w swoim miejscu: nie wystaje z kafla, wiersza ani tablicy i nie łamie się. */
async function expectClockFits(canvasElement: HTMLElement) {
  await document.fonts.ready
  for (const place of places(canvasElement)) {
    const clock = place.querySelector<HTMLElement>('[data-slot="live-clock"]')!
    const box = clock.getBoundingClientRect()
    const container = (clock.closest('[data-slot="match-when"], [data-slot="bracket-tile"], [data-slot="stage-board"], [data-slot="match-board"]') ?? place).getBoundingClientRect()
    await expect({ place: place.dataset.place, inside: box.right <= container.right + 0.5 && box.left >= container.left - 0.5 }).toEqual({
      place: place.dataset.place,
      inside: true,
    })
    await expect({ place: place.dataset.place, lines: clock.getClientRects().length }).toEqual({ place: place.dataset.place, lines: 1 })
  }
}

/** 1. połowa, 22 pełne minuty od startu: 23′. */
export const PierwszaPolowa: Story = {
  name: '1. połowa',
  render: () => <Everywhere clock={running(1, 22)} />,
  play: async ({ canvasElement }) => expectClockEverywhere(canvasElement, '23′'),
}

/** 2. połowa po 48 pełnych minutach: regulaminowe 90′ minęło, więc doliczony „90+4′”. */
export const DoliczonyCzas: Story = {
  name: 'Doliczony czas',
  render: () => <Everywhere clock={running(2, 48)} />,
  play: async ({ canvasElement }) => {
    await expectClockEverywhere(canvasElement, '90+4′')
    await expectClockFits(canvasElement)
  },
}

/** Przerwa po 1. połowie: „Przerwa” zamiast minuty. */
export const Przerwa: Story = {
  render: () => <Everywhere clock={{ livePeriod: 1, periodStartedAt: null, onBreak: true }} />,
  play: async ({ canvasElement }) => expectClockEverywhere(canvasElement, 'Przerwa'),
}

/** Start 2. połowy: zawsze 46′, niezależnie od doliczonego w 1. połowie. */
export const StartDrugiejPolowy: Story = {
  name: 'Start 2. połowy',
  render: () => <Everywhere clock={running(2, 0)} />,
  play: async ({ canvasElement }) => expectClockEverywhere(canvasElement, '46′'),
}

/** Koszykówka (`runningClock: false`): kwarta zamiast minuty. */
export const KoszWKwarcie: Story = {
  name: 'Kosz w kwarcie',
  render: () => <Everywhere clock={running(3, 4)} settings={demoClockSettings.basketball} />,
  play: async ({ canvasElement }) => expectClockEverywhere(canvasElement, '3. kwarta'),
}

/** Siatkówka w 1. secie, jeszcze bez wpisanego wyniku: „1. set” w tym samym zapisie co kwarta. */
export const SiatkowkaPierwszySet: Story = {
  name: 'Siatkówka, 1. set',
  render: () => <Everywhere clock={{ ...running(1, 4), sets: [] }} settings={volleyballClockSettings} />,
  play: async ({ canvasElement }) => expectClockEverywhere(canvasElement, '1. set'),
}

/** Siatkówka przy 2:2: piąty, decydujący set niedokończony (8:6) to „5. set”. */
export const SiatkowkaPiatySet: Story = {
  name: 'Siatkówka, 5. set',
  render: () => (
    <Everywhere
      clock={{
        ...running(1, 4),
        sets: [
          { home: 25, away: 20 },
          { home: 22, away: 25 },
          { home: 25, away: 23 },
          { home: 20, away: 25 },
          { home: 8, away: 6 },
        ],
      }}
      settings={volleyballClockSettings}
    />
  ),
  play: async ({ canvasElement }) => expectClockEverywhere(canvasElement, '5. set'),
}

/** Część po ostatniej w meczu pucharowym: „Dogrywka” bez minuty. */
export const Dogrywka: Story = {
  render: () => <Everywhere clock={running(3, 7)} />,
  play: async ({ canvasElement }) => expectClockEverywhere(canvasElement, 'Dogrywka'),
}

/** Turniej bez podziału: zegar liczy od startu meczu, bez przerwy. */
export const BezPodzialu: Story = {
  name: 'Turniej bez podziału',
  render: () => <Everywhere clock={running(1, 30)} settings={{ periods: { count: 1, minutes: null }, matchDuration: 60, runningClock: true }} />,
  play: async ({ canvasElement }) => expectClockEverywhere(canvasElement, '31′'),
}

/** Mecz wrócił z „Zakończony” do „Trwa”: samo „Na żywo”, bez minuty i bez „Przerwa”. */
export const PoPowrocieZZakonczonego: Story = {
  name: 'Po powrocie z zakończonego',
  render: () => <Everywhere clock={{ livePeriod: 2, periodStartedAt: null, onBreak: false }} />,
  play: async ({ canvasElement }) => expectClockEverywhere(canvasElement, null),
}

/**
 * Najdłuższy zapis, „90+30′”, na telefonie 375 przy długich nazwach: mieści
 * się w kolumnie terminu, w kaflu i na tablicach, a nazwy drużyn nie łamią słów.
 */
export const NajdluzszyNaTelefonie: Story = {
  name: 'Najdłuższy zapis na telefonie',
  ...phone375,
  render: () => <Everywhere clock={running(2, 74)} longNames />,
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBe(375)
    await expectClockEverywhere(canvasElement, '90+30′')
    await expectClockFits(canvasElement)
    // Zegar nie odbiera miejsca nazwom drużyn: żadna nie łamie słowa ani nie wystaje.
    const boardNames = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="match-board-team"] > span:last-child')]
    await expect(boardNames).toHaveLength(2)
    await expect([...nameProblems(canvasElement), ...boardNames.flatMap(textFitProblems)]).toEqual([])
  },
}

/**
 * Kafel w najwęższej kolumnie Drabinki (trzy kolumny w 600 px): przy zegarze
 * „Na żywo” zostaje dla czytnika, a widać kropkę i zegar, więc „Mecz o 3.
 * miejsce” nie traci liter.
 */
export const KafelWWaskiejKolumnie: Story = {
  name: 'Kafel w wąskiej kolumnie',
  render: () => {
    const cup = demoBracket({ teams: 4 }).map((match) =>
      match.id === 2002 ? { ...match, status: 'live' as const, homeScore: 0, awayScore: 0, ...running(2, 74) } : match,
    )
    return (
      <div style={{ width: (600 - 2 * 28) / 3 }}>
        <BracketTile match={cup.find((match) => match.id === 2002)!} matches={cup} timeZone={scheduleTimeZone} href="/t/demo/mecze/2002" />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    await document.fonts.ready
    const tile = canvasElement.querySelector<HTMLElement>('[data-slot="bracket-tile"]')!
    const label = [...tile.querySelectorAll<HTMLElement>('span.truncate')].find((span) => span.textContent === 'Mecz o 3. miejsce')!
    await expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth)
    await expect(tile.querySelector('[data-slot="live-clock"]')).toHaveTextContent('90+30′')
    await expect(tile.querySelector('[data-slot="live-tag"] .sr-only')).toHaveTextContent('Na żywo')
  },
}
