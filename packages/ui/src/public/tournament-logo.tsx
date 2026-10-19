import { useImageFallback } from '../lib/image-fallback'
import { cn } from '../lib/utils'

export interface TournamentLogoProps {
  /** `branding.logoUrl` z kontraktu: `null`, gdy turniej nie ma wgranego logo. */
  logoUrl: string | null
  /** Rozmiar pudełka, np. `size-10`. */
  className?: string
}

/**
 * Logo turnieju: wgrany plik albo **logo domyślne** — puchar na wypełnieniu
 * kolorem turnieju (`pub-brand-fill`: `--brand` z obrysem `--brand-line`,
 * tekst w `--brand-foreground`). Plik, który się nie ładuje, oddaje miejsce
 * logo domyślnemu. Dekoracja: nazwa turnieju stoi obok.
 */
export function TournamentLogo({ logoUrl, className }: TournamentLogoProps) {
  const image = useImageFallback(logoUrl)
  return (
    <span data-slot="tournament-logo" aria-hidden className={cn('grid size-10 shrink-0 place-items-center', className)}>
      {image.src ? (
        <img src={image.src} alt="" onError={image.onError} className="size-full object-contain" />
      ) : (
        <span data-slot="tournament-logo-default" className="pub-brand-fill grid size-full place-items-center rounded-md">
          <svg viewBox="0 0 24 24" className="size-1/2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M4 22h16" />
            <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </svg>
        </span>
      )}
    </span>
  )
}
