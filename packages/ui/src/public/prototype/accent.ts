/**
 * PROTOTYP S7 (#287) — reguła koloru turnieju na ciemnym tle.
 *
 * Kolor turnieju (`branding.primaryColor`) gra dwie role:
 * - **wypełnienie** (logo domyślne, przycisk, aktywny kafel): zostaje tym,
 *   który wybrał organizer, a tekst na nim daje `brandForeground()`;
 * - **linia albo tekst na ciemnym tle** (podkreślenie zakładki, odnośnik,
 *   znacznik lidera): gdy kontrast z najjaśniejszą powierzchnią, na której
 *   leży, spada poniżej 3:1 (WCAG 1.4.11), rozjaśniamy go w OKLCH — ta sama
 *   barwa, wyższa jasność, chroma przycinana do gamutu sRGB.
 *
 * Rozjaśniamy zamiast podmieniać na biel, bo kibic ma dalej rozpoznać kolor
 * swojego turnieju. Przepisane do `lib/` przy wykonaniu, z testami.
 */
import { MIN_TEXT_CONTRAST, brandForeground, contrastRatio } from '../../lib/contrast'

type Oklch = { l: number; c: number; h: number }

function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

function fromLinear(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = [1, 3, 5].map((start) => toLinear(parseInt(hex.slice(start, start + 2), 16) / 255)) as [number, number, number]
  const l = Math.cbrt(0.4122214708 * r + 0.5363288310 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 }
}

/** Kanały liniowe sRGB; poza [0, 1] znaczy poza gamutem. */
function oklchToLinear({ l: L, c, h }: Oklch): [number, number, number] {
  const A = c * Math.cos((h * Math.PI) / 180)
  const B = c * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ]
}

const inGamut = (rgb: number[]) => rgb.every((channel) => channel >= -0.0005 && channel <= 1.0005)

/** OKLCH do `#RRGGBB`; kolor spoza gamutu traci chromę, aż się zmieści. */
export function oklchToHex(color: Oklch): string {
  let c = color.c
  let rgb = oklchToLinear(color)
  while (!inGamut(rgb) && c > 0) {
    c = Math.max(0, c - 0.002)
    rgb = oklchToLinear({ ...color, c })
  }
  return (
    '#' +
    rgb
      .map((channel) => Math.round(Math.min(1, Math.max(0, fromLinear(channel))) * 255).toString(16).padStart(2, '0'))
      .join('')
  )
}

/**
 * Powierzchnie `.dark`, na których kładzie się kolor turnieju, w `#RRGGBB`
 * (z tokenów w `index.css`, przeliczone tą samą funkcją). Kontrast liczymy
 * z najjaśniejszą: co przejdzie na `card`, przejdzie i na `background`.
 */
export const DARK_SURFACES = {
  background: oklchToHex({ l: 0.205, c: 0.015, h: 250 }),
  card: oklchToHex({ l: 0.245, c: 0.016, h: 250 }),
  sunken: oklchToHex({ l: 0.175, c: 0.014, h: 250 }),
} as const

/**
 * Progi kontrastu koloru turnieju z ciemną powierzchnią: linia, kształt
 * i duży tekst (od 24 px) 3:1 (WCAG 1.4.11 i 1.4.3), zwykły tekst 4.5:1.
 * Mapa #286 mówiła o jednym progu 3:1 — dla odnośnika 14 px to za mało.
 */
export const MIN_ACCENT_CONTRAST = 3
export const MIN_ACCENT_TEXT_CONTRAST = MIN_TEXT_CONTRAST

/**
 * Kolor turnieju na ciemnym tle: ten sam, gdy ma z `surface` co najmniej
 * `min`, inaczej rozjaśniony w OKLCH krokiem 0.01, aż przejdzie.
 */
export function brandOnDark(hex: string, { min = MIN_ACCENT_CONTRAST, surface = DARK_SURFACES.card }: { min?: number; surface?: string } = {}): string {
  if (contrastRatio(hex, surface) >= min) return hex
  const base = hexToOklch(hex)
  for (let l = base.l; l <= 0.98; l += 0.01) {
    const candidate = oklchToHex({ ...base, l })
    if (contrastRatio(candidate, surface) >= min) return candidate
  }
  return '#FFFFFF'
}

/**
 * Zmienne CSS koloru turnieju na korzeniu strony publicznej: `--brand`
 * (wypełnienie), `--brand-foreground` (tekst na wypełnieniu), `--brand-line`
 * (linia, kształt, duża liczba na ciemnym tle, 3:1) i `--brand-text`
 * (zwykły tekst na ciemnym tle, 4.5:1).
 */
export function brandVars(hex: string): React.CSSProperties {
  return {
    '--brand': hex,
    '--brand-foreground': brandForeground(hex),
    '--brand-line': brandOnDark(hex),
    '--brand-text': brandOnDark(hex, { min: MIN_ACCENT_TEXT_CONTRAST }),
  } as React.CSSProperties
}

/** Próbki z ticketu #287: domyślna zieleń, granat, bordo, żółty. */
export const ACCENT_SAMPLES = {
  zielen: { label: 'Zieleń (domyślna)', hex: '#1F7A45' },
  granat: { label: 'Granat', hex: '#1E3A8A' },
  bordo: { label: 'Bordo', hex: '#7A1F2B' },
  zolty: { label: 'Żółty', hex: '#E8B10E' },
} as const

export type AccentKey = keyof typeof ACCENT_SAMPLES
