import { HttpResponse, http } from 'msw';
import { API_URL as API } from './server';

/**
 * Czy to żądanie listy bieżących z sidebaru panelu (z `status`), a nie listy
 * wszystkich turniejów z ekranu `/` (bez filtra). Obie idą pod ten sam adres.
 */
export function isCurrentTournamentsRequest(request: Request): boolean {
  return new URL(request.url).searchParams.has('status');
}

/**
 * `GET /tournaments?status=draft,active&perPage=8` z sidebaru (#195). Wysyła
 * je każdy ekran panelu, więc każdy plik testów ekranu musi na nie odpowiedzieć,
 * tak jak na `/me`. Domyślnie pustą listą: dane sidebaru nie mieszają się
 * wtedy z treścią ekranu.
 *
 * Filtruje i stronicuje jak backend, więc podana lista może zawierać też
 * zakończone. Kształt turnieju jest na wiarę testu, jak w reszcie handlerów.
 * Funkcja zamiast tablicy daje stan „serwera" czytany przy każdym
 * żądaniu. Żądanie bez `status` (lista z `/`) idzie dalej, do następnego
 * handlera — dlatego handler listy z `/` buduj przez `allTournaments`.
 */
export function currentTournaments<T extends { status: string }>(source: T[] | (() => T[]) = []) {
  return http.get(`${API}/tournaments`, ({ request }) => {
    if (!isCurrentTournamentsRequest(request)) return undefined;
    const url = new URL(request.url);
    const statuses = url.searchParams.get('status')!.split(',');
    const perPage = Number(url.searchParams.get('perPage') ?? 20);
    const all = typeof source === 'function' ? source() : source;
    const matching = all.filter(({ status }) => statuses.includes(status));
    return HttpResponse.json({
      data: matching.slice(0, perPage),
      meta: {
        currentPage: 1,
        lastPage: Math.max(1, Math.ceil(matching.length / perPage)),
        perPage,
        total: matching.length,
      },
    });
  });
}

/**
 * Handler listy z ekranu `/`, który przepuszcza żądanie sidebaru. Handler
 * dołożony w teście ma pierwszeństwo przed tym z `beforeEach`, więc zwykłe
 * `http.get('/tournaments')` odpowiadałoby też sidebarowi i dublowało treść.
 */
export function allTournaments(respond: () => Response | Promise<Response>) {
  return http.get(`${API}/tournaments`, ({ request }) =>
    isCurrentTournamentsRequest(request) ? undefined : respond(),
  );
}
