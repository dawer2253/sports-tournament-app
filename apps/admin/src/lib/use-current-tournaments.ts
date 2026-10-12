import { useQuery } from '@tanstack/react-query';
import {
  CURRENT_TOURNAMENT_STATUSES,
  SIDEBAR_TOURNAMENTS_LIMIT,
  type AdminShellTournamentList,
} from '@tournament/ui';
import { api } from './api';

/**
 * Klucz listy bieżących turniejów w sidebarze. Leży pod `['tournaments']`,
 * więc każde unieważnienie listy turniejów (założenie, zmiana nazwy, stanu,
 * logo, usunięcie) odświeża też sidebar — bez osobnego wpisu w każdej mutacji.
 */
export const currentTournamentsKey = ['tournaments', 'current'] as const;

/**
 * Bieżące turnieje (szkice i trwające) do sidebaru panelu, w kształcie,
 * którego oczekuje `AdminShell` (#195). Jedna strona od najnowszego, tyle
 * pozycji, ile mieści sidebar; resztę shell zlicza z `meta.total`.
 *
 * Dane przed błędem, jak w `TournamentLayout`: nieudane odświeżenie w tle nie
 * zamienia wczytanej listy w komunikat o błędzie.
 */
export function useCurrentTournaments(): AdminShellTournamentList {
  const query = useQuery({
    queryKey: currentTournamentsKey,
    queryFn: async () => {
      const { data, error } = await api.GET('/tournaments', {
        params: {
          query: { status: [...CURRENT_TOURNAMENT_STATUSES], perPage: SIDEBAR_TOURNAMENTS_LIMIT },
        },
      });
      if (error) throw new Error(error.message);
      return data;
    },
  });

  if (query.data) return { status: 'success', items: query.data.data, total: query.data.meta.total };
  if (query.isError) return { status: 'error', onRetry: () => void query.refetch() };
  return { status: 'pending' };
}
