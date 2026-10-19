import { PageNotFound, SiteNotFound, publicTabs } from '@tournament/ui/public';
import { useTabNav, useTournament } from './tournament-layout';

/**
 * Nieznana podtrasa turnieju, w shellu: odnośniki do wszystkich zakładek
 * tego turnieju (puchar bez Tabeli).
 */
export function NotFoundPage() {
  const { slug, stages } = useTournament();
  const tabNav = useTabNav(slug);
  return <PageNotFound tabs={publicTabs(stages)} {...tabNav} />;
}

/** Adres spoza `/t/:slug`: 404 bez shella turnieju. */
export function SiteNotFoundPage() {
  return <SiteNotFound />;
}
