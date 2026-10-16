// PROTOTYP (#252) — kształt wariantu i Przegląd wspólny dla wariantów. Nie do main.
import { PublicOverview, groupByRound, type PublicNavKey } from '@tournament/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { Demo } from './demo';
import { finishedMatches, matchPath, openMatches, stageOrder, tabPath, withPosition } from './shared';

export type Page = Exclude<PublicNavKey, 'stats'>;

export type VariantPages = {
  /** Zakładki w kolejności; mogą zależeć od fazy turnieju. */
  tabs: (demo: Demo) => readonly PublicNavKey[];
  labels?: Partial<Record<PublicNavKey, string>>;
  /** Zakładka podświetlana na danej trasie, gdy trasa nie ma własnej zakładki. */
  activeFor?: (page: Page) => PublicNavKey;
} & Record<Page, (demo: Demo) => ReactNode>;

/**
 * Przegląd na `PublicOverview` z DS, jak w lidze i pucharze: Na żywo,
 * Najbliższe mecze, Ostatnie wyniki. W miejscu skrótu tabeli stoi karta
 * wariantu (`summary`).
 */
export function Overview({ demo, summary, groupLabel }: { demo: Demo; summary: ReactNode; groupLabel?: boolean }) {
  const navigate = useNavigate();
  const rounds = (direction: 'asc' | 'desc') =>
    groupByRound(
      (direction === 'asc' ? openMatches(demo) : finishedMatches(demo)).map((match) => withPosition(demo, match, groupLabel)),
      { direction, stageOrder },
    );
  return (
    <PublicOverview
      fixtures={rounds('asc')}
      results={rounds('desc')}
      linkHref={(key) => tabPath(key)}
      onNavigate={(key) => void navigate(tabPath(key))}
      matchHref={(match) => matchPath(match.id)}
      onMatchNavigate={(match) => void navigate(matchPath(match.id))}
      status={{ standings: summary }}
    />
  );
}
