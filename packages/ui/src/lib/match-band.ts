import { brandTextTone, contrastRatio } from './contrast'

/**
 * Warstwy pasa strony meczu (`MatchHeader`, #210) i kontrast tekstu na nich.
 * Jedno źródło: pas rysuje warstwy z tych stałych, a funkcja `play` liczy
 * z nich kontrast — oko nie jest tu testem.
 *
 * Od dołu: płaski kolor turnieju i gradient (`MATCH_BAND_SCRIM`) narastający
 * ku dołowi. Zdjęcia sportu pod pasem zniknęły w #290. Kierunek gradientu
 * idzie za tonem tekstu z `brandTextTone()`: pod białym tekstem ciemny, pod
 * ciemnym jasny — ciemny gradient pod ciemnym tekstem obniżyłby kontrast.
 */

/**
 * Krycie gradientu na górze, w połowie i na dole pasa. U góry stoją kolejka,
 * stan, nazwy i wynik, na dole strzelcy i fakty meczu; tekst dolnej części
 * zaczyna się poniżej połowy.
 */
export const MATCH_BAND_SCRIM = { top: 0.25, middle: 0.4, bottom: 0.6 } as const

/** Kolor gradientu dla tonu tekstu: ciemny pod jasnym tekstem, jasny pod ciemnym. */
export function matchBandScrimColor(brandColor: string): '#000000' | '#FFFFFF' {
  return brandTextTone(brandColor) === 'light' ? '#000000' : '#FFFFFF'
}

/** Tło gradientu pasa jako CSS, ze stałych wyżej. */
export function matchBandScrim(brandColor: string): string {
  const rgb = matchBandScrimColor(brandColor) === '#000000' ? '0 0 0' : '255 255 255'
  const { top, middle, bottom } = MATCH_BAND_SCRIM
  return `linear-gradient(to bottom, rgb(${rgb} / ${top}), rgb(${rgb} / ${middle}) 50%, rgb(${rgb} / ${bottom}))`
}

/** Część pasa, w której stoi tekst: górna (do połowy) albo dolna (od połowy). */
export type MatchBandRegion = 'top' | 'bottom'

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [number, number, number]
}

/** Kolor `top` z kryciem `alpha` nałożony na `base` (alfa-kompozycja w sRGB, jak w przeglądarce). */
function over(base: string, top: string, alpha: number): string {
  const [a, b] = [rgb(base), rgb(top)]
  return `#${a.map((channel, i) => Math.round(channel * (1 - alpha) + b[i]! * alpha).toString(16).padStart(2, '0')).join('')}`
}

/**
 * Najsłabszy kontrast tekstu `text` w części pasa `region`.
 *
 * Gradient narasta ku dołowi, więc jego najsłabsze miejsce w górnej części
 * to krycie `top`, a w dolnej `middle`.
 *
 * @param brandColor kolor turnieju `#RRGGBB`
 * @param text kolor tekstu `#RRGGBB`, np. odczytany z przeglądarki w danym motywie
 */
export function matchBandContrast({
  brandColor,
  text,
  region,
}: {
  brandColor: string
  text: string
  region: MatchBandRegion
}): number {
  const scrim = region === 'top' ? MATCH_BAND_SCRIM.top : MATCH_BAND_SCRIM.middle
  return contrastRatio(text, over(brandColor, matchBandScrimColor(brandColor), scrim))
}
