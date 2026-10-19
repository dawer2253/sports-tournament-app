import type { ReactNode } from 'react'
import { BRAND_COLOR_SAMPLES, brandVars, type BrandColorSample } from '../src/lib/brand-on-dark'
import { ThemeRoot } from './theme-root'

/** Korzeń drzewa stories strony publicznej. */
export const PUBLIC_ROOT = 'Strona publiczna/'

/**
 * Nadpisanie koloru turnieju z przełącznika „Kolor turnieju” na każdym
 * `.public-site` story, także na korzeniu shella, który ustawia zmienne
 * inline z `tournament.branding.primaryColor`. Stąd `!important`: deklaracja
 * w arkuszu z `!important` wygrywa z inline bez niego. Tylko w Storybooku,
 * żeby jeden przełącznik przestawiał shell, klocki i „Do przepisania” naraz
 * bez przepisywania danych demo w każdej story.
 */
function overrideCss(sample: BrandColorSample): string {
  const vars = Object.entries(brandVars(BRAND_COLOR_SAMPLES[sample].hex) as Record<string, string>)
    .map(([name, value]) => `${name}: ${value} !important;`)
    .join(' ')
  return `.public-site { ${vars} }`
}

/**
 * Story strony publicznej: zawsze ciemna (`.dark` na `<html>`, niezależnie od
 * „Motywu”, z powodu portali, #136) i owinięta w `.public-site` z kolorem
 * turnieju z przełącznika. `brand: false` (parametr `brandColor.disable`)
 * zostawia kolor z danych — tak stoi „Brak turnieju” na domyślnej zieleni.
 */
export function PublicRoot({ sample, override, children }: { sample: BrandColorSample; override: boolean; children: ReactNode }) {
  return (
    <ThemeRoot theme="dark">
      {override && <style data-story-brand={sample}>{overrideCss(sample)}</style>}
      <div className="public-site bg-background text-foreground" style={brandVars(BRAND_COLOR_SAMPLES[sample].hex)}>
        {children}
      </div>
    </ThemeRoot>
  )
}
