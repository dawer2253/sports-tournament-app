import type { Match } from '@tournament/api-client';
import { EmptyState, RoundMatches, groupByRound } from '@tournament/ui';
import { CalendarDays } from 'lucide-react';
import { useMemo } from 'react';
import { useTournament } from './tournament-layout';

/**
 * Mecze po kolejce dla Terminarza i Wyników: `RoundList` i `MatchRow`
 * z panelu, bez kolizji i ułamka „zakończone/wszystkie”, z oznaczeniem tylko
 * meczu na żywo. Kolejność faz bierze się z `stages` turnieju. Godziny liczy
 * strefa przeglądarki (`Tournament.timezone` odłożone, #158).
 */
export function MatchRounds({
  matches,
  direction,
  empty,
}: {
  matches: Match[];
  direction: 'asc' | 'desc';
  empty: string;
}) {
  const { stages } = useTournament();
  const rounds = useMemo(() => {
    const stageOrder = new Map(stages.map((stage) => [stage.id, stage.order]));
    return groupByRound(matches, { direction, stageOrder: (id) => stageOrder.get(id) ?? id });
  }, [matches, direction, stages]);

  if (rounds.length === 0) {
    return <EmptyState icon={<CalendarDays />} title={empty} />;
  }

  return <RoundMatches rounds={rounds} progress={false} statusDisplay="live" />;
}
