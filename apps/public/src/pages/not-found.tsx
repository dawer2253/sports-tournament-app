import { PageNotFound, SiteNotFound, publicTabs } from '@tournament/ui/public';
import { useNavigate } from 'react-router';
import { tabHref, useTournament } from './tournament-layout';

/**
 * Nieznana podtrasa turnieju, w shellu: odnośniki do wszystkich zakładek
 * tego turnieju (puchar bez Tabeli).
 */
export function NotFoundPage() {
  const { slug, stages } = useTournament();
  const navigate = useNavigate();
  return (
    <PageNotFound
      tabs={publicTabs(stages)}
      navHref={(key) => tabHref(slug, key)}
      onNavigate={(key) => void navigate(tabHref(slug, key))}
    />
  );
}

/** Adres spoza `/t/:slug`: 404 bez shella turnieju. */
export function SiteNotFoundPage() {
  return <SiteNotFound />;
}
