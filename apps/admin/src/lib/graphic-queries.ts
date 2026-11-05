import { useQueries, useQuery } from '@tanstack/react-query';
import type { AdminMatch } from '@tournament/api-client';
import { api } from './api';
import { ApiError } from './api-error';

/** Największa strona listy meczów w kontrakcie. */
const PER_PAGE = 200;

/**
 * Wszystkie mecze turnieju, ze wszystkich faz, strona po stronie — zapowiedź
 * i wynik wybierają z całego turnieju (#322). Klucz leży pod
 * `['tournament', id, 'matches']`, więc odświeża się razem z terminarzem,
 * a `'all'` nie zderza się z meczami jednej fazy (`scheduleKeys.matches`).
 */
export function useTournamentMatches(tournamentId: number) {
  return useQuery({
    queryKey: ['tournament', tournamentId, 'matches', 'all'],
    queryFn: async () => {
      const matches: AdminMatch[] = [];
      let page = 1;
      let lastPage = 1;
      do {
        const { data, error, response } = await api.GET('/tournaments/{tournament}/matches', {
          params: { path: { tournament: tournamentId }, query: { perPage: PER_PAGE, page } },
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

/**
 * Klasyfikacja panelu w domyślnej statystyce sportu (bez `stat`, #322 pkt 2),
 * także dla szkicu (#333).
 */
export function useLeaderboard(tournamentId: number) {
  return useQuery({
    queryKey: ['tournament', tournamentId, 'leaderboard'],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/tournaments/{tournament}/leaderboard', {
        params: { path: { tournament: tournamentId } },
      });
      if (error) throw new ApiError(error.message, response.status);
      return data.data;
    },
  });
}

/** Obraz, który grafika ma narysować: logo turnieju albo herb drużyny. */
export interface LogoSource {
  owner: 'tournament' | 'team';
  id: number;
  /** `logoUrl` z API: tylko znak, że plik istnieje, i klucz cache'u (zmienia się z uploadem). */
  logoUrl: string | null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchLogo({ owner, id }: LogoSource): Promise<string | null> {
  try {
    const { data, response } =
      owner === 'tournament'
        ? await api.GET('/tournaments/{tournament}/logo', { params: { path: { tournament: id } }, parseAs: 'blob' })
        : await api.GET('/teams/{team}/logo', { params: { path: { team: id } }, parseAs: 'blob' });
    return response.ok && data ? await blobToDataUrl(data as Blob) : null;
  } catch {
    return null;
  }
}

const logoKey = (source: LogoSource) => `${source.owner}:${source.id}`;

/**
 * Herby i logo do grafiki jako adresy `data:` (#333). `logoUrl` wskazuje plik
 * na innym originie i bez CORS, więc PNG by go nie narysował; panel pobiera
 * plik przez `GET …/logo` z tokenem. Pyta tylko o obrazy, które istnieją
 * (`logoUrl` nie jest `null`), a błąd pobrania daje `null`, czyli herb
 * zastępczy. `ready` mówi, że wszystkie odpowiedzi już są, więc eksport
 * nie złapie herbu zastępczego zamiast pliku, który właśnie dochodzi.
 */
export function useLogoDataUrls(sources: readonly LogoSource[]) {
  const withFile = sources.filter((source) => source.logoUrl !== null);
  const results = useQueries({
    queries: withFile.map((source) => ({
      queryKey: ['logo', source.owner, source.id, source.logoUrl],
      queryFn: () => fetchLogo(source),
      staleTime: Infinity,
    })),
  });
  const urls = new Map<string, string | null>(withFile.map((source, index) => [logoKey(source), results[index]?.data ?? null]));
  return {
    ready: results.every((result) => !result.isPending),
    /** Adres `data:` albo `null` (brak pliku, błąd albo jeszcze w drodze). */
    url: (source: Pick<LogoSource, 'owner' | 'id'>) => urls.get(logoKey(source as LogoSource)) ?? null,
  };
}
