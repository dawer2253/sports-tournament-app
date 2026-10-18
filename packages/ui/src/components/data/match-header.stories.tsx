import type { Meta, StoryObj } from '@storybook/react-vite'
import type * as React from 'react'
import { expect, within } from 'storybook/test'
import { brandForeground, MIN_LARGE_TEXT_CONTRAST, MIN_TEXT_CONTRAST } from '../../lib/contrast'
import { matchPageBasketball, matchPageFinished, matchPageLive, matchPageScheduled, scheduleTimeZone } from '../../lib/demo-data'
import { MATCH_BAND_OVERLAY, matchBandContrast, type MatchBandBackdrop, type MatchBandRegion } from '../../lib/match-band'
import { cssAlpha, cssHex } from '../../test/theme'
import { MatchHeader } from './match-header'
import type { MatchPageData } from './match-page-data'

/** Kolory turnieju ze stories #206: jasny (ciemny tekst) i ciemny (biały tekst). */
const COLORS = ['#FFD400', '#1F7A45'] as const

/** Zmienne koloru turnieju, które na stronie stawia `PublicShell`. */
function Brand({ color, children }: { color: string; children: React.ReactNode }) {
  const style = { '--brand': color, '--brand-foreground': brandForeground(color) } as React.CSSProperties
  return (
    <div data-brand={color} style={style}>
      {children}
    </div>
  )
}

const meta = {
  title: 'UI/Dane/Pas meczu',
  component: MatchHeader,
  parameters: { layout: 'padded' },
  args: { match: matchPageFinished, sport: 'football', brandColor: '#1F7A45', timeZone: scheduleTimeZone },
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
  args: { match: matchPageBasketball, sport: 'basketball' },
  play: async ({ canvasElement }) => {
    const lists = within(canvasElement).getAllByRole('listitem')
    await expect(lists).toHaveLength(matchPageBasketball.scorers!.length)
    await expect(matchPageBasketball.scorers!.length).toBeGreaterThan(6)
  },
}

/** Sport bez zdjęcia: płaski kolor turnieju. */
export const InnySport: Story = { args: { sport: 'volleyball' } }

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

/** Pasy do kontroli kontrastu: zdjęcie piłki, zdjęcie kosza i płaski kolor, w obu kolorach turnieju. */
const CONTRAST_CASES = COLORS.flatMap((color) =>
  [
    { sport: 'football', match: matchPageLive },
    { sport: 'basketball', match: matchPageBasketball },
    { sport: 'volleyball', match: matchPageFinished },
  ].map((band) => ({ ...band, color })),
)

/**
 * Każdy tekst w pasie ma kontrast ≥ 4.5:1, a wynik ≥ 3:1, wobec najgorszego
 * piksela zdjęcia pod nakładką (#210). Kolor tekstu idzie z przeglądarki
 * w jasnym i ciemnym motywie, warstwy ze stałych `lib/match-band.ts`, a krycie
 * nakładki jest sprawdzane na wyrenderowanym pasie, żeby klasa nie rozjechała
 * się ze stałą.
 */
export const Kontrast: Story = {
  render: () => (
    <div className="grid gap-4">
      {CONTRAST_CASES.map(({ sport, match, color }) => (
        <Brand key={`${sport}-${color}`} color={color}>
          <MatchHeader match={match} sport={sport} brandColor={color} timeZone={scheduleTimeZone} />
        </Brand>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    try {
      for (const dark of [false, true]) {
        root.classList.toggle('dark', dark)
        const bands = [...canvasElement.querySelectorAll<HTMLElement>('[data-backdrop]')]
        await expect(bands).toHaveLength(CONTRAST_CASES.length)
        for (const band of bands) {
          const brandColor = band.closest<HTMLElement>('[data-brand]')!.dataset.brand!
          const backdrop = band.dataset.backdrop as MatchBandBackdrop
          if (backdrop === 'photo') {
            const overlay = band.querySelector<HTMLElement>('[data-slot="photo-overlay"]')!
            await expect(cssAlpha(getComputedStyle(overlay).backgroundColor)).toBeCloseTo(MATCH_BAND_OVERLAY, 2)
          }
          const texts = [...band.querySelectorAll<HTMLElement>('[data-band-text]')]
          await expect(texts.length).toBeGreaterThanOrEqual(7)
          for (const text of texts) {
            const ratio = matchBandContrast({
              brandColor,
              backdrop,
              text: cssHex(getComputedStyle(text).color),
              region: text.dataset.bandText as MatchBandRegion,
            })
            const minimum = text.hasAttribute('data-band-large') ? MIN_LARGE_TEXT_CONTRAST : MIN_TEXT_CONTRAST
            await expect({ text: text.textContent, brandColor, backdrop, dark, ok: ratio >= minimum }).toEqual(
              expect.objectContaining({ ok: true }),
            )
          }
        }
      }
    } finally {
      root.classList.toggle('dark', wasDark)
    }
  },
}
