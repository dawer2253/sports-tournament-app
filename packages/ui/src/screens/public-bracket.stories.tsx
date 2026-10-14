import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { BracketTree } from '../components/data/bracket-tree'
import {
  cupExampleTeams,
  demoBracket,
  publicBasketballCupTournament,
  scheduleTimeZone,
  type DemoBracketMatch,
} from '../lib/demo-data'
import { PublicBracket } from './public-bracket'

const meta = {
  title: 'Ekrany/Public · Drabinka',
  component: PublicBracket,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof PublicBracket>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Telefon o szerokości 375 px, z DoD #234. Storybook nie ma takiego widoku
 * wśród domyślnych (`mobile1` to 320, `mobile2` 414).
 */
const phone375 = {
  parameters: {
    viewport: {
      options: {
        phone375: { name: 'Telefon 375', styles: { width: '375px', height: '812px' }, type: 'mobile' },
      },
    },
  },
  globals: { viewport: { value: 'phone375', isRotated: false } },
} as const

/** Komputer: `desktop` to 1280 px. */
const desktop = { globals: { viewport: { value: 'desktop', isRotated: false } } } as const

function columns(canvasElement: HTMLElement) {
  return [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="bracket-column"]')]
}

function rect(element: Element) {
  return element.getBoundingClientRect()
}

function middle(element: Element) {
  const box = rect(element)
  return box.top + box.height / 2
}

/**
 * Żadna nazwa w drzewie nie jest ucięta w pionie. Bez `expect` w pętli: przy
 * 128 drużynach każde `expect` trafiałoby do panelu Interactions.
 */
async function expectNamesNotClipped(canvasElement: HTMLElement) {
  const clipped = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="bracket-tile-team"]')]
    .filter((name) => name.scrollHeight > name.clientHeight)
    .map((name) => name.textContent)
  await expect(clipped).toEqual([])
}

/** Puchar 16 drużyn w trakcie ćwierćfinałów. */
export const Domyslny: Story = {}

/**
 * Komputer: cztery kolumny, więc 16 drużyn mieści się w całości — każda
 * pigułka jest w oknie, a strzałki nie mają dokąd przesunąć.
 */
export const Komputer16: Story = {
  ...desktop,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(window.innerWidth).toBe(1280)
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(4))
    const pills = within(canvas.getByRole('group', { name: 'Rundy' })).getAllByRole('button')
    await expect(pills).toHaveLength(4)
    for (const pill of pills) await expect(pill).toHaveAttribute('aria-current', 'true')
    await expect(canvas.getByRole('button', { name: 'Wcześniejsza runda' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Następna runda' })).toBeDisabled()
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    await expectNamesNotClipped(canvasElement)
  },
}

const phoneMatches = demoBracket({ teams: 128, longNames: true, progress: { round: 1, finished: 40, live: 2 } })

/**
 * 128 drużyn z długimi nazwami na telefonie: dwie kolumny, a strona nie
 * przewija się w bok. Po przewinięciu w dół pasek rund zostaje przy górnej
 * krawędzi, a po „›” na środku ekranu stoi następca kafla, który był tam
 * wcześniej (kotwica przewijania).
 */
export const Telefon128: Story = {
  ...phone375,
  args: { matches: phoneMatches },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(window.innerWidth).toBe(375)
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(2))
    await expect(document.documentElement.scrollWidth).toBe(window.innerWidth)
    await expectNamesNotClipped(canvasElement)

    // Pasek rund przyklejony do górnej krawędzi po przewinięciu w dół.
    window.scrollTo({ top: 1500 })
    const bar = canvasElement.querySelector<HTMLElement>('[data-slot="bracket-rounds-bar"]')!
    await waitFor(() => expect(Math.abs(rect(bar).top)).toBeLessThanOrEqual(1))

    // Kafel pierwszej kolumny najbliższy środka ekranu, ustawiony dokładnie na środku.
    const tiles = () => [...columns(canvasElement)[0]!.querySelectorAll<HTMLElement>('[data-slot="bracket-tile"]')]
    const nearest = () => tiles().toSorted((a, b) => Math.abs(middle(a) - innerHeight / 2) - Math.abs(middle(b) - innerHeight / 2))[0]!
    const before = nearest()
    window.scrollBy({ top: middle(before) - innerHeight / 2 })
    const match = phoneMatches.find((candidate) => candidate.id === Number(before.dataset.matchId))!

    await userEvent.click(canvas.getByRole('button', { name: 'Następna runda' }))
    await waitFor(() => expect(canvas.getByText('1/32 finału', { selector: '[data-slot="bracket-column-heading"] p' })).toBeInTheDocument())
    await waitFor(() => expect(Number(nearest().dataset.matchId)).toBe(match.winnerToMatchId))
    await expect(Math.abs(middle(nearest()) - innerHeight / 2)).toBeLessThan(31)
    window.scrollTo({ top: 0 })
  },
}

const sixTeams = demoBracket({ teams: 6, names: cupExampleTeams, progress: { round: 2, finished: 1 } })

/**
 * Sześć drużyn, jak przykład `puchar`: ćwierćfinały 2 i 4 stoją na pozycjach
 * 2 i 4, a przerywane wolne losy na 1 i 3. Półfinał 1 stoi w połowie między
 * pozycjami 1 i 2, a mecz o 3. miejsce jest w drzewie raz, pod finałem.
 */
export const SzescDruzyn: Story = {
  ...desktop,
  args: { matches: sixTeams },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(3))
    const [quarters, semis, finals] = columns(canvasElement) as [HTMLElement, HTMLElement, HTMLElement]

    const firstColumn = [...quarters.children].filter((child) => child.matches('[data-slot="bracket-tile"], [data-slot="bracket-bye"]'))
    const ordered = firstColumn.toSorted((a, b) => rect(a).top - rect(b).top)
    await expect(ordered.map((tile) => tile.getAttribute('aria-label'))).toEqual([
      'Wolny los: Wilki Bemowo',
      'Ćwierćfinał 2: Rysie Wola – Żubry Praga',
      'Wolny los: Sokoły Ursus',
      'Ćwierćfinał 4: Orły Bielany – Niedźwiedzie Mokotów',
    ])
    for (const bye of ordered.filter((tile) => tile.matches('[data-slot="bracket-bye"]'))) {
      await expect(getComputedStyle(bye).borderTopStyle).toBe('dashed')
    }

    const semi = within(semis).getByRole('link', { name: /^Półfinał 1:/ })
    await expect(middle(semi)).toBeCloseTo((middle(ordered[0]!) + middle(ordered[1]!)) / 2, 0)

    await expect(canvas.getAllByRole('link', { name: /^Mecz o 3\. miejsce:/ })).toHaveLength(1)
    const finalColumn = within(finals)
    const final = finalColumn.getByRole('link', { name: /^Finał:/ })
    const third = finalColumn.getByRole('link', { name: /^Mecz o 3\. miejsce:/ })
    // Kolumna finału ma jeden kafel na swoim miejscu; drugi to mecz o 3. miejsce pod nim.
    const finalColumnTiles = [...finals.querySelectorAll('[data-slot="bracket-tile"]')]
    await expect(finalColumnTiles.filter((tile) => tile !== third)).toEqual([final])
    await expect(rect(third).top).toBeGreaterThan(rect(final).bottom)
    await expect(rect(third).left).toBeCloseTo(rect(final).left, 0)
    await expect(finalColumn.getByText('Mecz o 3. miejsce')).toBeInTheDocument()
  },
}

/** Po finale: mistrz pod finałem, okno kończy się na finale. */
export const PoFinale: Story = {
  ...desktop,
  args: { matches: demoBracket({ teams: 16, progress: 'done' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(await canvas.findByRole('status')).toHaveTextContent('Zwycięzca pucharu')
    await expect(canvas.getByRole('button', { name: 'Następna runda' })).toBeDisabled()
  },
}

/**
 * Telefon po finale z nazwami po 15–20 znaków, jak w prawdziwych turniejach
 * osiedlowych: nazwa mistrza mieści się w karcie bez wielokropka i bez uciętych
 * liter, a cała karta trzyma wysokość kafla. W #235 karta ucinała już „Bobry
 * Białołęka”.
 */
export const TelefonPoFinale: Story = {
  ...phone375,
  args: {
    matches: demoBracket({
      teams: 8,
      progress: 'done',
      names: [
        'Jastrzębie Białołęka',
        'Niedźwiedzie Mokotów',
        'Gepardy Śródmieście',
        'Kondory Rembertów',
        'Nosorożce Targówek',
        'Bobry Białołęka',
        'Mustangi Ursynów',
        'Tygrysy Targówek',
      ],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(window.innerWidth).toBe(375)
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(2))
    const champion = await canvas.findByRole('status')
    // Nazwa to jedyny liść karty poza podpisem.
    const name = [...champion.querySelectorAll<HTMLElement>('span')].find(
      (span) => span.children.length === 0 && span.textContent !== 'Zwycięzca pucharu',
    )!
    await expect(name.scrollHeight).toBeLessThanOrEqual(name.clientHeight)
    await expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth)
    await expect(champion.scrollHeight).toBeLessThanOrEqual(champion.clientHeight)
    await expect(champion).toHaveTextContent('Zwycięzca pucharu')
  },
}

/** 128 drużyn po finale na komputerze: okno czterech ostatnich rund. */
export const Druzyn128PoFinale: Story = {
  ...desktop,
  args: { matches: demoBracket({ teams: 128, progress: 'done' }) },
}

/** Koszykówka: bez remisów, więc pole wyniku nie trzyma miejsca na karne. */
export const Koszykowka: Story = {
  args: {
    tournament: publicBasketballCupTournament,
    penaltySlot: false,
    matches: demoBracket({ teams: 16, sport: 'basketball', progress: { round: 2, finished: 3, live: 1 } }),
  },
}

/** Ciemny motyw: kolor turnieju na pigułkach i mistrzu, łączniki na ciemnym tle. */
export const CiemnyMotyw: Story = {
  args: { matches: demoBracket({ teams: 16, progress: 'done' }) },
  globals: { theme: 'dark' },
}

/** Ósemka po finale z jednym meczem rozstrzygniętym karnymi w każdej rundzie. */
function withPenalties(matches: DemoBracketMatch[]): DemoBracketMatch[] {
  return matches.map((match) =>
    match.matchNumber === 1 && match.status === 'finished' && match.homeScore !== match.awayScore
      ? { ...match, awayScore: match.homeScore, homePenalties: 5, awayPenalties: 4 }
      : match,
  )
}

/**
 * Szare pole ma tę samą szerokość w kaflu z karnymi i bez (piłka), a w koszu
 * jest węższe, bo kosz nie zna remisu.
 */
export const PoleWyniku: Story = {
  ...desktop,
  render: () => (
    <div className="space-y-8 p-6">
      <div data-testid="pilka">
        <BracketTree matches={withPenalties(demoBracket({ teams: 8, progress: 'done' }))} penaltySlot timeZone={scheduleTimeZone} />
      </div>
      <div data-testid="kosz">
        <BracketTree matches={demoBracket({ teams: 8, sport: 'basketball', progress: 'done' })} penaltySlot={false} timeZone={scheduleTimeZone} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const widths = (testId: string) =>
      [...canvas.getByTestId(testId).querySelectorAll('[data-slot="bracket-tile-score"]')].map((field) => rect(field).width)
    await waitFor(() => expect(widths('pilka').length).toBeGreaterThan(0))

    const football = widths('pilka')
    await expect(canvas.getByTestId('pilka').querySelectorAll('[data-slot="penalties"]:not(:empty)').length).toBeGreaterThan(0)
    await expect(new Set(football).size).toBe(1)
    for (const width of widths('kosz')) await expect(width).toBeLessThan(football[0]!)
  },
}
