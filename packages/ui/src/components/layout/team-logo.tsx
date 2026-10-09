import * as React from 'react'
import { cn } from '../../lib/utils'
import { TeamCrest, teamAbbr } from './team-crest'

export interface TeamLogoProps {
  /** `Team.logoUrl` z kontraktu: `null`, gdy drużyna nie ma wgranego herbu. */
  logoUrl: string | null
  name: string
  /** Rozmiar pudełka, np. `size-8`. */
  className?: string
}

/**
 * Herb drużyny: wgrane logo albo herb zastępczy ze skrótem z `teamAbbr`.
 *
 * Logo stoi w stałym pudełku z `object-contain` (#88 pkt 2), więc szerokie
 * i wysokie pliki zajmują w wierszu tyle samo miejsca. Zastępczy herb wchodzi
 * także po błędzie ładowania — pod mockiem kontraktu adres nigdy się nie ładuje.
 *
 * Komponent jest dekoracją (`alt=""`, jak `aria-hidden` w `TeamCrest`), bo
 * nazwa drużyny zawsze stoi obok.
 */
export function TeamLogo({ logoUrl, name, className }: TeamLogoProps) {
  // Pamiętamy adres, który zawiódł, a nie samą flagę: po zmianie `logoUrl`
  // (nowy upload) nowy adres dostaje szansę bez efektu, który by flagę zerował.
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null)
  const showImage = logoUrl !== null && logoUrl !== failedUrl

  return (
    <span data-slot="team-logo" className={cn('grid size-6 shrink-0 place-items-center', className)}>
      {showImage ? (
        <img
          src={logoUrl}
          alt=""
          className="size-full object-contain"
          onError={() => setFailedUrl(logoUrl)}
        />
      ) : (
        <TeamCrest abbr={teamAbbr(name)} className="size-full" />
      )}
    </span>
  )
}
