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
