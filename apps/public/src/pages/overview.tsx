import { PublicOverview } from '@tournament/ui';
import { useNavigate } from 'react-router';
import { useFixtures, useLeaderboard, useResults, useStandings } from '../lib/queries';
import { useRounds } from './match-rounds';
import { QueryState } from './query-state';
import { matchHref, tabHref, useTournament } from './tournament-layout';

/**
 * Przegląd (#206) na `PublicOverview` z DS, z kartą lidera domyślnej
 * statystyki (#207). Każdy mecz i „Śledź na żywo” prowadzą na stronę meczu
 * (#210). Turniej `finished` niczego nie dokłada — kafel
 * „Zwycięzca” jest w future work.
 *
 * Zapytania stoją niezależnie: sekcje z jednego źródła pokazują się,
 * gdy ono dotrze, a jego błąd nie zdejmuje pozostałych.
 */
export function OverviewPage() {
  const { slug } = useTournament();
  const navigate = useNavigate();
  const fixtures = useFixtures(slug);
  const results = useResults(slug);
  const standings = useStandings(slug);
  const leaderboard = useLeaderboard(slug);

  return (
    <PublicOverview
      fixtures={useRounds(fixtures.data, 'asc')}
      results={useRounds(results.data, 'desc')}
      standings={standings.data?.[0]?.rows}
      leaderboard={leaderboard.data}
      linkHref={(key) => tabHref(slug, key)}
      onNavigate={(key) => void navigate(tabHref(slug, key))}
      matchHref={(match) => matchHref(slug, match.id)}
      onMatchNavigate={(match) => void navigate(matchHref(slug, match.id))}
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
        leaderboard: !leaderboard.data && (
          <QueryState error={leaderboard.error} label="klasyfikacji" onRetry={() => void leaderboard.refetch()} />
        ),
      }}
    />
  );
}
