import * as React from 'react'
import { cn } from '../../lib/utils'
import { ImageWithFallback } from './image-with-fallback'
import { Input } from './input'
import { Label } from './label'

/** Formaty, które przyjmuje kontrakt dla herbu i logo turnieju. */
const ACCEPT = 'image/png,image/jpeg,image/webp'

export interface ImageFileFieldProps {
  label: string
  /** Wybrany plik. `null`, gdy organizer jeszcze nic nie wybrał. */
  value: File | null
  onChange: (file: File | null) => void
  /** Obraz zapisany na serwerze (`logoUrl`). Podgląd pokazuje go, dopóki nie wybrano pliku. */
  currentUrl?: string | null
  /** Podpowiedź pod polem, np. dozwolone formaty i rozmiar. */
  hint?: string
  /** Komunikat błędu od aplikacji: pole samo niczego nie waliduje. */
  error?: string
  /** Podgląd, gdy nie ma obrazu albo się nie ładuje, np. herb zastępczy. */
  fallback?: React.ReactNode
  id?: string
  disabled?: boolean
  className?: string
}

/**
 * Pole pliku obrazu z podglądem, wspólne dla herbu drużyny i logo turnieju
 * (#89 pkt 8, #91). Jest prezentacyjne: format i rozmiar sprawdza aplikacja,
 * a wymiary serwer. Przeciągania nie ma, bo oba obrazy wgrywa się w oknie
 * z własnym „Zapisz".
 */
export function ImageFileField({
  label,
  value,
  onChange,
  currentUrl = null,
  hint,
  error,
  fallback,
  id,
  disabled,
  className,
}: ImageFileFieldProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Object URL żyje dokładnie tyle co wybrany plik: zwalniamy go przy zmianie
  // pliku i przy odmontowaniu. Adres trzymamy w stanie, a nie w `useMemo`, bo
  // w StrictMode sprzątanie efektu zwolniłoby adres, który memo dalej oddaje.
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!value) return
    const url = URL.createObjectURL(value)
    // Efekt synchronizuje stan z zewnętrznym rejestrem adresów `blob:`, czyli
    // dokładnie z tym, do czego efekty są; adresu nie da się wyliczyć w renderze.
    // oxlint-disable-next-line react/set-state-in-effect
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [value])
  // Po wyczyszczeniu pliku stary adres jest już zwolniony, więc go nie pokazujemy.
  const previewUrl = value ? objectUrl : null

  // Natywny `<input type="file">` nie przyjmuje wartości z zewnątrz, więc
  // wyczyszczenie `value` (np. reset formularza) zerujemy ręcznie — inaczej
  // pole pokazywałoby nazwę pliku, którego formularz już nie ma.
  React.useEffect(() => {
    if (value === null && inputRef.current) inputRef.current.value = ''
  }, [value])

  const shownUrl = previewUrl ?? currentUrl

  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div data-slot="image-file-field" className={cn('flex items-start gap-4', className)}>
      <span className="grid size-16 shrink-0 place-items-center rounded-lg border bg-muted/40 p-1.5">
        {/* Dekoracja: pole ma etykietę, a wybrany plik nazywa sam input. */}
        <ImageWithFallback src={shownUrl} fallback={fallback} />
      </span>
      <div className="grid min-w-0 flex-1 gap-1.5">
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        />
        {hint && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
