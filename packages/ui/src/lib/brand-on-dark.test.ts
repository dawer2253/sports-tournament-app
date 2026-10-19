import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { contrastRatio } from './contrast'
import {
  BRAND_COLOR_SAMPLES,
  DARK_SURFACES,
  DEFAULT_BRAND_COLOR,
  brandOnDark,
  brandVars,
  hexToOklch,
  oklchToHex,
} from './brand-on-dark'

const LINE = 3
const TEXT = 4.5

/** Próbki z ticketu (#290) i kolory skrajne. */
const COLORS = ['#1F7A45', '#1E3A8A', '#7A1F2B', '#E8B10E', '#000000', '#FFFFFF', '#0000FF']

const lineOf = (hex: string) => brandOnDark(hex)
const textOf = (hex: string) => brandOnDark(hex, { min: TEXT })

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

describe('brandOnDark', () => {
  it.each(COLORS)('%s jako linia ma z kartą ≥ 3:1, a jako tekst ≥ 4,5:1', (hex) => {
    expect(contrastRatio(lineOf(hex), DARK_SURFACES.card)).toBeGreaterThanOrEqual(LINE)
    expect(contrastRatio(textOf(hex), DARK_SURFACES.card)).toBeGreaterThanOrEqual(TEXT)
  })

  it('rozjaśnia granat do wartości przeliczonych w tickecie', () => {
    expect(lineOf('#1E3A8A')).toBe('#4769be')
    expect(textOf('#1E3A8A')).toBe('#6085dc')
    expect(lineOf('#7A1F2B')).toBe('#ab4c53')
    expect(textOf('#7A1F2B')).toBe('#cd6a70')
    expect(textOf('#1F7A45')).toBe('#439861')
  })

  it.each(['#1F7A45', '#1E3A8A', '#7A1F2B', '#E8B10E', '#0000FF'])('%s zachowuje barwę (najwyżej 1°)', (hex) => {
    const before = hexToOklch(hex).h
    for (const after of [lineOf(hex), textOf(hex)]) {
      expect(hueDistance(hexToOklch(after).h, before)).toBeLessThanOrEqual(1)
    }
  })

  it.each(['#000000', '#FFFFFF'])('%s zostaje achromatyczny', (hex) => {
    for (const after of [lineOf(hex), textOf(hex)]) {
      expect(hexToOklch(after).c).toBeLessThan(0.002)
    }
  })

  it('oddaje bez zmian kolor, który już przechodzi próg', () => {
    expect(lineOf('#1F7A45')).toBe('#1F7A45')
    expect(lineOf('#E8B10E')).toBe('#E8B10E')
    expect(textOf('#E8B10E')).toBe('#E8B10E')
    expect(lineOf('#FFFFFF')).toBe('#FFFFFF')
    expect(textOf('#FFFFFF')).toBe('#FFFFFF')
  })

  it.each(['#1E3A8A', '#7A1F2B', '#000000', '#0000FF', '#1F7A45'])('%s rozjaśnia najmniej, jak się da', (hex) => {
    for (const [min, after] of [
      [LINE, lineOf(hex)],
      [TEXT, textOf(hex)],
    ] as const) {
      if (after === hex) continue
      const step = hexToOklch(after)
      const darker = oklchToHex({ ...step, l: step.l - 0.01 })
      expect(contrastRatio(darker, DARK_SURFACES.card)).toBeLessThan(min)
    }
  })
})

describe('brandVars', () => {
  it('oddaje pięć zmiennych, a wypełnienie zostaje kolorem organizera', () => {
    for (const hex of COLORS) {
      const vars = brandVars(hex) as Record<string, string>
      expect(Object.keys(vars).sort()).toEqual(
        ['--brand', '--brand-foreground', '--brand-line', '--brand-line-foreground', '--brand-text'].sort(),
      )
      expect(vars['--brand']).toBe(hex)
      expect(vars['--brand-line']).toBe(lineOf(hex))
      expect(vars['--brand-text']).toBe(textOf(hex))
    }
  })

  it('daje tekstowi na rozjaśnionej linii ton z jej własnego kontrastu', () => {
    // Granat jako wypełnienie niesie biel, a rozjaśniony do linii też jeszcze tak.
    expect((brandVars('#1E3A8A') as Record<string, string>)['--brand-foreground']).toBe('var(--brand-text-light)')
    // Żółty: ciemny tekst i na wypełnieniu, i na linii.
    expect((brandVars('#E8B10E') as Record<string, string>)['--brand-line-foreground']).toBe('var(--brand-text-dark)')
  })
})

describe('DARK_SURFACES', () => {
  /** Wartości z bloku `.dark` w `src/index.css`, odczytane z pliku. */
  function darkToken(name: string): string {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    const block = css.slice(css.indexOf('\n.dark {'))
    const match = block.match(new RegExp(`--${name}: oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`))
    if (!match) throw new Error(`Brak --${name} w .dark`)
    const [, l, c, h] = match.map(Number) as [number, number, number, number]
    return oklchToHex({ l, c, h })
  }

  it('zgadza się z tokenami .dark w index.css', () => {
    expect(DARK_SURFACES.background).toBe(darkToken('background'))
    expect(DARK_SURFACES.card).toBe(darkToken('card'))
    expect(DARK_SURFACES.sunken).toBe(darkToken('sidebar'))
  })

  it('karta to #1b2128, jak w przeliczeniu z ticketu', () => {
    expect(DARK_SURFACES.card).toBe('#1b2128')
  })
})

describe('stałe koloru turnieju', () => {
  it('domyślny kolor to Tournament::DEFAULT_PRIMARY_COLOR z backendu', () => {
    const php = readFileSync(new URL('../../../../backend/app/Models/Tournament.php', import.meta.url), 'utf8')
    expect(php).toContain(`DEFAULT_PRIMARY_COLOR = '${DEFAULT_BRAND_COLOR}'`)
  })

  it('próbki to zieleń domyślna, granat, bordo i żółty', () => {
    expect(Object.values(BRAND_COLOR_SAMPLES).map((sample) => sample.hex)).toEqual([
      DEFAULT_BRAND_COLOR,
      '#1E3A8A',
      '#7A1F2B',
      '#E8B10E',
    ])
  })
})
