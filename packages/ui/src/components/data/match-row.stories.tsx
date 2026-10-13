import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { scheduleInProgress, scheduleTimeZone, scheduleUndated } from '../../lib/demo-data'
import { cn } from '../../lib/utils'
import { MatchRow } from './match-row'
import type { MatchRowData, MatchScorer } from './match-row-data'

const meta = {
  title: 'UI/Wiersz meczu',
  component: MatchRow,
  parameters: { layout: 'padded' },
  args: { match: scheduleInProgress[0], timeZone: scheduleTimeZone },
} satisfies Meta<typeof MatchRow>

export default meta
type Story = StoryObj<typeof meta>

const finished = scheduleInProgress.find((match) => match.status === 'finished')!
const live = scheduleInProgress.find((match) => match.status === 'live')!
const scheduled = scheduleInProgress.find((match) => match.round.order === 6)!
const colliding = scheduleInProgress.find((match) => (match.collisions?.length ?? 0) > 0)!

/** Mecz z długimi nazwami: nazwa się obcina, a nie przesuwa wyniku. */
const longNames: MatchRowData = {
  ...scheduled,
  id: 999,
  homeTeam: { id: 901, name: 'Międzyszkolny Klub Sportowy Huragan Bemowo' },
  awayTeam: { id: 902, name: 'Orły' },
}

const undated: MatchRowData = { ...scheduleUndated[0], id: 998 }

const rows: MatchRowData[] = [finished, live, colliding, scheduled, longNames, undated]

/**
 * Pomiar w przeglądarce, nie w jsdom: kolumny po bokach mają stałą szerokość,
 * więc wynik stoi w tej samej pozycji poziomej w każdym wierszu, niezależnie
 * od plakietki stanu i długości nazw (#174, DoD).
 */
async function expectScoresAligned(canvasElement: HTMLElement) {
  const scores = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="match-score"]')]
  await expect(scores).toHaveLength(rows.length)
  const boxes = scores.map((score) => score.getBoundingClientRect())
  for (const box of boxes) {
    await expect(box.width).toBeGreaterThan(0)
    await expect(box.left).toBeCloseTo(boxes[0].left, 1)
    await expect(box.width).toBeCloseTo(boxes[0].width, 1)
  }
}

/**
 * Nazwa drużyny ma przynajmniej 80 px na każdej szerokości wiersza, a wiersz
 * nie wystaje poza siebie (#198). Układ zależy od miejsca, które wiersz
 * dostaje, a nie od okna — w panelu obok terminarza stoi lista kolejek.
 */
async function expectNamesReadable(canvasElement: HTMLElement) {
  const names = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="match-team"]')]
  await expect(names).toHaveLength(rows.length * 2)
  for (const name of names) {
    await expect(name.getBoundingClientRect().width).toBeGreaterThanOrEqual(80)
  }
  for (const row of canvasElement.querySelectorAll<HTMLElement>('[data-slot="match-row"]')) {
    await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
  }
}

/** Liczba kolumn siatki w każdym wierszu: 3 w wąskim, 6 w szerokim (#198). */
async function expectColumns(canvasElement: HTMLElement, count: 3 | 6) {
  for (const row of canvasElement.querySelectorAll<HTMLElement>('[data-slot="match-row"]')) {
    await expect(getComputedStyle(row).gridTemplateColumns.split(' ')).toHaveLength(count)
  }
}

function Rows({ timeZone, className = 'max-w-3xl' }: { timeZone?: string; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {rows.map((match) => (
        <MatchRow key={match.id} match={match} timeZone={timeZone} />
      ))}
    </div>
  )
}

/** Zakończony, trwający, zaplanowany, z długą nazwą i bez terminu. */
export const RoznePlakietki: Story = {
  render: (args) => <Rows timeZone={args.timeZone} />,
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expectColumns(canvasElement, 6)
    await expectScoresAligned(canvasElement)
    await expectNamesReadable(canvasElement)
  },
}

/**
 * Szerokie okno, wąskie miejsce: tak wygląda terminarz panelu przy oknie
 * ok. 1024 px, gdzie obok wierszy stoją sidebar i lista kolejek (#198).
 * Wiersz zostaje przy układzie trzykolumnowym, zamiast ściskać nazwy do zera.
 */
export const WaskiKontener: Story = {
  render: (args) => <Rows timeZone={args.timeZone} className="w-[480px]" />,
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBeGreaterThanOrEqual(1024)
    await expectColumns(canvasElement, 3)
    await expectScoresAligned(canvasElement)
    await expectNamesReadable(canvasElement)
  },
}

/**
 * Próg układu: kontener rośnie od telefonu do szerokiego terminarza, a na
 * każdej szerokości nazwy mają ≥ 80 px. Pilnuje, że próg nie zejdzie tam, gdzie
 * sześć kolumn ściska nazwy (#198). Stories z jedną szerokością tego nie
 * złapią: zbyt niski próg (np. `@xl`) dalej przechodzi przy 480 i 768 px.
 */
export const ProgUkladu: Story = {
  render: (args) => <Rows timeZone={args.timeZone} className="w-[320px]" />,
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    // Siatka wiersza → opakowanie `@container/match-row` → lista z `Rows`.
    const grid = canvasElement.querySelector<HTMLElement>('[data-slot="match-row"]')!
    const container = grid.parentElement!.parentElement!
    // Mierzy bez `expect` w pętli: w Storybooku każde `expect` trafia do panelu
    // Interactions, a kilkadziesiąt asercji na każdą z 37 szerokości
    // przekraczało 30 s, po których Chromatic przerywa story.
    const problems: string[] = []
    for (let width = 320; width <= 896; width += 16) {
      container.style.width = `${width}px`
      for (const name of canvasElement.querySelectorAll('[data-slot="match-team"]')) {
        const nameWidth = Math.round(name.getBoundingClientRect().width)
        if (nameWidth < 80) problems.push(`${width}px: nazwa ma ${nameWidth} px`)
      }
      for (const row of canvasElement.querySelectorAll('[data-slot="match-row"]')) {
        if (row.scrollWidth > row.clientWidth) problems.push(`${width}px: wiersz wystaje`)
      }
      const scoreLefts = [...canvasElement.querySelectorAll('[data-slot="match-score"]')].map(
        (score) => score.getBoundingClientRect().left,
      )
      if (Math.max(...scoreLefts) - Math.min(...scoreLefts) > 0.5) {
        problems.push(`${width}px: wyniki nie stoją w jednej kolumnie`)
      }
    }
    await expect(problems).toEqual([])
    await expectColumns(canvasElement, 6)
    container.style.width = '320px'
    await expectColumns(canvasElement, 3)
  },
}

/** Telefon: termin i stan nad parą, wynik dalej w środkowej kolumnie. */
export const Telefon: Story = {
  render: (args) => <Rows timeZone={args.timeZone} />,
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expectColumns(canvasElement, 3)
    await expectScoresAligned(canvasElement)
    await expectNamesReadable(canvasElement)
  },
}

export const Zakonczony: Story = { args: { match: finished } }

export const Trwa: Story = { args: { match: live } }

/** Bez daty i obiektu, tak jak zaraz po wygenerowaniu terminarza. */
export const BezTerminu: Story = { args: { match: scheduleUndated[0] } }

/** Kolejka w jednym dniu: data stoi nad listą, wiersz pokazuje samą godzinę. */
export const SamaGodzina: Story = { args: { match: scheduled, showDate: false } }

/** Kolizja terminu: plakietka w stałym slocie przed stanem, opis w `title` (#175). */
export const Kolizja: Story = { args: { match: colliding } }

// --- Strzelcy pod wynikiem (#208) ---------------------------------------------

const wilki = { id: 1, name: 'Wilki Bemowo' }
const sokoly = { id: 2, name: 'Sokoły Ursus' }
const zubry = { id: 4, name: 'Żubry Wola' }
const rysie = { id: 5, name: 'Rysie Mokotów' }

function scorer(team: MatchScorer['team'], id: number, name: string, value: number, minutes: number[], ownGoal = false): MatchScorer {
  return { team, player: { id, name }, value, minutes, ownGoal }
}

/**
 * Piłka 3:3: dwie bramki Nowaka z minutami, samobój Mazura z Sokołów (stoi
 * po stronie Wilków) i bramka Lisa bez minuty, więc w formacie sumy. Długie
 * nazwisko z dwiema minutami sprawdza, że nic się nie obcina.
 */
const footballScorers: MatchRowData = {
  ...finished,
  id: 801,
  homeTeam: wilki,
  awayTeam: sokoly,
  homeScore: 3,
  awayScore: 3,
  scorers: [
    scorer(wilki, 1, 'Marek Nowak', 2, [12, 58]),
    scorer(sokoly, 5, 'Konstanty Brzęczyszczykiewicz', 2, [23, 88]),
    scorer(sokoly, 8, 'Paweł Mazur', 1, [81], true),
    scorer(sokoly, 4, 'Tomasz Lis', 1, []),
  ],
}

/**
 * Kosz 90:70, w kolejności z API (po id zawodnika, bez minut). Żubry mają
 * czterech punktujących, więc widać trzech najlepszych. Sarna ma minuty, ale
 * nie przy każdym punkcie, więc też idzie w formacie sumy.
 */
const basketballScorers: MatchRowData = {
  ...finished,
  id: 802,
  homeTeam: zubry,
  awayTeam: rysie,
  homeScore: 90,
  awayScore: 70,
  scorers: [
    scorer(rysie, 13, 'Filip Sarna', 22, [3, 8]),
    scorer(zubry, 9, 'Igor Kowal', 12, []),
    scorer(zubry, 10, 'Kacper Lipa', 28, []),
    scorer(zubry, 11, 'Oskar Dąb', 31, []),
    scorer(zubry, 12, 'Bruno Klon', 19, []),
    scorer(rysie, 14, 'Hubert Łoś', 24, []),
  ],
}

/** Wpisy listy strzelców danej drużyny, w kolejności na ekranie. */
function scorerItems(canvasElement: HTMLElement, team: string): string[] {
  const list = within(canvasElement).getByRole('list', { name: `Strzelcy: ${team}` })
  return within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent ?? '')
}

/**
 * Wynik stoi w tym samym miejscu wiersza z listą strzelców i bez niej:
 * lista wydłuża wiersz w dół, a nie spycha wyniku.
 */
async function expectScoreUnmoved(canvasElement: HTMLElement) {
  const offsets = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="match-row"]')].map((row) => {
    const score = row.querySelector('[data-slot="match-score"]')!.getBoundingClientRect()
    const box = row.getBoundingClientRect()
    return { left: score.left - box.left, top: score.top - box.top }
  })
  for (const offset of offsets) {
    await expect(offset.left).toBeCloseTo(offsets[0]!.left, 1)
    await expect(offset.top).toBeCloseTo(offsets[0]!.top, 1)
  }
}

/**
 * Każdy wpis widać w całości, także w wąskiej kolumnie telefonu: wpis się
 * zawija, a minuty, suma i „(sam.)” stoją razem i nie wystają poza listę.
 */
async function expectEntriesWhole(canvasElement: HTMLElement) {
  const clipped = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="match-scorers"] li')].filter((item) => {
    const detail = item.lastElementChild!.getBoundingClientRect()
    const box = item.getBoundingClientRect()
    return item.scrollWidth > item.clientWidth || detail.left < box.left - 0.5 || detail.right > box.right + 0.5 || detail.height > 20
  })
  await expect(clipped.map((item) => item.textContent)).toEqual([])
}

function ScorerRows({ className = 'max-w-3xl' }: { className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {[footballScorers, basketballScorers, { ...finished, id: 803, scorers: [] }].map((match) => (
        <MatchRow key={match.id} match={match} timeZone={scheduleTimeZone} statusDisplay="live" />
      ))}
    </div>
  )
}

/**
 * Piłka: minuty, samobój po stronie przeciwnika z „(sam.)”, bramka bez minuty
 * jako suma. Kosz: same sumy, najwyżej trzy na drużynę, malejąco.
 */
export const Strzelcy: Story = {
  render: () => <ScorerRows />,
  globals: { viewport: { value: 'desktop', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expect(scorerItems(canvasElement, 'Wilki Bemowo')).toEqual(["Marek Nowak 12' 58'", "Paweł Mazur 81' (sam.)"])
    await expect(scorerItems(canvasElement, 'Sokoły Ursus')).toEqual(["Konstanty Brzęczyszczykiewicz 23' 88'", 'Tomasz Lis 1'])
    await expect(scorerItems(canvasElement, 'Żubry Wola')).toEqual(['Oskar Dąb 31', 'Kacper Lipa 28', 'Bruno Klon 19'])
    await expect(scorerItems(canvasElement, 'Rysie Mokotów')).toEqual(['Hubert Łoś 24', 'Filip Sarna 22'])
    await expect(canvasElement.textContent).not.toContain('·')
    await expectColumns(canvasElement, 6)
    await expectScoreUnmoved(canvasElement)
    await expectEntriesWhole(canvasElement)
  },
}

/**
 * Telefon: listy stoją pod nazwami w kolumnach gospodarza i gościa —
 * gospodarz do prawej, przy wyniku — a wynik zostaje na miejscu.
 */
export const StrzelcyNaTelefonie: Story = {
  render: () => <ScorerRows className="" />,
  globals: { viewport: { value: 'mobile2', isRotated: false } },
  play: async ({ canvasElement }) => {
    await expectColumns(canvasElement, 3)
    await expectScoreUnmoved(canvasElement)
    const row = canvasElement.querySelector<HTMLElement>('[data-slot="match-row"]')!
    const [homeName, awayName] = [...row.querySelectorAll('[data-slot="match-team"]')].map((name) => name.getBoundingClientRect())
    const [homeList, awayList] = [...row.querySelectorAll('[data-slot="match-scorers"]')].map((list) => list.getBoundingClientRect())
    await expect(homeList!.right).toBeCloseTo(homeName!.right, 0)
    await expect(awayList!.left).toBeCloseTo(awayName!.left, 0)
    await expect(homeList!.top).toBeGreaterThanOrEqual(homeName!.bottom)
    await expectEntriesWhole(canvasElement)
  },
}
