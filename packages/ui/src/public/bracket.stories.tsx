import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { demoBracket, demoTeamLogoUrl, scheduleTimeZone, type DemoBracketMatch } from '../lib/demo-data'
import { ownBrand } from '../test/brand'
import { cssHex } from '../test/theme'
import { BracketTile, ByeTile, ChampionTile } from './bracket'
import { EachSample } from './story-samples'

/**
 * Kafle Drabinki (#293): mecz w każdym stanie, wolny los i mistrz. Drzewo
 * z nich składa `Drabinka/Drzewo`.
 */
const meta = {
  title: 'Strona publiczna/Komponenty/Drabinka/Kafle',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** Puchar czterech drużyn: półfinały 1001 i 1002, finał 2001, mecz o 3. miejsce 2002. */
function cup(overrides: Record<number, Partial<DemoBracketMatch>> = {}, sport: 'football' | 'basketball' = 'football') {
  return demoBracket({ teams: 4, sport }).map((match) => ({ ...match, ...overrides[match.id] }))
}

function Tile({ id, matches }: { id: number; matches: DemoBracketMatch[] }) {
  const match = matches.find((candidate) => candidate.id === id)!
  return (
    <div className="w-72">
      <BracketTile match={match} matches={matches} href={`/t/puchar/mecze/${id}`} timeZone={scheduleTimeZone} />
    </div>
  )
}

const teamLines = (canvasElement: HTMLElement) => [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="bracket-tile-team"]')]

/** Zaplanowany: termin nad parą, puste okienka wyniku; Wilki z wgranym herbem. */
export const Zaplanowany: Story = {
  render: () => {
    const matches = cup()
    const semi = matches.find((match) => match.id === 1001)!
    semi.homeTeam = { ...semi.homeTeam!, logoUrl: demoTeamLogoUrl }
    return <Tile id={1001} matches={matches} />
  },
  play: async ({ canvasElement }) => {
    const tile = within(canvasElement).getByRole('link', { name: /^Półfinał 1: Wilki Bemowo – / })
    await expect(tile).toHaveTextContent('05.09')
    await expect(teamLines(canvasElement)[0]!.querySelector('img')).toHaveAttribute('src', demoTeamLogoUrl)
  },
}

/** Trwający 2:1: „Na żywo” zamiast terminu i nikt nie jest przygaszony, bo awans dopiero przy `finished`. */
export const Trwajacy: Story = {
  name: 'Trwający',
  render: () => <Tile id={1001} matches={cup({ 1001: { status: 'live', homeScore: 2, awayScore: 1 } })} />,
  play: async ({ canvasElement }) => {
    const tile = within(within(canvasElement).getByRole('link'))
    await expect(tile.getByText('Na żywo')).toBeInTheDocument()
    await expect(tile.queryByText('05.09', { exact: false })).not.toBeInTheDocument()
    for (const line of teamLines(canvasElement)) await expect(line).not.toHaveAttribute('data-dim')
  },
}

/** Zakończony 2:0: przegrany przygaszony. */
export const Zakonczony: Story = {
  name: 'Zakończony',
  render: () => <Tile id={1001} matches={cup({ 1001: { status: 'finished', homeScore: 2, awayScore: 0 } })} />,
  play: async ({ canvasElement }) => {
    const [home, away] = teamLines(canvasElement)
    await expect(home).not.toHaveAttribute('data-dim')
    await expect(away).toHaveAttribute('data-dim')
  },
}

/** Remis 1:1 po karnych 3:4: karne w nawiasie przy nazwie, przygaszony gospodarz, nie gość. */
export const PoKarnych: Story = {
  name: 'Po karnych',
  render: () => (
    <Tile id={1001} matches={cup({ 1001: { status: 'finished', homeScore: 1, awayScore: 1, homePenalties: 3, awayPenalties: 4 } })} />
  ),
  play: async ({ canvasElement }) => {
    const [home, away] = teamLines(canvasElement) as [HTMLElement, HTMLElement]
    await expect(home).toHaveAttribute('data-dim')
    await expect(within(home).getByText('(3)')).toBeInTheDocument()
    await expect(away).not.toHaveAttribute('data-dim')
    await expect(within(away).getByText('(4)')).toBeInTheDocument()
  },
}

/** Pusty slot: kursywą, skąd przyjdzie drużyna, i to samo w nazwie odnośnika. */
export const PustySlot: Story = {
  name: 'Pusty slot',
  render: () => <Tile id={2001} matches={cup()} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Finał: Zwycięzca: Półfinał 1 – Zwycięzca: Półfinał 2' })).toBeInTheDocument()
    await expect(canvas.getByText('Zwycięzca: Półfinał 1')).toHaveClass('italic')
  },
}

/** Koszykówka: trzycyfrowy wynik w tym samym okienku. */
export const Kosz: Story = {
  render: () => <Tile id={1001} matches={cup({ 1001: { status: 'finished', homeScore: 102, awayScore: 98 } }, 'basketball')} />,
}

/**
 * Okienko wyniku ma tę samą szerokość w kaflu z karnymi i bez, a wynik kosza
 * `102` mieści się w nim bez ucięcia.
 */
export const OkienkoWyniku: Story = {
  name: 'Okienko wyniku',
  render: () => {
    const football = cup({
      1001: { status: 'finished', homeScore: 1, awayScore: 1, homePenalties: 5, awayPenalties: 4 },
      1002: { status: 'finished', homeScore: 3, awayScore: 0 },
    })
    const basketball = cup({ 1001: { status: 'finished', homeScore: 102, awayScore: 98 } }, 'basketball')
    return (
      <div className="flex flex-col gap-4">
        <Tile id={1001} matches={football} />
        <Tile id={1002} matches={football} />
        <Tile id={1001} matches={basketball} />
      </div>
    )
  },
  play: async ({ canvasElement }) => {
    await document.fonts.ready
    const fields = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="bracket-tile-score"]')]
    await expect(fields).toHaveLength(6)
    await expect(new Set(fields.map((field) => field.getBoundingClientRect().width)).size).toBe(1)
    const hundred = fields.find((field) => field.textContent === '102')!
    await expect(hundred.scrollWidth).toBeLessThanOrEqual(hundred.clientWidth)
  },
}

/** Wolny los: przerywany obrys w miejscu brakującego meczu 1. rundy. */
export const WolnyLos: Story = {
  name: 'Wolny los',
  render: () => (
    <div className="w-72">
      <ByeTile team={{ id: 1, name: 'Wilki Bemowo', logoUrl: null }} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const bye = within(canvasElement).getByRole('group', { name: 'Wolny los: Wilki Bemowo' })
    await expect(getComputedStyle(bye).borderTopStyle).toBe('dashed')
  },
}

/** Kolor CSS-owej zmiennej z korzenia `.public-site` jako `#rrggbb`. */
function brandVar(element: Element, name: string) {
  const probe = document.createElement('span')
  probe.style.color = `var(${name})`
  element.closest('.public-site')!.append(probe)
  const color = cssHex(getComputedStyle(probe).color)
  probe.remove()
  return color
}

/**
 * Mistrz na każdej próbce koloru turnieju: wypełnienie `--brand`, obrys 1 px
 * w `--brand-line`, herb zastępczy w `--brand-foreground`. Przy granacie
 * i bordo obrys odcina kartę od grafitowego tła.
 */
export const Mistrz: Story = {
  parameters: ownBrand,
  render: () => (
    <EachSample>{() => <ChampionTile team={{ id: 1, name: 'Niedźwiedzie Mokotów', logoUrl: null }} className="w-80" />}</EachSample>
  ),
  play: async ({ canvasElement }) => {
    for (const hex of ['#1E3A8A', '#7A1F2B']) {
      const sample = canvasElement.querySelector<HTMLElement>(`[data-sample="${hex}"]`)!
      const champion = within(sample).getByRole('status', { name: 'Mistrz' })
      await expect(getComputedStyle(champion).borderTopWidth).toBe('1px')
      await expect(cssHex(getComputedStyle(champion).borderTopColor)).toBe(brandVar(champion, '--brand-line'))
      const shield = champion.querySelector<SVGElement>('[data-slot="crest-shield"]')!
      await expect(cssHex(getComputedStyle(shield).stroke)).toBe(brandVar(champion, '--brand-foreground'))
    }
  },
}
