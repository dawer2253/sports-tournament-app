import { useQuery } from '@tanstack/react-query';
import { POLL_INTERVAL_MS, api } from './api';
import { ApiError } from './api-error';

/**
 * Zapytania strony publicznej. Każde odpytuje co `POLL_INTERVAL_MS`, także
 * w turnieju `finished` (#192): poprawka wyniku po zakończeniu jest możliwa,
 * a bez zmian odpytanie kosztuje puste `304`. `If-None-Match` wysyła sama
 * przeglądarka, z pamięci podręcznej — kod go nie dotyka (ADR-0007).
 *
 * Klucze leżą pod `['public', slug]`, więc wszystko o jednym turnieju da się
 * unieważnić naraz.
 */
const polling = { refetchInterval: POLL_INTERVAL_MS } as const;

export function usePublicTournament(slug: string) {
  return useQuery({
    queryKey: ['public', slug],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/public/t/{slug}', { params: { path: { slug } } });
      if (error) throw new ApiError(error.message, response.status);
      return data.data;
    },
    ...polling,
  });
}

export function useStandings(slug: string) {
  return useQuery({
    queryKey: ['public', slug, 'standings'],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/public/t/{slug}/standings', { params: { path: { slug } } });
      if (error) throw new ApiError(error.message, response.status);
      return data.data;
    },
    ...polling,
  });
}

export function useFixtures(slug: string) {
  return useQuery({
    queryKey: ['public', slug, 'fixtures'],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/public/t/{slug}/fixtures', { params: { path: { slug } } });
      if (error) throw new ApiError(error.message, response.status);
      return data.data;
    },
    ...polling,
  });
}

export function useResults(slug: string) {
  return useQuery({
    queryKey: ['public', slug, 'results'],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/public/t/{slug}/results', { params: { path: { slug } } });
      if (error) throw new ApiError(error.message, response.status);
      return data.data;
    },
    ...polling,
  });
}
