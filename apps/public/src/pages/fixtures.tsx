import { useFixtures } from '../lib/queries';
import { MatchRounds } from './match-rounds';
import { QueryState } from './query-state';
import { useTournament } from './tournament-layout';

/** Terminarz (#206): `/fixtures` po kolejce, rosnąco. Mecz `live` stoi tutaj, z `LiveMarker`. */
export function FixturesPage() {
  const { slug } = useTournament();
  const fixtures = useFixtures(slug);

  if (!fixtures.data) {
    return <QueryState error={fixtures.error} label="terminarza" onRetry={() => void fixtures.refetch()} />;
  }
  return <MatchRounds matches={fixtures.data} direction="asc" empty="Brak zaplanowanych meczów" />;
}
