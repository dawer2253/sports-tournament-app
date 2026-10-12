import { useResults } from '../lib/queries';
import { MatchRounds } from './match-rounds';
import { QueryState } from './query-state';
import { useTournament } from './tournament-layout';

/** Wyniki (#206): `/results` po kolejce, od najnowszej. */
export function ResultsPage() {
  const { slug } = useTournament();
  const results = useResults(slug);

  if (!results.data) {
    return <QueryState error={results.error} label="wyników" onRetry={() => void results.refetch()} />;
  }
  return <MatchRounds matches={results.data} direction="desc" empty="Brak rozegranych meczów" />;
}
