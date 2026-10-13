const HEX_COLOR = /^#[0-9a-f]{6}$/i

/** Czy wartość to kolor `#RRGGBB`, czyli format `branding.primaryColor` z kontraktu. */
export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value)
}

/** Luminancja względna wg WCAG 2 (sRGB, kanały zlinearyzowane). */
function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Współczynnik kontrastu WCAG 2 dwóch kolorów `#RRGGBB`: od 1 (te same kolory)
 * do 21 (czerń i biel). Kolejność argumentów nie ma znaczenia.
 *
 * Wartość spoza formatu to błąd wywołującego, więc funkcja rzuca, zamiast
 * oddać liczbę, która wyglądałaby na wynik.
 */
export function contrastRatio(a: string, b: string): number {
  for (const color of [a, b]) {
    if (!isHexColor(color)) throw new Error(`contrastRatio: oczekiwano #RRGGBB, otrzymano ${color}`)
  }
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Biel tokenu `--brand-text-light`, z którą porównujemy kontrast koloru
 * turnieju: kontrast liczy się w JS, a zmiennej CSS nie da się tu odczytać.
 * Ta sama wartość pilnuje ostrzeżenia w `BrandColorPicker`.
 */
export const BRAND_TEXT_LIGHT = '#FFFFFF'

/** Próg WCAG AA dla zwykłego tekstu. Ten sam pilnuje ostrzeżenia w `BrandColorPicker`. */
export const MIN_TEXT_CONTRAST = 4.5

/** Próg WCAG AA dla dużego tekstu (np. wynik w pasie strony meczu). */
export const MIN_LARGE_TEXT_CONTRAST = 3

/**
 * Ton tekstu na kolorze turnieju: jasny (biel), gdy biel ma z kolorem
 * kontrast co najmniej `MIN_TEXT_CONTRAST`, inaczej ciemny. Kolor turnieju
 * wybiera organizer, więc jasny żółty jest równie możliwy jak ciemna zieleń.
 * Próg do oceny na żywym organizmie w kamieniu S3 (#192).
 */
export function brandTextTone(color: string): 'light' | 'dark' {
  return contrastRatio(color, BRAND_TEXT_LIGHT) >= MIN_TEXT_CONTRAST ? 'light' : 'dark'
}

/**
 * Kolor tekstu na kolorze turnieju (`--brand-foreground`): token
 * `--brand-text-light` albo `--brand-text-dark`, według `brandTextTone()`.
 */
export function brandForeground(color: string): string {
  return brandTextTone(color) === 'light' ? 'var(--brand-text-light)' : 'var(--brand-text-dark)'
}
