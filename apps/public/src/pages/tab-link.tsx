import { Button, type PublicNavKey } from '@tournament/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { tabHref, useTournament } from './tournament-layout';

/**
 * Odnośnik pustego stanu do innej zakładki turnieju, np. „Przejdź do
 * drabinki” (#234). Klik przejmuje router, a z klawiszem modyfikującym
 * zostaje przeglądarce.
 */
export function TabLink({ tab, children }: { tab: PublicNavKey; children: ReactNode }) {
  const { slug } = useTournament();
  const navigate = useNavigate();
  const href = tabHref(slug, tab);
  return (
    <Button asChild variant="outline">
      <a
        href={href}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          void navigate(href);
        }}
      >
        {children}
      </a>
    </Button>
  );
}
