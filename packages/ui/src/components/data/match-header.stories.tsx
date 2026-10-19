import type { Meta, StoryObj } from '@storybook/react-vite'
import type * as React from 'react'
import { expect, within } from 'storybook/test'
import { brandForeground, MIN_LARGE_TEXT_CONTRAST, MIN_TEXT_CONTRAST } from '../../lib/contrast'
import { matchPageBasketball, matchPageFinished, matchPageLive, matchPageScheduled, scheduleTimeZone } from '../../lib/demo-data'
import { matchBandContrast, type MatchBandRegion } from '../../lib/match-band'
import { cssHex } from '../../test/theme'
import { MatchHeader } from './match-header'
import type { MatchPageData } from './match-page-data'

/** Kolory turnieju ze stories #206: jasny (ciemny tekst) i ciemny (biały tekst). */
const COLORS = ['#FFD400', '#1F7A45'] as const

/** Zmienne koloru turnieju, które na stronie stawia shell (`brandVars()`). */
function Brand({ color, children }: { color: string; children: React.ReactNode }) {
  const style = { '--brand': color, '--brand-foreground': brandForeground(color) } as React.CSSProperties
  return (
    <div data-brand={color} style={style}>
      {children}
    </div>
  )
}

const meta = {
  title: 'Strona publiczna/Do przepisania/Pas meczu',
  component: MatchHeader,
  parameters: { layout: 'padded' },
  args: { match: matchPageFinished, brandColor: '#1F7A45', timeZone: scheduleTimeZone },
  decorators: [
    (Story, { args }) => (
      <Brand color={args.brandColor}>
        <div className="max-w-5xl">
          <Story />
        </div>
      </Brand>
    ),
  ],
} satisfies Meta<typeof MatchHeader>

export default meta
type Story = StoryObj<typeof meta>

/** Piłka po meczu: strzelcy z minutami, samobój po stronie przeciwnika. */
export const PilkaPoMeczu: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const away = canvas.getByRole('list', { name: `Strzelcy: ${matchPageFinished.awayTeam!.name}` })
    const home = canvas.getByRole('list', { name: `Strzelcy: ${matchPageFinished.homeTeam!.name}` })
    // Samobój gościa podnosi wynik gospodarza, więc stoi u gospodarza.
    await expect(within(home).getByText(/\(sam\.\)/)).toBeInTheDocument()
    await expect(within(away).queryByText(/\(sam\.\)/)).not.toBeInTheDocument()
  },
}

export const KolorJasny: Story = { args: { brandColor: '#FFD400' } }

/**
 * Mecz o 3. miejsce rozstrzygnięty karnymi (#234): w pasie etykieta pozycji
 * zamiast nazwy rundy „Finał”, a karne pod wynikiem, po stronie każdej
 * drużyny, pogrubione u zwycięzcy.
 */
export const MeczOTrzecieMiejscePoKarnych: Story = {
  args: {
    match: {
      ...matchPageFinished,
      round: { name: 'Finał' },
      homeScore: 1,
      awayScore: 1,
      homePenalties: 3,
      awayPenalties: 4,
      bracket: { label: 'Mecz o 3. miejsce', penaltySlot: true },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Mecz o 3. miejsce')).toBeInTheDocument()
    await expect(canvas.queryByText('Finał')).not.toBeInTheDocument()
    await expect(canvas.getByLabelText('Wynik 1 : 1, karne 3 : 4')).toBeInTheDocument()
    const penalties = canvasElement.querySelector('[data-slot="match-band-penalties"]')!
    await expect(within(penalties as HTMLElement).getByText('(3)')).toHaveClass('font-normal')
    await expect(within(penalties as HTMLElement).getByText('(4)')).toHaveClass('font-bold')
  },
}

export const NaZywo: Story = {
  args: { match: matchPageLive },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Na żywo')).toBeInTheDocument()
  },
}

export const Zaplanowany: Story = {
  args: { match: matchPageScheduled },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('– : –')).toBeInTheDocument()
    await expect(canvas.getByText('Zaplanowany')).toBeInTheDocument()
    await expect(canvas.queryByRole('list', { name: /^Strzelcy/ })).not.toBeInTheDocument()
  },
}

/** Kosz: wszyscy zawodnicy z punktami, nie trzech jak w wierszu meczu (#192). */
export const Kosz: Story = {
  args: { match: matchPageBasketball },
  play: async ({ canvasElement }) => {
    const lists = within(canvasElement).getAllByRole('listitem')
    await expect(lists).toHaveLength(matchPageBasketball.scorers!.length)
    await expect(matchPageBasketball.scorers!.length).toBeGreaterThan(6)
  },
}

const longNames: MatchPageData = {
  ...matchPageFinished,
  homeTeam: { id: matchPageFinished.homeTeam!.id, name: 'Międzyszkolny Klub Sportowy Huragan Bemowo', logoUrl: null },
}

/** Długa nazwa gospodarza nie przesuwa wyniku: stoi na środku pasa (#162). */
export const DlugieNazwy: Story = {
  args: { match: longNames },
  play: async ({ canvasElement }) => {
    const band = canvasElement.querySelector<HTMLElement>('[data-slot="match-band"]')!.getBoundingClientRect()
    const score = canvasElement.querySelector<HTMLElement>('[data-slot="match-band-score"]')!.getBoundingClientRect()
    await expect(score.left + score.width / 2).toBeCloseTo(band.left + band.width / 2, 0)
  },
}

/** Pasy do kontroli kontrastu: mecz trwający, kosz i zakończony, w obu kolorach turnieju. */
const CONTRAST_CASES = COLORS.flatMap((color) =>
  [
    { key: 'live', match: matchPageLive },
    { key: 'basketball', match: matchPageBasketball },
    { key: 'finished', match: matchPageFinished },
  ].map((band) => ({ ...band, color })),
)

/**
 * Każdy tekst w pasie ma kontrast ≥ 4.5:1, a wynik ≥ 3:1 (#210). Od #290 pas
 * ma płaski kolor turnieju dla każdego sportu, bez zdjęcia. Kolor tekstu idzie
 * z przeglądarki (strona publiczna jest zawsze ciemna), warstwy ze stałych
 * `lib/match-band.ts`.
 */
export const Kontrast: Story = {
  render: () => (
    <div className="grid gap-4">
      {CONTRAST_CASES.map(({ key, match, color }) => (
        <Brand key={`${key}-${color}`} color={color}>
          <MatchHeader match={match} brandColor={color} timeZone={scheduleTimeZone} />
        </Brand>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const bands = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="match-band"]')]
    await expect(bands).toHaveLength(CONTRAST_CASES.length)
    for (const band of bands) {
      const brandColor = band.closest<HTMLElement>('[data-brand]')!.dataset.brand!
      const texts = [...band.querySelectorAll<HTMLElement>('[data-band-text]')]
      await expect(texts.length).toBeGreaterThanOrEqual(7)
      for (const text of texts) {
        const ratio = matchBandContrast({
          brandColor,
          text: cssHex(getComputedStyle(text).color),
          region: text.dataset.bandText as MatchBandRegion,
        })
        const minimum = text.hasAttribute('data-band-large') ? MIN_LARGE_TEXT_CONTRAST : MIN_TEXT_CONTRAST
        await expect({ text: text.textContent, brandColor, ok: ratio >= minimum }).toEqual(expect.objectContaining({ ok: true }))
      }
    }
  },
}
