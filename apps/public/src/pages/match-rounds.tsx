import type { Match } from '@tournament/api-client';
import { EmptyState, RoundMatches, groupByRound } from '@tournament/ui';
import { CalendarDays } from 'lucide-react';
import { useMemo } from 'react';
import { useTournament } from './tournament-layout';

/**
 * Mecze pogrupowane po kolejce w kolejności faz z `stages` turnieju — ta sama
 * dla Terminarza, Wyników i Przeglądu, żeby „najbliższa” i „ostatnia”
 * kolejka znaczyły wszędzie to samo.
 */
export function useRounds(matches: Match[] | undefined, direction: 'asc' | 'desc') {
  const { stages } = useTournament();
  return useMemo(() => {
    const stageOrder = new Map(stages.map((stage) => [stage.id, stage.order]));
    return groupByRound(matches ?? [], { direction, stageOrder: (id) => stageOrder.get(id) ?? id });
  }, [matches, direction, stages]);
}

/**
 * Mecze po kolejce dla Terminarza i Wyników: `RoundList` i `MatchRow`
 * z panelu, bez kolizji i ułamka „zakończone/wszystkie”, z oznaczeniem tylko
 * meczu na żywo. Godziny liczy strefa przeglądarki (`Tournament.timezone`
 * odłożone, #158).
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
  const rounds = useRounds(matches, direction);

  if (rounds.length === 0) {
    return <EmptyState icon={<CalendarDays />} title={empty} />;
  }

  return <RoundMatches rounds={rounds} progress={false} statusDisplay="live" />;
}
