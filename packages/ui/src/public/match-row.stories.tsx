import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import type { MatchRowData } from '../components/data/match-row-data'
import {
  matchPageVolleyball,
  matchPageVolleyballLive,
  publicBasketballLists,
  publicCupLists,
  publicFixtures,
  publicResults,
  scheduleTimeZone,
  volleyballClockSettings,
} from '../lib/demo-data'
import { expectLiveBadgeFits, expectNoSideScroll, expectScoreWindowsAligned, nameProblems } from '../test/match-list'
import { desktop1280, phone375 } from '../test/viewport'
import { MatchClockProvider } from './live'
import { MatchRow, type MatchListMode } from './match-row'

const meta = {
  title: 'Strona publiczna/Komponenty/Wiersz meczu',
  component: MatchRow,
  parameters: { layout: 'padded', ...desktop1280.parameters },
  globals: desktop1280.globals,
  args: { match: publicResults[0]!, mode: 'results', timeZone: scheduleTimeZone },
} satisfies Meta<typeof MatchRow>

export default meta
type Story = StoryObj<typeof meta>

const withLogo = publicResults.find((match) => match.homeTeam?.logoUrl || match.awayTeam?.logoUrl)!
const live = publicFixtures.find((match) => match.status === 'live')!
const scheduled = publicFixtures.find((match) => match.status === 'scheduled')!
const penalties = publicCupLists.results.find((match) => match.homePenalties != null)!
const emptySlot = publicCupLists.fixtures.find((match) => !match.homeTeam || !match.awayTeam)!
const emptySource = emptySlot.homeTeam ? emptySlot.bracket!.awaySource! : emptySlot.bracket!.homeSource!
const basketball = publicBasketballLists.results.find((match) => (match.homeScore ?? 0) >= 100)!

/** Wiersze w każdym stanie i formacie: liga z herbem, trwający, zaplanowany, karne, pusty slot, kosz. */
const mixed: { match: MatchRowData; mode: MatchListMode }[] = [
  { match: withLogo, mode: 'results' },
  { match: live, mode: 'fixtures' },
  { match: scheduled, mode: 'fixtures' },
  { match: penalties, mode: 'results' },
  { match: emptySlot, mode: 'fixtures' },
  { match: basketball, mode: 'results' },
]

function Rows({ rows, className }: { rows: { match: MatchRowData; mode: MatchListMode }[]; className?: string }) {
  return (
    <div data-slot="rows" className={className}>
      {rows.map(({ match, mode }) => (
        <MatchRow key={match.id} match={match} mode={mode} timeZone={scheduleTimeZone} href={`/t/demo/mecze/${match.id}`} />
      ))}
    </div>
  )
}

/**
 * Stałe kolumny: okienka wyniku stoją w tym samym miejscu w lidze, pucharze
 * z karnymi i bez, w pustym slocie i w koszykówce (trzy cyfry), a plakietka
 * „Na żywo” mieści się w jednej linii z miejscem na minutę.
 */
export const Wiersze: Story = {
  render: () => <Rows rows={mixed} className="max-w-[1104px]" />,
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBe(1280)
    await expectScoreWindowsAligned(canvasElement)
    await expectLiveBadgeFits(canvasElement)
    const canvas = within(canvasElement)
    // Herb wgrany przy drużynie, a przy reszcie herb zastępczy; pusty slot bez herbu.
    const teams = mixed.flatMap(({ match }) => [match.homeTeam, match.awayTeam]).filter((team) => team !== null)
    const uploaded = teams.filter((team) => team.logoUrl !== null)
    await expect(uploaded.length).toBeGreaterThan(0)
    await expect(canvasElement.querySelectorAll('[data-slot="crest"] img')).toHaveLength(uploaded.length)
    await expect(canvasElement.querySelectorAll('[data-slot="crest-fallback"]')).toHaveLength(teams.length - uploaded.length)
    await expect(canvas.getByText(emptySource)).toHaveClass('italic')
    // Przegrany po karnych przygaszony, karne przy nazwie.
    const loser = penalties.homePenalties! < penalties.awayPenalties! ? 'home' : 'away'
    const loserName = loser === 'home' ? penalties.homeTeam!.name : penalties.awayTeam!.name
    await expect(canvas.getByText(loserName).parentElement).toHaveClass('text-muted-foreground')
  },
}

/** Telefon 375: termin z lewej, dwie linie drużyna–wynik, okienka dalej w jednej kolumnie. */
export const Telefon: Story = {
  ...phone375,
  // Szerokość treści strony przy 375 px (`main` z `px-4`).
  render: () => <Rows rows={mixed} className="w-[343px] max-w-full" />,
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBe(375)
    await expectScoreWindowsAligned(canvasElement)
    await expectLiveBadgeFits(canvasElement)
    await expectNoSideScroll()
  },
}

/** Nazwy do 20 znaków i podpisy pustych slotów (#239), z karnymi i w meczu trwającym. */
const longRows: { match: MatchRowData; mode: MatchListMode }[] = [
  {
    mode: 'results',
    match: {
      ...penalties,
      id: 921,
      homeTeam: { id: 31, name: 'Niedźwiedzie Mokotów', logoUrl: null },
      awayTeam: { id: 32, name: 'Jastrzębie Białołęka', logoUrl: null },
    },
  },
  {
    mode: 'fixtures',
    match: { ...live, id: 922, homeTeam: { id: 33, name: 'Gepardy Śródmieście', logoUrl: null }, awayTeam: { id: 34, name: 'Nosorożce Targówek', logoUrl: null } },
  },
  {
    mode: 'fixtures',
    match: { ...emptySlot, id: 923, homeTeam: null, awayTeam: null, bracket: { label: 'Mecz o 3. miejsce', homeSource: 'Przegrany: Półfinał 1', awaySource: 'Przegrany: Półfinał 2', penaltySlot: true } },
  },
  {
    mode: 'fixtures',
    match: { ...emptySlot, id: 924, homeTeam: null, awayTeam: null, bracket: { label: 'Finał', homeSource: 'Zwycięzca: Półfinał 1', awaySource: 'Zwycięzca: Półfinał 2', penaltySlot: true } },
  },
]

/**
 * Telefon 375 (#239): nazwy do 20 znaków i podpisy pustych slotów łamią się
 * na drugą linię bez wielokropka, bez uciętych wydłużeń liter i bez łamania
 * słów, w każdej szerokości układu telefonu (od 343 px do progu `lg`).
 */
export const DlugieNazwyNaTelefonie: Story = {
  ...phone375,
  render: () => <Rows rows={longRows} className="w-[343px] max-w-full" />,
  play: async ({ canvasElement }) => {
    await document.fonts.ready
    await expect(nameProblems(canvasElement)).toEqual([])
    await expectNoSideScroll()
    const container = canvasElement.querySelector<HTMLElement>('[data-slot="rows"]')!
    container.classList.remove('max-w-full')
    const problems: string[] = []
    for (let width = 343; width < 976; width += 16) {
      container.style.width = `${width}px`
      problems.push(...nameProblems(canvasElement).map((problem) => `${width}px: ${problem}`))
    }
    await expect(problems).toEqual([])
  },
}

/** Te same nazwy w szerokim układzie, od najwęższej treści przy 1024 px do pełnej szerokości przy 1280 px. */
export const DlugieNazwySzeroko: Story = {
  render: () => <Rows rows={longRows} className="w-[1104px]" />,
  play: async ({ canvasElement }) => {
    await document.fonts.ready
    const container = canvasElement.querySelector<HTMLElement>('[data-slot="rows"]')!
    const problems: string[] = []
    for (let width = 976; width <= 1104; width += 16) {
      container.style.width = `${width}px`
      problems.push(...nameProblems(canvasElement).map((problem) => `${width}px: ${problem}`))
    }
    await expect(problems).toEqual([])
  },
}

/**
 * Cały wiersz to jeden odnośnik z nazwą „Gospodarz – Gość”: klik idzie do
 * routera (`onNavigate`), a klik z Ctrl zostaje przeglądarce.
 */
export const Odnosnik: Story = {
  args: { match: withLogo, href: '/t/liga-osiedlowa-2026/mecze/1', onNavigate: fn() },
  play: async ({ args, canvasElement }) => {
    const link = within(canvasElement).getByRole('link', { name: `${withLogo.homeTeam!.name} – ${withLogo.awayTeam!.name}` })
    await expect(link).toHaveAttribute('href', '/t/liga-osiedlowa-2026/mecze/1')
    await expect(within(canvasElement).getAllByRole('link')).toHaveLength(1)
    // Klik z Ctrl: wiersz go nie przejmuje (`defaultPrevented` zostaje `false`),
    // a router go nie dostaje. Słuchacz na `window` blokuje potem domyślną
    // akcję, żeby story nie otworzyło karty.
    let prevented: boolean | undefined
    window.addEventListener(
      'click',
      (event) => {
        prevented = event.defaultPrevented
        event.preventDefault()
      },
      { once: true },
    )
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }))
    await expect(prevented).toBe(false)
    await expect(args.onNavigate).not.toHaveBeenCalled()
    await userEvent.click(link)
    await expect(args.onNavigate).toHaveBeenCalledOnce()
  },
}

/**
 * Siatkówka (#301): okienka niosą sety wygrane, a pod nimi wyśrodkowana linia
 * wyników setów. W meczu trwającym trzeci set jest niedokończony (14:12)
 * i nie zmienia wyniku 1:1, a przy „Na żywo” stoi „3. set” (#302).
 */
export const Siatkowka: Story = {
  name: 'Siatkówka',
  render: () => (
    <MatchClockProvider settings={volleyballClockSettings}>
      <Rows
        rows={[
          { match: matchPageVolleyball, mode: 'results' },
          { match: matchPageVolleyballLive, mode: 'fixtures' },
        ]}
        className="max-w-[1104px]"
      />
    </MatchClockProvider>
  ),
  play: async ({ canvasElement }) => {
    await expectScoreWindowsAligned(canvasElement)
    const rows = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="match-row"]')]
    const windows = (row: HTMLElement) => [...row.querySelectorAll('[data-slot="score-cell"]')].map((cell) => cell.textContent)
    await expect(rows.map(windows)).toEqual([
      ['3', '2'],
      ['1', '1'],
    ])
    await expect(rows.map((row) => row.querySelector('[data-slot="match-sets"]')?.textContent)).toEqual([
      'Sety: 25:23, 23:25, 25:21, 20:25, 15:11',
      'Sety: 25:21, 18:25, 14:12',
    ])
    await expect(rows.map((row) => [...row.querySelectorAll('[data-slot="live-clock"]')].map((clock) => clock.textContent))).toEqual([[], ['3. set']])
    // Linia setów stoi pod okienkami, a nie obok nich.
    const sets = rows[0]!.querySelector('[data-slot="match-sets"]')!.getBoundingClientRect()
    const score = rows[0]!.querySelector('[data-slot="score-cell"]')!.getBoundingClientRect()
    await expect(sets.top).toBeGreaterThanOrEqual(score.bottom)
  },
}

/** Siatkówka na telefonie: linia setów pod drużynami, bez poziomego przewijania. */
export const SiatkowkaTelefon: Story = {
  name: 'Siatkówka, telefon',
  ...phone375,
  render: () => <Rows rows={[{ match: matchPageVolleyball, mode: 'results' }]} />,
  play: async ({ canvasElement }) => {
    await expectNoSideScroll()
    const away = canvasElement.querySelectorAll<HTMLElement>('[data-slot="match-team"]')[1]!.getBoundingClientRect()
    const sets = canvasElement.querySelector<HTMLElement>('[data-slot="match-sets"]')!.getBoundingClientRect()
    await expect(sets.top).toBeGreaterThanOrEqual(away.bottom)
  },
}
