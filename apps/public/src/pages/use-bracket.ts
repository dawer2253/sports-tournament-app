import type { PublicTournament } from '@tournament/api-client';
import { bracketPosition, isKnockoutOnly, type MatchRowBracket } from '@tournament/ui/public';
import { useCallback, useMemo } from 'react';
import { useStageMatches } from '../lib/queries';
import { useTournament } from './tournament-layout';

/**
 * Faza pucharowa turnieju: pierwsza faza `knockout` po `order`. Puchar ma
 * dokładnie jedną; w lidze jej nie ma (`null`).
 */
export function knockoutStage(tournament: PublicTournament): PublicTournament['stages'][number] | null {
  return tournament.stages.toSorted((a, b) => a.order - b.order).find((stage) => stage.type === 'knockout') ?? null;
}

/** Wiersz meczu z pozycją w drabince, gdy mecz należy do fazy pucharowej. */
export type WithBracket<M> = M & { bracket?: MatchRowBracket };

/**
 * Drabinka turnieju z zakładki: faza pucharowa, komplet jej meczów
 * (`/matches?stageId=`, #234) i to, czy turniej jest pucharem — wtedy
 * Drabinka zastępuje Tabelę. Pole wyniku rezerwuje miejsce na karne tylko
 * w sporcie z remisem (`allowsDraw`).
 *
 * `withBracket` dokłada meczowi etykietę pozycji, podpisy pustych slotów
 * i miejsce na karne (`MatchRowData.bracket`), liczone z kompletu meczów
 * fazy, a nie z listy wierszy: po obu półfinałach Terminarz nie ma już
 * krawędzi przegranych, a mecz o 3. miejsce wyszedłby „Finałem”. Mecz spoza
 * fazy pucharowej i mecz przed odpowiedzią `/matches` zostają bez zmian.
 */
export function useBracket() {
  const tournament = useTournament();
  const stage = knockoutStage(tournament);
  const stageId = stage?.id ?? null;
  const matches = useStageMatches(tournament.slug, stageId);
  const penaltySlot = tournament.sport.allowsDraw;
  const stageMatches = matches.data;

  const withBracket = useCallback(
    <M extends { id: number; stageId: number }>(match: M): WithBracket<M> => {
      if (stageId === null || match.stageId !== stageId || !stageMatches) return match;
      const position = bracketPosition(match.id, stageMatches);
      return position ? { ...match, bracket: { ...position, penaltySlot } } : match;
    },
    [stageId, stageMatches, penaltySlot],
  );

  return { stage, matches, cup: isKnockoutOnly(tournament.stages), penaltySlot, withBracket };
}

/** Wiersze listy z pozycją w drabince (Terminarz, Wyniki, Przegląd). */
export function useBracketRows<M extends { id: number; stageId: number }>(rows: readonly M[] | undefined): WithBracket<M>[] | undefined {
  const { withBracket } = useBracket();
  return useMemo(() => rows?.map((row) => withBracket(row)), [rows, withBracket]);
}
