import { PublicOverview } from '@tournament/ui';
import { useNavigate } from 'react-router';
import { useFixtures, useResults, useStandings } from '../lib/queries';
import { useRounds } from './match-rounds';
import { QueryState } from './query-state';
import { tabHref, useTournament } from './tournament-layout';

/**
 * Przegląd (#206) na `PublicOverview` z DS. Turniej `finished` niczego nie
 * dokłada — kafel „Zwycięzca” jest w future work.
 *
 * Trzy zapytania stoją niezależnie: sekcje z jednego źródła pokazują się,
 * gdy ono dotrze, a jego błąd nie zdejmuje pozostałych.
 */
export function OverviewPage() {
  const { slug } = useTournament();
  const navigate = useNavigate();
  const fixtures = useFixtures(slug);
  const results = useResults(slug);
  const standings = useStandings(slug);

  return (
    <PublicOverview
      fixtures={useRounds(fixtures.data, 'asc')}
      results={useRounds(results.data, 'desc')}
      standings={standings.data?.[0]?.rows}
      linkHref={(key) => tabHref(slug, key)}
      onNavigate={(key) => void navigate(tabHref(slug, key))}
      status={{
        fixtures: !fixtures.data && (
          <QueryState error={fixtures.error} label="meczów" onRetry={() => void fixtures.refetch()} />
        ),
        results: !results.data && results.error && (
          <QueryState error={results.error} label="wyników" onRetry={() => void results.refetch()} />
        ),
        standings: !standings.data && (
          <QueryState error={standings.error} label="tabeli" onRetry={() => void standings.refetch()} />
        ),
      }}
    />
  );
}
