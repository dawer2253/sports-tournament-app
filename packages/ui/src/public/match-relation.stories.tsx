import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import type { MatchRelationEvent, MatchRelationPeriod } from '../components/data/match-page-data'
import { demoTeamLogoUrl, matchPageBasketball, matchPageFinished, matchPageLive } from '../lib/demo-data'
import { Button } from './button'
import { MatchRelation, RELATION_COLLAPSE_THRESHOLD } from './match-relation'

const meta = {
  title: 'Strona publiczna/Komponenty/Mecz/Relacja',
  component: MatchRelation,
  parameters: { layout: 'padded' },
  args: {
    status: matchPageFinished.status,
    homeTeam: matchPageFinished.homeTeam,
    awayTeam: matchPageFinished.awayTeam,
    events: matchPageFinished.events,
    periods: matchPageFinished.periods,
    className: 'mx-auto max-w-3xl',
  },
} satisfies Meta<typeof MatchRelation>

export default meta
type Story = StoryObj<typeof meta>

/** Nagłówki części jako przyciski, w kolejności ekranu. */
function headers(canvasElement: HTMLElement) {
  return within(canvasElement)
    .queryAllByRole('button')
    .filter((button) => button.hasAttribute('aria-expanded'))
}

/** Po meczu: części chronologicznie, wszystkie otwarte, kartka bez minuty na końcu. */
export const PoMeczu: Story = {
  name: 'Po meczu',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Przebieg meczu' })).toBeInTheDocument()
    const all = headers(canvasElement)
    await expect(all.map((header) => header.textContent)).toEqual([
      expect.stringMatching(/^1\. połowa/),
      expect.stringMatching(/^2\. połowa/),
      expect.stringMatching(/^Bez minuty/),
    ])
    for (const header of all) await expect(header).toHaveAttribute('aria-expanded', 'true')
    await expect(all[2]).toHaveTextContent('1 zdarzenie')
    await expect(all[0]).toHaveAttribute('aria-controls', expect.stringMatching(/.+/))
  },
}

/**
 * Herb wgrany przez klub: wiersz zdarzenia gospodarza pokazuje jego plik,
 * a gościa bez pliku herb zastępczy. Drużynę wiersza wybiera `event.team.id`.
 */
export const HerbZPliku: Story = {
  name: 'Herb z pliku',
  args: { homeTeam: { ...matchPageFinished.homeTeam!, logoUrl: demoTeamLogoUrl } },
  play: async ({ canvasElement }) => {
    const rows = [...canvasElement.querySelectorAll<HTMLElement>('li[data-side]')]
    const home = rows.filter((row) => row.dataset.side === 'home')
    const away = rows.filter((row) => row.dataset.side === 'away')
    await expect(home.length).toBeGreaterThan(0)
    await expect(away.length).toBeGreaterThan(0)
    for (const row of home) await expect(row.querySelector('[data-slot="crest"] img')).toHaveAttribute('src', demoTeamLogoUrl)
    for (const row of away) await expect(row.querySelector('[data-slot="crest-fallback"]')).not.toBeNull()
  },
}

/** Na żywo: najnowsza część na górze, a w niej najnowsze zdarzenie, z minutą „′”. */
export const NaZywo: Story = {
  name: 'Na żywo',
  args: {
    status: matchPageLive.status,
    homeTeam: matchPageLive.homeTeam,
    awayTeam: matchPageLive.awayTeam,
    events: matchPageLive.events,
    periods: matchPageLive.periods,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Relacja na żywo' })).toBeInTheDocument()
    const first = canvas.getAllByRole('listitem')[0]!
    await expect(first).toHaveTextContent(new RegExp(`^${matchPageLive.events.at(-1)!.minute}′`))
  },
}

/** Zdarzenia piłki w dwóch połowach, `count` sztuk, pół na pół. */
function footballEvents(count: number): { events: MatchRelationEvent[]; periods: MatchRelationPeriod[] } {
  const base = matchPageFinished.events[0]!
  const events = Array.from({ length: count }, (_, index): MatchRelationEvent => {
    const minute = 1 + Math.floor((index * 88) / count)
    return { ...base, id: 1000 + index, minute, period: minute <= 45 ? 1 : 2, type: 'yellow_card', typeLabel: 'Żółta kartka', scoreAfter: null }
  })
  return {
    events,
    periods: [
      { number: 1, label: '1. połowa', homeScore: 0, awayScore: 0 },
      { number: 2, label: '2. połowa', homeScore: 0, awayScore: 0 },
    ],
  }
}

/** Granica zwijania: przy 20 zdarzeniach wszystkie części są otwarte. */
export const DwadziesciaZdarzen: Story = {
  name: '20 zdarzeń',
  args: footballEvents(RELATION_COLLAPSE_THRESHOLD),
  play: async ({ canvasElement }) => {
    await expect(headers(canvasElement).map((header) => header.getAttribute('aria-expanded'))).toEqual(['true', 'true'])
  },
}

/** Granica zwijania: przy 21 zdarzeniach części startują zwinięte. */
export const DwadziesciaJedenZdarzen: Story = {
  name: '21 zdarzeń',
  args: footballEvents(RELATION_COLLAPSE_THRESHOLD + 1),
  play: async ({ canvasElement }) => {
    await expect(headers(canvasElement).map((header) => header.getAttribute('aria-expanded'))).toEqual(['false', 'false'])
    await expect(within(canvasElement).queryAllByRole('listitem')).toHaveLength(0)
  },
}

/** Kosz: ponad 20 zdarzeń, więc kwarty startują zwinięte, a klik rozwija jedną. */
export const Kosz: Story = {
  args: {
    homeTeam: matchPageBasketball.homeTeam,
    awayTeam: matchPageBasketball.awayTeam,
    events: matchPageBasketball.events,
    periods: matchPageBasketball.periods,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(matchPageBasketball.events.length).toBeGreaterThan(RELATION_COLLAPSE_THRESHOLD)
    const all = canvas.getAllByRole('button', { name: /kwarta/ })
    await expect(all).toHaveLength(4)
    for (const header of all) await expect(header).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(all[1]!)
    await expect(all[1]).toHaveAttribute('aria-expanded', 'true')
    const inSecond = matchPageBasketball.events.filter((event) => event.period === 2).length
    await expect(canvas.getAllByRole('listitem')).toHaveLength(inSecond)
  },
}

/** Kosz na żywo ponad progiem: otwarta jest tylko najnowsza kwarta, na górze. */
export const KoszNaZywo: Story = {
  name: 'Kosz na żywo',
  args: { ...Kosz.args, status: 'live' },
  play: async ({ canvasElement }) => {
    const all = within(canvasElement).getAllByRole('button', { name: /kwarta/ })
    await expect(all[0]).toHaveTextContent(/^4\. kwarta/)
    await expect(all.map((header) => header.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false', 'false'])
  },
}

/**
 * Wybór kibica przy odświeżeniu danych: kwarty kosza na żywo przychodzą
 * kolejno, jak przy odpytywaniu. Zwinięta ręcznie część zostaje zwinięta
 * po nowym zdarzeniu, a nowa część otwiera się sama.
 */
function LiveRefresh() {
  const all = matchPageBasketball.events
  const upTo = (period: number) => ({
    events: all.filter((event) => event.period !== null && event.period <= period),
    periods: matchPageBasketball.periods.filter((item) => item.number <= period),
  })
  const steps = [
    upTo(3),
    // Nowe zdarzenie w 3. kwarcie (kopia ostatniego z nowym id).
    { ...upTo(3), events: [...upTo(3).events, { ...upTo(3).events.at(-1)!, id: 9001 }] },
    upTo(4),
  ]
  const [step, setStep] = useState(0)
  const data = steps[Math.min(step, steps.length - 1)]!
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Button onClick={() => setStep((current) => current + 1)}>Odśwież dane</Button>
      <MatchRelation status="live" homeTeam={matchPageBasketball.homeTeam} awayTeam={matchPageBasketball.awayTeam} events={data.events} periods={data.periods} />
    </div>
  )
}

export const WyborKibica: Story = {
  name: 'Wybór kibica przy odświeżeniu',
  render: () => <LiveRefresh />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const third = () => canvas.getByRole('button', { name: /^3\. kwarta/ })
    await expect(third()).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(third())
    await expect(third()).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(canvas.getByRole('button', { name: 'Odśwież dane' }))
    await expect(third()).toHaveTextContent(/zdarze/)
    await expect(third()).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(canvas.getByRole('button', { name: 'Odśwież dane' }))
    const fourth = canvas.getByRole('button', { name: /^4\. kwarta/ })
    await expect(fourth).toHaveAttribute('aria-expanded', 'true')
    await expect(third()).toHaveAttribute('aria-expanded', 'false')
  },
}

/** Turniej bez podziału: płaska lista 20 zdarzeń i „Pokaż całą relację (n)”. */
export const BezPodzialu: Story = {
  name: 'Bez podziału',
  args: {
    homeTeam: matchPageBasketball.homeTeam,
    awayTeam: matchPageBasketball.awayTeam,
    events: matchPageBasketball.events.map((event) => ({ ...event, period: null })),
    periods: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { expanded: true })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { expanded: false })).not.toBeInTheDocument()
    await expect(canvas.queryByText('Bez minuty')).not.toBeInTheDocument()
    await expect(canvas.getAllByRole('listitem')).toHaveLength(RELATION_COLLAPSE_THRESHOLD)
    await userEvent.click(canvas.getByRole('button', { name: `Pokaż całą relację (${matchPageBasketball.events.length})` }))
    await expect(canvas.getAllByRole('listitem')).toHaveLength(matchPageBasketball.events.length)
  },
}

/** Zdarzenia niezgodne z wynikiem meczu: bez wyniku przy zdarzeniach i bez wyników części. */
export const NiezgodnaZWynikiem: Story = {
  name: 'Niezgodna z wynikiem',
  args: {
    events: matchPageFinished.events.map((event) => ({ ...event, scoreAfter: null })),
    periods: matchPageFinished.periods.map((period) => ({ ...period, homeScore: null, awayScore: null })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const item of canvas.getAllByRole('listitem')) await expect(item).not.toHaveTextContent(/\d:\d/)
    for (const header of headers(canvasElement)) await expect(header).not.toHaveTextContent(/\d:\d/)
  },
}

/** Mecz bez zdarzeń: komunikat w miejscu relacji. */
export const BezZdarzen: Story = {
  name: 'Bez zdarzeń',
  args: { events: [], periods: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Do tego meczu nie wpisano zdarzeń.')).toBeInTheDocument()
  },
}

/** Mecz zaplanowany: komunikat zamiast relacji. */
export const Zaplanowany: Story = {
  args: { status: 'scheduled', events: [], periods: [] },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('heading', { name: 'Mecz jeszcze się nie zaczął' })).toBeInTheDocument()
  },
}
