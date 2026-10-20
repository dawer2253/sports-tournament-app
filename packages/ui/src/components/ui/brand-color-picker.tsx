import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { BRAND_TEXT_LIGHT, contrastRatio, isHexColor, MIN_TEXT_CONTRAST } from '../../lib/contrast'
import { cn } from '../../lib/utils'
import { Input } from './input'
import { Label } from './label'

export interface BrandPalette {
  name: string
  /** Kolor wiodący `#RRGGBB`, czyli to, co trafia do `branding.primaryColor`. */
  hex: string
}

/**
 * Gotowe palety koloru wiodącego (#91 pkt 6). Paleta to nazwa i jeden kolor:
 * strona publiczna ma jeden kolor marki. Każda ma z bielą kontrast co najmniej
 * 4.5:1 (WCAG AA), bo na stronie turnieju stoi pod prawie białym tekstem —
 * pilnuje tego funkcja `play` w stories.
 *
 * Hexy to wyjątek od reguły „kolory tylko z tokenów": to dane, które organizer
 * zapisuje w turnieju, a nie chroma interfejsu. Pierwsza paleta to domyślny
 * kolor turnieju z backendu (`Tournament::DEFAULT_PRIMARY_COLOR`).
 */
export const BRAND_PALETTES: readonly BrandPalette[] = [
  { name: 'Murawa', hex: '#1F7A45' },
  { name: 'Granat', hex: '#1D4E89' },
  { name: 'Bordo', hex: '#9B1C31' },
  { name: 'Śliwka', hex: '#6B3FA0' },
  { name: 'Morze', hex: '#0E7490' },
  { name: 'Cegła', hex: '#B4471B' },
]

/** Wspólny wygląd kafelka: palety i „Własny” mają się stylować razem. */
const TILE_CLASS =
  'grid cursor-pointer justify-items-center gap-1.5 rounded-lg border border-border p-2 text-xs transition-colors hover:bg-muted/50 has-checked:border-ring has-checked:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/50'

/** Domyślny kolor turnieju, czyli paleta „Murawa”. */
export const DEFAULT_BRAND_COLOR = BRAND_PALETTES[0]!.hex

export interface BrandColorPickerProps {
  /** `branding.primaryColor`. Może być chwilowo niepoprawny, gdy organizer pisze w polu hex. */
  value: string
  onChange: (hex: string) => void
  /** Komunikat błędu od aplikacji: komponent sam niczego nie waliduje. */
  error?: string
  label?: string
  id?: string
  className?: string
}

/**
 * Wybór koloru wiodącego turnieju: sześć palet i kafelek „Własny” z polem hex.
 *
 * Nazwa palety nigdzie się nie zapisuje — paletę rozpoznajemy po hexie bez
 * względu na wielkość liter, a hex spoza palet zaznacza „Własny”.
 * Słaby kontrast z bielą daje ostrzeżenie, nie błąd: kontrakt przyjmuje każdy
 * `#RRGGBB`, więc komponent niczego nie blokuje.
 */
export function BrandColorPicker({
  value,
  onChange,
  error,
  label = 'Kolor wiodący',
  id,
  className,
}: BrandColorPickerProps) {
  const generatedId = React.useId()
  const baseId = id ?? generatedId
  const hexId = `${baseId}-hex`
  const panelId = `${baseId}-custom`
  const warningId = `${baseId}-warning`
  const errorId = `${baseId}-error`

  const selected = BRAND_PALETTES.find((palette) => palette.hex.toLowerCase() === value.toLowerCase())
  const [customPicked, setCustomPicked] = React.useState(false)
  // Wartość spoza palet nie ma gdzie się pokazać poza polem hex, więc wtedy
  // „Własny” jest zaznaczony niezależnie od kliknięcia.
  const customActive = customPicked || !selected

  // Ostatni kolor, który komponent sam oddał. Inna wartość w `value` to zmiana
  // z zewnątrz (reset formularza, wczytanie zapisanych danych): na paletę zdejmuje
  // wybór „Własny”. Zmiany z pola hex zostają, bo `customPicked` jest wtedy ustawione.
  const emitted = React.useRef(value)
  React.useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value
      setCustomPicked(false)
    }
  }, [value])

  function emit(hex: string, custom: boolean) {
    emitted.current = hex
    setCustomPicked(custom)
    onChange(hex)
  }

  const lowContrast = isHexColor(value) && contrastRatio(value, BRAND_TEXT_LIGHT) < MIN_TEXT_CONTRAST
  const describedBy = [lowContrast && warningId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <fieldset data-slot="brand-color-picker" className={cn('grid gap-3', className)}>
      <legend className="mb-2 text-sm leading-none font-medium">{label}</legend>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        {BRAND_PALETTES.map((palette) => (
          <label key={palette.hex} className={TILE_CLASS}>
            <input
              type="radio"
              name={`${baseId}-palette`}
              value={palette.hex}
              checked={!customActive && selected === palette}
              onChange={() => emit(palette.hex, false)}
              className="sr-only"
            />
            {/* Kolor palety to dane (zapisany hex), nie token motywu. */}
            <span aria-hidden className="size-8 rounded-full" style={{ backgroundColor: palette.hex }} />
            {palette.name}
          </label>
        ))}
        <label className={TILE_CLASS}>
          <input
            type="radio"
            name={`${baseId}-palette`}
            value="custom"
            checked={customActive}
            // Kolor nie zmienia się przy samym przejściu na „Własny”: pole hex startuje od bieżącego.
            onChange={() => setCustomPicked(true)}
            className="sr-only"
          />
          {/* Kolor to dane (wpisany hex), nie token motywu; bez poprawnego hexa zostaje obwódka. */}
          <span
            aria-hidden
            className="size-8 rounded-full border border-dashed border-muted-foreground"
            style={customActive && isHexColor(value) ? { backgroundColor: value } : undefined}
          />
          Własny
        </label>
      </div>

      {customActive && (
        <div id={panelId} className="grid gap-1.5">
          <Label htmlFor={hexId}>Kolor (hex)</Label>
          <div className="flex items-center gap-2">
            <Input
              id={hexId}
              value={value}
              onChange={(event) => emit(event.target.value, true)}
              placeholder={DEFAULT_BRAND_COLOR}
              spellCheck={false}
              autoComplete="off"
              className="max-w-36 font-mono"
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
            />
            <input
              type="color"
              aria-label="Wybierz kolor"
              // Natywny wybór koloru zna tylko poprawny hex małymi literami.
              value={isHexColor(value) ? value.toLowerCase() : '#000000'}
              onChange={(event) => emit(event.target.value.toUpperCase(), true)}
              className="h-8 w-10 cursor-pointer rounded-lg border border-input bg-transparent p-0.5"
            />
          </div>
          {lowContrast && (
            <p id={warningId} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />
              Słaby kontrast z białym tekstem: tekst na stronie turnieju może być nieczytelny.
            </p>
          )}
          {error && (
            <p id={errorId} className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </fieldset>
  )
}
