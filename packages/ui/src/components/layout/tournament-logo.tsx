import { Trophy } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ImageWithFallback } from '../ui/image-with-fallback'

export interface TournamentLogoProps {
  /** `branding.logoUrl` z kontraktu: `null`, gdy turniej nie ma wgranego logo. */
  logoUrl: string | null
  /** Kolor wiodący `#RRGGBB`, tło domyślnego logo. Ekran ustawień podaje kolor z formularza. */
  color: string
  /**
   * Adres jest, ale plik się nie wyświetla. Ekran mówi wtedy organizerowi, że
   * logo istnieje, tylko się nie ładuje (#91 pkt 2).
   */
  onError?: () => void
  /** Rozmiar pudełka, np. `size-16`. */
  className?: string
}

/**
 * Logo turnieju: wgrany plik albo **domyślne logo**, czyli `Trophy` na kolorze
 * turnieju. Domyślne logo istnieje tylko w UI — w API zostaje `logoUrl: null`.
 *
 * Wchodzi też po błędzie ładowania; pod mockiem kontraktu adres nigdy się nie
 * ładuje. Logo stoi w stałym pudełku z `object-contain`, jak `TeamLogo`.
 */
export function TournamentLogo({ logoUrl, color, onError, className }: TournamentLogoProps) {
  return (
    <span data-slot="tournament-logo" className={cn('grid size-12 shrink-0 place-items-center', className)}>
      <ImageWithFallback
        src={logoUrl}
        onError={onError}
        fallback={
          <span
            data-slot="tournament-logo-default"
            aria-hidden
            className="grid size-full place-items-center rounded-lg text-brand-foreground"
            // Kolor turnieju to dane organizera, nie token motywu.
            style={{ backgroundColor: color }}
          >
            <Trophy className="size-1/2" />
          </span>
        }
      />
    </span>
  )
}
