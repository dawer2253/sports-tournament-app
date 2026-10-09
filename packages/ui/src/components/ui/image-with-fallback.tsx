import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ImageWithFallbackProps {
  /** Adres obrazu. `null`, gdy obrazu nie ma. */
  src: string | null
  /** Co pokazać bez adresu i po błędzie ładowania, np. herb zastępczy. */
  fallback: React.ReactNode
  /** Woła się raz na adres, który się nie załadował. Brak adresu to nie błąd. */
  onError?: () => void
  className?: string
}

/**
 * Obraz z zapasem: herb drużyny, logo turnieju i podgląd pola obrazu (#118).
 *
 * Obraz wypełnia pudełko rodzica z `object-contain`, więc szerokie i wysokie
 * pliki zajmują tyle samo miejsca. To dekoracja (`alt=""`): nazwę zawsze niesie
 * coś obok — nazwa drużyny, etykieta pola, nagłówek karty.
 */
export function ImageWithFallback({ src, fallback, onError, className }: ImageWithFallbackProps) {
  // Pamiętamy adres, który zawiódł, a nie samą flagę: po zmianie `src` (nowy
  // upload) nowy adres dostaje szansę bez efektu, który by flagę zerował.
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null)
  const showImage = src !== null && src !== failedUrl

  return showImage ? (
    <img
      src={src}
      alt=""
      className={cn('size-full object-contain', className)}
      onError={() => {
        setFailedUrl(src)
        onError?.()
      }}
    />
  ) : (
    fallback
  )
}
