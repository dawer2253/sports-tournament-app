import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { TiebreakerCode } from '@tournament/api-client';
import { api } from './api';

/**
 * Tabele turnieju pod `['tournament', id, 'standings', tiebreakers]`, czyli
 * pod kluczem turnieju: jego odświeżenie po zapisie kolejności odświeża też
 * tabele. `tiebreakers` to lista podglądu albo `null` dla zapisanej — z tej
 * samej pozycji cache'u korzystają Tabela i Drabinka playoffu (#260).
 *
 * Kolejne podglądy trzymają poprzednie dane do nadejścia nowych
 * (`keepPreviousData`), żeby tabela nie mrugała przy każdym kliknięciu.
 */
export function useStandings(tournamentId: number, tiebreakers: string[] | null = null, enabled = true) {
  return useQuery({
    queryKey: ['tournament', tournamentId, 'standings', tiebreakers],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await api.GET('/tournaments/{tournament}/standings', {
        params: {
          path: { tournament: tournamentId },
          query: tiebreakers ? { tiebreakers: tiebreakers as TiebreakerCode[] } : {},
        },
      });
      if (error) throw new Error(error.message);
      return data.data;
    },
  });
}
