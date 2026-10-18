/**
 * PROTOTYP S7 (#287) — próbki do strony „Strona publiczna/Fundamenty”.
 */
import type * as React from 'react'
import { brandForeground, contrastRatio } from '../../lib/contrast'
import { cn } from '../../lib/utils'
import { ACCENT_SAMPLES, DARK_SURFACES, MIN_ACCENT_CONTRAST, MIN_ACCENT_TEXT_CONTRAST, brandOnDark, brandVars, oklchToHex } from './accent'

/** `--brand-text-dark` z `index.css` w `#RRGGBB`. */
const BRAND_TEXT_DARK = oklchToHex({ l: 0.24, c: 0.02, h: 250 })

function Dark({ children, className, accent = ACCENT_SAMPLES.zielen.hex }: { children: React.ReactNode; className?: string; accent?: string }) {
  return (
    <div className={cn('sb-unstyled dark public-site rounded-lg bg-background p-6 text-foreground', className)} style={brandVars(accent)}>
      {children}
    </div>
  )
}

const TOKENS = [
  { name: '--background', role: 'Tło strony (z `.dark`)', className: 'bg-background' },
  { name: '--card', role: 'Powierzchnia: tablica meczu, kafel (z `.dark`)', className: 'bg-card' },
  { name: '--pub-sunken', role: 'Okienko wyniku, pasek nagłówka C. Ciemniej niż tło, jak wyświetlacz', className: 'bg-sunken' },
  { name: '--pub-hairline', role: 'Linia między wierszami, ciszej niż `--border`', className: 'bg-hairline' },
  { name: '--border', role: 'Obrys kafla (z `.dark`)', className: 'bg-border' },
  { name: '--pub-rule', role: 'Belka pod nagłówkiem sekcji, pełny kolor tekstu', className: 'bg-rule' },
  { name: '--muted-foreground', role: 'Tekst drugiego planu (z `.dark`)', className: 'bg-muted-foreground' },
  { name: '--destructive', role: 'Tylko stan „Na żywo” (z `.dark`)', className: 'bg-destructive' },
]

export function PublicTokens() {
  return (
    <Dark>
      <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {TOKENS.map((token) => (
          <li key={token.name} className="flex items-center gap-4">
            <span className={cn('size-10 shrink-0 rounded-md ring-1 ring-white/15', token.className)} />
            <span className="flex flex-col">
              <code className="text-sm">{token.name}</code>
              <span className="text-sm text-muted-foreground">{token.role}</span>
            </span>
          </li>
        ))}
      </ul>
    </Dark>
  )
}

const SCALE = [
  { token: 'pub-score', size: '120 / 64 / 56', use: 'Wynik na tablicy, liczba lidera', sample: <span className="pub-score text-[7.5rem]">3:1</span> },
  { token: 'pub-title', size: '40 (64 w hero B)', use: 'Nazwa turnieju, nazwy drużyn na tablicy. Jedyne wersaliki', sample: <span className="pub-title">Liga Osiedlowa 2026</span> },
  { token: 'pub-h2', size: '28', use: 'Nagłówek sekcji, zdaniem, nie wersalikami', sample: <span className="pub-h2">Najbliższe mecze</span> },
  { token: 'pub-h3', size: '20', use: 'Podtytuł w sekcji', sample: <span className="pub-h3">Kolejka 6</span> },
  { token: 'pub-tab', size: '18', use: 'Zakładki, przyciski, „Na żywo”', sample: <span className="pub-tab">Terminarz</span> },
  { token: 'pub-num', size: '20 / 18', use: 'Godzina, punkty, pozycja. Cyfry tabelaryczne', sample: <span className="pub-num text-xl">12:00 13 +8</span> },
  { token: 'Barlow 400–600', size: '16', use: 'Tekst, nazwy drużyn w wierszach', sample: <span>FC Górka – Sparta</span> },
  { token: 'Barlow 400', size: '14 / 13', use: 'Meta (obiekt, kolejka), stopka', sample: <span className="text-sm text-muted-foreground">Boisko A, sob., 3 paź</span> },
]

export function TypeScale() {
  return (
    <Dark className="flex flex-col">
      {SCALE.map((row) => (
        <div key={row.token} className="grid grid-cols-[minmax(0,1fr)] items-baseline gap-2 border-b border-hairline py-4 sm:grid-cols-[10rem_7rem_minmax(0,1fr)] sm:gap-6">
          <code className="text-sm">{row.token}</code>
          <span className="text-sm text-muted-foreground">{row.size}</span>
          <div className="flex min-w-0 flex-col gap-1">
            <div className="truncate">{row.sample}</div>
            <span className="text-sm text-muted-foreground">{row.use}</span>
          </div>
        </div>
      ))}
    </Dark>
  )
}

const ratio = (a: string, b: string) => contrastRatio(a, b).toFixed(2).replace('.', ',')

export function AccentRule() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Object.values(ACCENT_SAMPLES).map((sample) => {
        const line = brandOnDark(sample.hex)
        const text = brandOnDark(sample.hex, { min: MIN_ACCENT_TEXT_CONTRAST })
        const same = (value: string) => value.toLowerCase() === sample.hex.toLowerCase()
        const fillRatio = contrastRatio(sample.hex, DARK_SURFACES.background)
        const onFill = brandForeground(sample.hex) === 'var(--brand-text-light)' ? '#FFFFFF' : BRAND_TEXT_DARK
        return (
          <Dark key={sample.hex} accent={sample.hex} className="flex flex-col gap-5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="pub-h3">{sample.label}</span>
              <code className="text-sm text-muted-foreground">{sample.hex}</code>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Wypełnienie (<code>--brand</code>): kolor organizera, tekst z <code>brandForeground()</code></span>
              <div className="flex items-center gap-4">
                <span className="inline-flex min-h-11 items-center rounded-md bg-brand px-5 pub-tab text-brand-foreground">Śledź mecz</span>
                <span className="text-sm text-muted-foreground">
                  napis {ratio(sample.hex, onFill)}:1
                  <br />
                  kształt z tłem {ratio(sample.hex, DARK_SURFACES.background)}:1{fillRatio < MIN_ACCENT_CONTRAST && ', słabo się odcina'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-end gap-6 rounded-md bg-card px-4 pt-2">
                <span className="border-b-[3px] border-brand-line pb-2 pub-tab">Przegląd</span>
                <span className="border-b-[3px] border-transparent pb-2 pub-tab text-muted-foreground">Tabela</span>
                <span className="ml-auto pb-2.5 text-sm font-medium text-brand-text">Pełna tabela</span>
              </div>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                <dt><code>--brand-line</code></dt>
                <dd className="text-muted-foreground">
                  {same(line) ? 'bez zmian' : <>→ <code>{line}</code></>}, z kartą {ratio(line, DARK_SURFACES.card)}:1 (min. 3)
                </dd>
                <dt><code>--brand-text</code></dt>
                <dd className="text-muted-foreground">
                  {same(text) ? 'bez zmian' : <>→ <code>{text}</code></>}, z kartą {ratio(text, DARK_SURFACES.card)}:1 (min. 4,5)
                </dd>
              </dl>
            </div>
          </Dark>
        )
      })}
    </div>
  )
}
