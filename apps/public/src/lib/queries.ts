import { useQuery } from '@tanstack/react-query';
import { POLL_INTERVAL_MS, api } from './api';
import { ApiError, isNotFound } from './api-error';

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

function usePublicQuery<T>(queryKey: readonly unknown[], queryFn: () => Promise<T>) {
  return useQuery({ queryKey, queryFn, refetchInterval: POLL_INTERVAL_MS });
}

const path = (slug: string) => ({ params: { path: { slug } } });

/**
 * Turniej albo `null`, gdy go nie ma (`404`: nieznany slug albo szkic, #82).
 * „Nie ma” to odpowiedź, nie błąd: zapytanie z błędem i bez danych TanStack
 * Query przy każdym odpytaniu cofa do `pending`, więc ekran 404 mrugałby
 * szkieletem co `POLL_INTERVAL_MS`. Odpytywanie trwa, a opublikowany szkic
 * pojawia się sam.
 */
export const usePublicTournament = (slug: string) =>
  usePublicQuery(['public', slug], () =>
    unwrap(api.GET('/public/t/{slug}', path(slug))).catch((error: unknown) => {
      if (isNotFound(error)) return null;
      throw error;
    }),
  );

export const useStandings = (slug: string) =>
  usePublicQuery(['public', slug, 'standings'], () => unwrap(api.GET('/public/t/{slug}/standings', path(slug))));

export const useFixtures = (slug: string) =>
  usePublicQuery(['public', slug, 'fixtures'], () => unwrap(api.GET('/public/t/{slug}/fixtures', path(slug))));

export const useResults = (slug: string) =>
  usePublicQuery(['public', slug, 'results'], () => unwrap(api.GET('/public/t/{slug}/results', path(slug))));

/**
 * Klasyfikacja według `stat`, a bez niego według pierwszej statystyki sportu
 * — wtedy żądanie idzie bez parametru i domyślną wybiera serwer (#190).
 */
export const useLeaderboard = (slug: string, stat?: string) =>
  usePublicQuery(['public', slug, 'leaderboard', stat ?? null], () =>
    unwrap(
      api.GET('/public/t/{slug}/leaderboard', {
        params: { path: { slug }, query: stat ? { stat } : {} },
      }),
    ),
  );
