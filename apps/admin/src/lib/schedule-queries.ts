import { useQuery } from '@tanstack/react-query';
import type { AdminMatch } from '@tournament/api-client';
import { api } from './api';
import { ApiError } from './api-error';

/**
 * Klucze zapytań terminarza, pod `['tournament', id]` jak inne listy turnieju
 * (`apps/admin/AGENTS.md`, „Edycja list”), więc unieważnienie turnieju
 * odświeża też terminarz.
 */
export const scheduleKeys = {
  stages: (tournamentId: number) => ['tournament', tournamentId, 'stages'] as const,
  /** Bez `stageId` pasuje po prefiksie do meczów każdej fazy. */
  matches: (tournamentId: number, stageId?: number) =>
    stageId === undefined
      ? (['tournament', tournamentId, 'matches'] as const)
      : (['tournament', tournamentId, 'matches', stageId] as const),
  venues: (tournamentId: number) => ['tournament', tournamentId, 'venues'] as const,
};

/** Największa strona listy meczów w kontrakcie. */
const PER_PAGE = 200;

/** Bez `tournamentId` (ekran poza turniejem) zapytanie nie idzie. */
export function useStages(tournamentId: number | undefined) {
  return useQuery({
    queryKey: scheduleKeys.stages(tournamentId ?? 0),
    enabled: tournamentId !== undefined,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/tournaments/{tournament}/stages', {
        params: { path: { tournament: tournamentId! } },
      });
      if (error) throw new ApiError(error.message, response.status);
      return data.data;
    },
  });
}

/**
 * Wszystkie mecze fazy, strona po stronie (#162, pkt 14): kolejki, daty
 * i liczniki panel liczy sam z kompletu. Strony idą po kolei, bo liczbę
 * stron zna dopiero pierwsza odpowiedź; liga dwudziestu drużyn z rewanżem
 * to 380 meczów, czyli dwie strony.
 *
 * `AdminMatch` niesie `collisions` liczone przy odczycie (#175).
 */
export function useStageMatches(tournamentId: number, stageId: number | undefined) {
  return useQuery({
    queryKey: scheduleKeys.matches(tournamentId, stageId ?? 0),
    enabled: stageId !== undefined,
    queryFn: async () => {
      const matches: AdminMatch[] = [];
      let page = 1;
      let lastPage = 1;
      do {
        const { data, error, response } = await api.GET('/tournaments/{tournament}/matches', {
          params: {
            path: { tournament: tournamentId },
            query: { stageId: stageId!, perPage: PER_PAGE, page },
          },
        });
        if (error) throw new ApiError(error.message, response.status);
        matches.push(...data.data);
        lastPage = data.meta.lastPage;
        page += 1;
      } while (page <= lastPage);
      return matches;
    },
  });
}

/** Obiekty turnieju do wyboru w oknie rozkładu dat (#158). */
export function useVenues(tournamentId: number) {
  return useQuery({
    queryKey: scheduleKeys.venues(tournamentId),
    queryFn: async () => {
      const { data, error, response } = await api.GET('/tournaments/{tournament}/venues', {
        params: { path: { tournament: tournamentId } },
      });
      if (error) throw new ApiError(error.message, response.status);
      return data.data;
    },
  });
}
