import * as React from 'react'

/**
 * Logika obrazu z zapasem (herb, logo): czy pokazać plik, czy zastępstwo.
 * Wspólna dla `ImageWithFallback` panelu i herbu oraz logo strony publicznej,
 * które nie mogą importować z `components/ui` (#290).
 *
 * Pamiętamy adres, który zawiódł, a nie samą flagę: po zmianie `src` (nowy
 * upload) nowy adres dostaje szansę bez efektu, który by flagę zerował. Pod
 * mockiem kontraktu adres nigdy się nie ładuje, więc zastępstwo jest tam
 * zwykłym stanem, a nie wyjątkiem.
 */
export function useImageFallback(src: string | null, onError?: () => void) {
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null)
  return {
    /** Adres do `<img>` albo `null`, gdy trzeba pokazać zastępstwo. */
    src: src !== null && src !== failedUrl ? src : null,
    /** Do `onError` obrazu: zapamiętuje adres i woła `onError` raz na adres. */
    onError: () => {
      setFailedUrl(src)
      onError?.()
    },
  }
}
