import { useQuery } from '@tanstack/react-query';
import { POLL_INTERVAL_MS, api } from './api';
import { ApiError, isNotFound } from './api-error';

/**
 * Zapytania strony publicznej. Każde odpytuje co `POLL_INTERVAL_MS`, także
 * w turnieju `finished` (#192): poprawka wyniku po zakończeniu jest możliwa,
 * a bez zmian odpytanie kosztuje puste `304`. `If-None-Match` wysyła sama
 * przeglądarka, z pamięci podręcznej — kod go nie dotyka (ADR-0007).
 *
 * Wyjątkiem jest `404`: turniej nieznany albo szkic nie pojawi się od
 * ponownego pytania, więc odpytywanie staje. Wraca dopiero z nowym
 * wejściem na adres.
 *
 * Klucze leżą pod `['public', slug]`, więc wszystko o jednym turnieju da się
 * unieważnić naraz.
 */
function refetchInterval(query: { state: { error: Error | null } }): number | false {
  return isNotFound(query.state.error) ? false : POLL_INTERVAL_MS;
}

/** Odpowiedź `openapi-fetch`: koperta `{ data }` albo błąd z `message` i kodem. */
async function unwrap<T>(
  request: Promise<{ data?: { data: T }; error?: { message: string }; response: Response }>,
): Promise<T> {
  const { data, error, response } = await request;
  if (error || !data) throw new ApiError(error?.message ?? response.statusText, response.status);
  return data.data;
}

export function usePublicTournament(slug: string) {
  return useQuery({
    queryKey: ['public', slug],
    queryFn: () => unwrap(api.GET('/public/t/{slug}', { params: { path: { slug } } })),
    refetchInterval,
  });
}

export function useStandings(slug: string) {
  return useQuery({
    queryKey: ['public', slug, 'standings'],
    queryFn: () => unwrap(api.GET('/public/t/{slug}/standings', { params: { path: { slug } } })),
    refetchInterval,
  });
}

export function useFixtures(slug: string) {
  return useQuery({
    queryKey: ['public', slug, 'fixtures'],
    queryFn: () => unwrap(api.GET('/public/t/{slug}/fixtures', { params: { path: { slug } } })),
    refetchInterval,
  });
}

export function useResults(slug: string) {
  return useQuery({
    queryKey: ['public', slug, 'results'],
    queryFn: () => unwrap(api.GET('/public/t/{slug}/results', { params: { path: { slug } } })),
    refetchInterval,
  });
}
