import { useQuery } from '@tanstack/react-query';
import type { Sport } from '@tournament/api-client';
import { api } from './api';
import { ApiError } from './api-error';
import { useSports } from './use-sports';

/**
 * Zdarzenia meczu leżą pod własnym prefiksem, a nie pod `['tournament', id]`:
 * zapis zdarzenia nie zmienia wyniku ani tabeli (#188, reguła 11), więc nie ma
 * powodu odświeżać przy nim terminarza.
 */
export const matchEventKeys = {
  list: (matchId: number) => ['match', matchId, 'events'] as const,
};

/**
 * Zdarzenia meczu w kolejności z API (minuta rosnąco, bez minuty na końcu).
 * Mecz zaplanowany zdarzeń nie ma, więc wtedy zapytanie nie idzie.
 */
export function useMatchEvents(matchId: number, enabled: boolean) {
  return useQuery({
    queryKey: matchEventKeys.list(matchId),
    enabled,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/matches/{match}/events', {
        params: { path: { match: matchId } },
      });
      if (error) throw new ApiError(error.message, response.status);
      return data.data;
    },
  });
}

/**
 * Typy zdarzeń sportu turnieju i jego „zdobycz” — pierwszy wpis
 * `availableStats` (#190): bramki w piłce, punkty w koszu. Typy tej
 * statystyki dostają wyróżnione przyciski i liczą się do linii zgodności.
 */
export function useEventTypes(sportCode: Sport['code']) {
  const sports = useSports();
  const config = sports.data?.find((sport) => sport.code === sportCode)?.config;
  return {
    types: config?.eventTypes,
    scoringStat: config?.availableStats[0],
  };
}
