import { DEFAULT_BRAND_COLOR, StandaloneShell } from '@tournament/ui/public';

/**
 * Strona bez shella turnieju (adres spoza `/t/:slug`): pasek z samym
 * „TournamentApp” i domyślna zieleń, bo turnieju i jego koloru nie ma.
 */
export function StandalonePage({ children }: { children: React.ReactNode }) {
  return <StandaloneShell primaryColor={DEFAULT_BRAND_COLOR}>{children}</StandaloneShell>;
}
