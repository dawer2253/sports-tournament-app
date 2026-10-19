import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { BRAND_COLOR_SAMPLES, brandVars } from '../lib/brand-on-dark'
import { cssHex } from '../test/theme'
import { LiveBadge, LiveTag } from './live'
import { ownBrand } from '../test/brand'

const meta = {
  title: 'Strona publiczna/Komponenty/Na żywo',
  component: LiveTag,
  parameters: { layout: 'padded', ...ownBrand },
} satisfies Meta<typeof LiveTag>

export default meta
type Story = StoryObj<typeof meta>

/** „Na żywo” to stan, nie akcent: ten sam kolor (`--destructive`) na zieleni i na granacie. */
export const NiezaleznyOdKoloru: Story = {
  name: 'Niezależny od koloru turnieju',
  render: () => (
    <div className="flex flex-col gap-4">
      {[BRAND_COLOR_SAMPLES.zielen.hex, BRAND_COLOR_SAMPLES.granat.hex].map((hex) => (
        <div key={hex} className="public-site flex items-center gap-6" style={brandVars(hex)}>
          <LiveTag />
          <LiveBadge />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const destructive = document.createElement('span')
    destructive.className = 'text-destructive'
    canvasElement.append(destructive)
    const expected = cssHex(getComputedStyle(destructive).color)
    destructive.remove()

    const marks = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="live-tag"], [data-slot="live-badge"]')]
    await expect(marks).toHaveLength(4)
    for (const mark of marks) await expect(cssHex(getComputedStyle(mark).color)).toBe(expected)
  },
}

/**
 * Plakietka w kolumnie terminu wiersza meczu (5,5 rem na komputerze,
 * 4,5 rem na telefonie, #288): mieści się i nie łamie na dwie linie.
 */
export const PlakietkaWKolumnie: Story = {
  name: 'Plakietka w kolumnie terminu',
  render: () => (
    <div className="flex gap-8">
      {['5.5rem', '4.5rem'].map((width) => (
        <div key={width} data-column={width} className="flex flex-col bg-card" style={{ width }}>
          <LiveBadge />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Szerokość zależy od kroju: liczymy na Barlow Condensed, nie na zastępczym.
    await document.fonts.ready
    for (const column of canvasElement.querySelectorAll<HTMLElement>('[data-column]')) {
      const badge = column.querySelector<HTMLElement>('[data-slot="live-badge"]')!
      const width = badge.getBoundingClientRect().width
      await expect({ column: column.dataset.column, width, fits: width <= column.clientWidth }).toEqual(
        expect.objectContaining({ fits: true }),
      )
      const text = [...badge.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!
      const range = document.createRange()
      range.selectNodeContents(text)
      const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)))
      await expect(lines.size).toBe(1)
    }
  },
}
