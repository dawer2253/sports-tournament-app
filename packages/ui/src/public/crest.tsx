import { useImageFallback } from '../lib/image-fallback'
import { teamAbbr } from '../lib/team-abbr'
import { cn } from '../lib/utils'

export interface CrestProps {
  /** Nazwa drużyny: z niej skrót herbu zastępczego. */
  name: string
  /** `Team.logoUrl` z kontraktu: `null`, gdy drużyna nie ma wgranego herbu. */
  logoUrl?: string | null
  /**
   * Herb leży na wypełnieniu kolorem turnieju (pas „Mistrz”, kafel mistrza):
   * obrys i skrót w `--brand-foreground` zamiast `--brand-line` i `--brand-text`.
   */
  onFill?: boolean
  /** Rozmiar pudełka, np. `size-6`. */
  className?: string
}

/**
 * Herb drużyny: wgrany plik albo herb zastępczy w kolorze turnieju — tarcza
 * z obrysem `--brand-line`, wypełnieniem `--brand-line` na 15% i skrótem
 * z `teamAbbr` w `--brand-text`. Zastępczy herb należy do turnieju, nie do
 * drużyny, więc niesie jego kolor zamiast brązu `--crest` z panelu (#287).
 *
 * Plik, który się nie ładuje, oddaje miejsce herbowi zastępczemu (pod mockiem
 * kontraktu adres nigdy się nie ładuje). Dekoracja: nazwa zawsze stoi obok.
 */
export function Crest({ name, logoUrl = null, onFill = false, className }: CrestProps) {
  const image = useImageFallback(logoUrl)
  const abbr = teamAbbr(name)
  return (
    <span data-slot="crest" aria-hidden className={cn('grid size-6 shrink-0 place-items-center', className)}>
      {image.src ? (
        <img src={image.src} alt="" onError={image.onError} className="size-full object-contain" />
      ) : (
        <svg viewBox="0 0 20 24" data-slot="crest-fallback" className="size-full">
          <path
            data-slot="crest-shield"
            d="M10 1.2 17.8 3.5v8.8c0 4.6-3.2 7.9-7.8 10.5-4.6-2.6-7.8-5.9-7.8-10.5V3.5L10 1.2Z"
            className={cn(onFill ? 'fill-brand-foreground/15 stroke-brand-foreground' : 'fill-brand-line/15 stroke-brand-line')}
            strokeWidth="1.4"
          />
          {/* Tarcza zwęża się ku dołowi, więc trzyznakowy skrót dostaje mniejszy stopień. */}
          <text
            data-slot="crest-abbr"
            x="10"
            y="11.5"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={abbr.length > 2 ? 6 : 8}
            fontWeight="700"
            className={cn('font-display', onFill ? 'fill-brand-foreground' : 'fill-brand-text')}
          >
            {abbr}
          </text>
        </svg>
      )}
    </span>
  )
}
