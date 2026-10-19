import { MatchRounds } from './match-rounds';

/** Terminarz (#206, #292): `/fixtures` po kolejce, rosnąco, z postępem kolejki liczonym razem z `/results`. */
export function FixturesPage() {
  return <MatchRounds mode="fixtures" />;
}
