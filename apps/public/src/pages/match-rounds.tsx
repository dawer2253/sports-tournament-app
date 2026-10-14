import type { PublicMatch } from '@tournament/api-client';
import { EmptyState, RoundSections, groupByRound } from '@tournament/ui';
import { CalendarDays } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { matchHref, useTournament } from './tournament-layout';
import { useBracketRows } from './use-bracket';

/**
 * Mecze pogrupowane po kolejce w kolejności faz z `stages` turnieju — ta sama
 * dla Terminarza, Wyników i Przeglądu, żeby „najbliższa” i „ostatnia”
 * kolejka znaczyły wszędzie to samo.
 */
export function useRounds(matches: PublicMatch[] | undefined, direction: 'asc' | 'desc') {
  const { stages } = useTournament();
  // W pucharze wiersze niosą etykietę pozycji, karne i podpisy pustych slotów (#234).
  const rows = useBracketRows(matches);
  return useMemo(() => {
    const stageOrder = new Map(stages.map((stage) => [stage.id, stage.order]));
    return groupByRound(rows ?? [], { direction, stageOrder: (id) => stageOrder.get(id) ?? id });
  }, [rows, direction, stages]);
}

/**
 * Mecze po kolejce dla Terminarza i Wyników: jedna lista z nagłówkami kolejek
 * i „Pokaż więcej” (`RoundSections`, #226), na `MatchRow` z panelu bez
 * kolizji, z oznaczeniem tylko meczu na żywo i ze strzelcami pod wynikiem
 * (#208). Cały wiersz prowadzi na stronę meczu (#210). Godziny liczy strefa
 * przeglądarki (`Tournament.timezone` odłożone, #158).
 */
export function MatchRounds({
  matches,
  direction,
  empty,
}: {
  matches: PublicMatch[];
  direction: 'asc' | 'desc';
  empty: string;
}) {
  const { slug } = useTournament();
  const navigate = useNavigate();
  const rounds = useRounds(matches, direction);

  if (rounds.length === 0) {
    return <EmptyState icon={<CalendarDays />} title={empty} />;
  }

  return (
    <RoundSections
      rounds={rounds}
      statusDisplay="live"
      matchHref={(match) => matchHref(slug, match.id)}
      onMatchNavigate={(match) => void navigate(matchHref(slug, match.id))}
    />
  );
}
