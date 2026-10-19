import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { cupExampleTeams, demoBracket, scheduleTimeZone } from '../lib/demo-data'
import { desktop1280, expectTextFits, phone375 } from '../test/viewport'
import { BRACKET_TILE, BracketTree } from './bracket'

const live = demoBracket({ teams: 16, progress: { round: 2, finished: 2, live: 1 } })

/**
 * Drzewo Drabinki w oknie rund (#293): kolumny z szerokości kontenera
 * (1 na telefonie, 3 poniżej 860 px, dalej 4), przełącznik rund, gest w bok
 * i kotwica przewijania.
 */
const meta = {
  title: 'Strona publiczna/Komponenty/Drabinka/Drzewo',
  component: BracketTree,
  parameters: { layout: 'padded', ...desktop1280.parameters },
  globals: desktop1280.globals,
  args: { matches: live, timeZone: scheduleTimeZone, matchHref: (match) => `/t/puchar/mecze/${match.id}` },
} satisfies Meta<typeof BracketTree>

export default meta
type Story = StoryObj<typeof meta>

function headings(canvasElement: HTMLElement) {
  return [...canvasElement.querySelectorAll('[data-slot="bracket-round-name"]')].map((heading) => heading.textContent)
}

function columns(canvasElement: HTMLElement) {
  return [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="bracket-column"]')]
}

const rect = (element: Element) => element.getBoundingClientRect()

function middle(element: Element) {
  const box = rect(element)
  return box.top + box.height / 2
}

/** Nazwy drużyn w kaflach: żadna nie jest ucięta w pionie. Bez `expect` w pętli (128 drużyn). */
async function expectNamesNotClipped(canvasElement: HTMLElement) {
  const clipped = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="bracket-tile-name"]')]
    .filter((name) => name.scrollHeight > name.clientHeight)
    .map((name) => name.textContent)
  await expect(clipped).toEqual([])
}

/** Komputer, puchar 16: cztery kolumny, wszystko w oknie, więc bez przełącznika rund. */
export const Komputer: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(window.innerWidth).toBe(1280)
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(4))
    await expect(canvas.queryByRole('group', { name: 'Rundy' })).not.toBeInTheDocument()
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    await expectNamesNotClipped(canvasElement)
  },
}

const phoneMatches = demoBracket({ teams: 128, longNames: true, progress: { round: 1, finished: 40, live: 2 } })

/** Prawdziwy gest palcem: Chromium nie zbuduje `TouchEvent` z gołych obiektów. */
function swipe(target: HTMLElement, dx: number, dy: number) {
  const touch = (clientX: number, clientY: number) => new Touch({ identifier: 1, target, clientX, clientY })
  const start = touch(200, 300)
  const end = touch(200 + dx, 300 + dy)
  target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [start], changedTouches: [start] }))
  target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [end] }))
}

/**
 * Telefon 375 px, puchar 128 z długimi nazwami: jedna runda listą, strona nie
 * przewija się w bok, pigułki mają równą szerokość. „›” i gest w bok
 * przesuwają o rundę, ruch głównie pionowy nie. Po przesunięciu najbliżej
 * środka ekranu stoi następca kafla, który był tam wcześniej, a pasek rund
 * po przewinięciu stoi przy górnej krawędzi.
 */
export const Telefon128: Story = {
  ...phone375,
  name: 'Telefon 128',
  args: { matches: phoneMatches },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    await expect(window.innerWidth).toBe(375)
    await waitFor(() => expect(headings(canvasElement)).toEqual(['1/64 finału']))
    await expect(document.documentElement.scrollWidth).toBe(window.innerWidth)
    await expectNamesNotClipped(canvasElement)
    const pills = within(canvas.getByRole('group', { name: 'Rundy' })).getAllByRole('button')
    await expect(pills).toHaveLength(7)
    await expect(new Set(pills.map((pill) => Math.round(rect(pill).width))).size).toBe(1)
    await expect(pills[0]).toHaveAccessibleName('1/64 finału, trwa mecz')

    await step('pasek rund przyklejony do górnej krawędzi', async () => {
      window.scrollTo({ top: 1500 })
      const bar = canvasElement.querySelector<HTMLElement>('[data-slot="bracket-rounds-bar"]')!
      await waitFor(() => expect(Math.abs(rect(bar).top)).toBeLessThanOrEqual(1))
    })

    await step('„›” zostawia na środku ekranu następcę kafla', async () => {
      const tiles = () => [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="bracket-tile"]')]
      const nearest = () => tiles().toSorted((a, b) => Math.abs(middle(a) - innerHeight / 2) - Math.abs(middle(b) - innerHeight / 2))[0]!
      const before = nearest()
      const match = phoneMatches.find((candidate) => candidate.id === Number(before.dataset.matchId))!

      await userEvent.click(canvas.getByRole('button', { name: 'Następna runda' }))
      await waitFor(() => expect(headings(canvasElement)).toEqual(['1/32 finału']))
      await waitFor(() => expect(Number(nearest().dataset.matchId)).toBe(match.winnerToMatchId))
      await expect(Math.abs(middle(nearest()) - innerHeight / 2)).toBeLessThan(BRACKET_TILE / 2)
    })

    await step('gest w bok przesuwa o rundę, ruch głównie pionowy nie', async () => {
      const body = canvasElement.querySelector<HTMLElement>('[data-slot="bracket-tree-body"]')!
      await expect(getComputedStyle(body).touchAction).toBe('pan-y')
      swipe(body, 30, 200)
      await expect(headings(canvasElement)).toEqual(['1/32 finału'])
      swipe(body, -80, 10)
      await waitFor(() => expect(headings(canvasElement)).toEqual(['1/16 finału']))
      swipe(body, 80, -10)
      await waitFor(() => expect(headings(canvasElement)).toEqual(['1/32 finału']))
    })
    window.scrollTo({ top: 0 })
  },
}

/**
 * Sześć drużyn, jak przykład `puchar`: wolne losy z przerywanym obrysem na
 * pozycjach 1 i 3, ćwierćfinały na 2 i 4. Półfinał 1 stoi w połowie między
 * pozycjami 1 i 2, a mecz o 3. miejsce jest w drzewie raz, pod finałem.
 */
export const SzescDruzyn: Story = {
  name: 'Sześć drużyn',
  args: { matches: demoBracket({ teams: 6, names: cupExampleTeams, progress: { round: 2, finished: 1 } }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(3))
    const [quarters, semis, finals] = columns(canvasElement) as [HTMLElement, HTMLElement, HTMLElement]

    const first = [...quarters.querySelectorAll('[data-slot="bracket-tile"], [data-slot="bracket-bye"]')].toSorted((a, b) => rect(a).top - rect(b).top)
    await expect(first.map((tile) => tile.getAttribute('aria-label'))).toEqual([
      'Wolny los: Wilki Bemowo',
      'Ćwierćfinał 2: Rysie Wola – Żubry Praga',
      'Wolny los: Sokoły Ursus',
      'Ćwierćfinał 4: Orły Bielany – Niedźwiedzie Mokotów',
    ])
    for (const bye of [first[0]!, first[2]!]) await expect(getComputedStyle(bye).borderTopStyle).toBe('dashed')

    const semi = within(semis).getByRole('link', { name: /^Półfinał 1:/ })
    await expect(middle(semi)).toBeCloseTo((middle(first[0]!) + middle(first[1]!)) / 2, 0)

    await expect(canvas.getAllByRole('link', { name: /^Mecz o 3\. miejsce:/ })).toHaveLength(1)
    const final = within(finals).getByRole('link', { name: /^Finał:/ })
    const third = within(finals).getByRole('link', { name: /^Mecz o 3\. miejsce:/ })
    await expect(rect(third).top).toBeGreaterThan(rect(final).bottom)
    await expect(rect(third).left).toBeCloseTo(rect(final).left, 0)
  },
}

/** Po finale (128 drużyn): mistrz stoi nad finałem, a okno kończy się na finale. */
export const PoFinale: Story = {
  name: 'Po finale',
  args: { matches: demoBracket({ teams: 128, progress: 'done' }) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const champion = await canvas.findByRole('status', { name: 'Mistrz' })
    await waitFor(() => expect(headings(canvasElement).at(-1)).toBe('Finał'))
    const final = canvas.getByRole('link', { name: /^Finał:/ })
    await expect(rect(champion).bottom).toBeLessThanOrEqual(rect(final).top)
    await expect(canvas.getByRole('button', { name: 'Następna runda' })).toBeDisabled()
  },
}

/** Telefon po finale: nazwa mistrza z 15–20 znaków nie jest ucięta, mistrz nad finałem. */
export const TelefonPoFinale: Story = {
  ...phone375,
  name: 'Telefon po finale',
  args: {
    matches: demoBracket({
      teams: 8,
      progress: 'done',
      names: ['Niedźwiedzie Mokotów', 'Jastrzębie Białołęka', 'Gepardy Śródmieście', 'Kondory Rembertów', 'Nosorożce Targówek', 'Bobry Białołęka', 'Mustangi Ursynów', 'Tygrysy Targówek'],
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await document.fonts.ready
    const champion = await canvas.findByRole('status', { name: 'Mistrz' })
    await expectTextFits([champion.querySelector<HTMLElement>('[data-slot="bracket-champion-name"]')!])
    await expect(rect(champion).bottom).toBeLessThanOrEqual(rect(canvas.getByRole('link', { name: /^Finał:/ })).top)
  },
}

/**
 * Okno sterowane: startuje od rundy z pierwszym niezakończonym meczem,
 * pigułka rundy z meczem trwającym ma tekst dla czytnika, a strzałka zgłasza
 * `order` nowej pierwszej rundy.
 */
export const Strzalki: Story = {
  name: 'Strzałki',
  ...phone375,
  args: { onStartChange: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(headings(canvasElement)).toEqual(['Ćwierćfinał']))
    const pills = within(canvas.getByRole('group', { name: 'Rundy' }))
    await expect(pills.getByRole('button', { name: 'Ćwierćfinał, trwa mecz' })).toHaveAttribute('aria-current', 'true')
    await expect(pills.getByRole('button', { name: 'Finał' })).not.toHaveAttribute('aria-current')
    await userEvent.click(canvas.getByRole('button', { name: 'Następna runda' }))
    await expect(args.onStartChange).toHaveBeenLastCalledWith(3)
  },
}

/** Bez `onStartChange` okno trzyma stan samo: pigułka przesuwa je na swoją rundę, a nie za finał. */
export const Pigulki: Story = {
  name: 'Pigułki',
  parameters: { layout: 'padded', viewport: { options: { w700: { name: '700', styles: { width: '700px', height: '900px' }, type: 'tablet' } } } },
  globals: { viewport: { value: 'w700', isRotated: false } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    // 700 px: trzy kolumny z czterech rund.
    await waitFor(() => expect(columns(canvasElement)).toHaveLength(3))
    await userEvent.click(within(canvas.getByRole('group', { name: 'Rundy' })).getByRole('button', { name: 'Finał' }))
    await waitFor(() => expect(headings(canvasElement)).toEqual(['Ćwierćfinał', 'Półfinał', 'Finał']))
    await expect(canvas.getByRole('button', { name: 'Następna runda' })).toBeDisabled()
  },
}
