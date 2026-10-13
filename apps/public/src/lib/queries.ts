import { useQuery } from '@tanstack/react-query';
import { POLL_INTERVAL_MS, api } from './api';
import { ApiError } from './api-error';

/**
 * Zapytania strony publicznej. Każde odpytuje co `POLL_INTERVAL_MS` (#192),
 * także w turnieju `finished` i po `404`: poprawka wyniku po zakończeniu jest
 * możliwa, szkic może zostać opublikowany, a bez zmian odpytanie kosztuje
 * puste `304`. `If-None-Match` wysyła sama przeglądarka, z pamięci
 * podręcznej — kod go nie dotyka (ADR-0007).
 *
 * Klucze leżą pod `['public', slug]`, więc wszystko o jednym turnieju da się
 * unieważnić naraz.
 */

/** Odpowiedź `openapi-fetch`: koperta `{ data }` albo błąd z `message` i kodem. */
type Envelope<T> = { data?: { data: T }; error?: { message: string }; response: Response };

async function unwrap<T>(request: Promise<Envelope<T>>): Promise<T> {
  const { data, error, response } = await request;
  if (error || !data) throw new ApiError(error?.message ?? response.statusText, response.status);
  return data.data;
}

function usePublicQuery<T>(queryKey: readonly unknown[], request: () => Promise<Envelope<T>>) {
  return useQuery({ queryKey, queryFn: () => unwrap(request()), refetchInterval: POLL_INTERVAL_MS });
}

const path = (slug: string) => ({ params: { path: { slug } } });

export const usePublicTournament = (slug: string) =>
  usePublicQuery(['public', slug], () => api.GET('/public/t/{slug}', path(slug)));

export const useStandings = (slug: string) =>
  usePublicQuery(['public', slug, 'standings'], () => api.GET('/public/t/{slug}/standings', path(slug)));

export const useFixtures = (slug: string) =>
  usePublicQuery(['public', slug, 'fixtures'], () => api.GET('/public/t/{slug}/fixtures', path(slug)));

export const useResults = (slug: string) =>
  usePublicQuery(['public', slug, 'results'], () => api.GET('/public/t/{slug}/results', path(slug)));
