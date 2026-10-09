import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { ApiError } from './api-error';
import type { ListTexts } from './use-list-mutation';

/**
 * Klucze zapytań drużyn i składów.
 *
 * Lista leży pod `['tournament', id]`, więc unieważnienie turnieju (po
 * `teamsCount`) odświeża ją przy okazji. Drużyna i jej skład leżą celowo poza
 * tym prefiksem: po usunięciu drużyny unieważnia się turniej, a odświeżona
 * drużyna dostałaby `404` (`apps/admin/AGENTS.md`, „Edycja list”).
 *
 * Skład ma własny prefiks, a nie `['team', id, 'players']`: zmiana nazwy
 * unieważnia drużynę i nie ma powodu pobierać przy tym składu od nowa.
 */
export const teamKeys = {
  tournament: (tournamentId: number) => ['tournament', tournamentId] as const,
  list: (tournamentId: number) => ['tournament', tournamentId, 'teams'] as const,
  team: (teamId: number) => ['team', teamId] as const,
  players: (teamId: number) => ['players', teamId] as const,
};

export const TEAM_TEXTS: ListTexts = {
  accusative: 'drużynę',
  alreadyDeleted: 'Drużyna została już usunięta.',
  gone: 'Tej drużyny już nie ma.',
};

export const PLAYER_TEXTS: ListTexts = {
  accusative: 'zawodnika',
  alreadyDeleted: 'Zawodnik został już usunięty.',
  gone: 'Tego zawodnika już nie ma.',
};

export function useTeams(tournamentId: number) {
  return useQuery({
    queryKey: teamKeys.list(tournamentId),
    queryFn: async () => {
      const { data, error } = await api.GET('/tournaments/{tournament}/teams', {
        params: { path: { tournament: tournamentId } },
      });
      if (error) throw new Error(error.message);
      return data.data;
    },
  });
}

/** Drużyna z adresu; `teamId` równe `null` (nieprawidłowe id) nie idzie do API. */
export function useTeam(teamId: number | null) {
  return useQuery({
    queryKey: teamKeys.team(teamId ?? 0),
    enabled: teamId !== null,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/teams/{team}', {
        params: { path: { team: teamId! } },
      });
      if (error) throw new ApiError(error.message, response.status);
      return data.data;
    },
  });
}

/**
 * Skład idzie równolegle z drużyną, a nie po niej: link bezpośredni do składu
 * nie czeka wtedy na dwa żądania po kolei.
 */
export function usePlayers(teamId: number | null) {
  return useQuery({
    queryKey: teamKeys.players(teamId ?? 0),
    enabled: teamId !== null,
    queryFn: async () => {
      const { data, error, response } = await api.GET('/teams/{team}/players', {
        params: { path: { team: teamId! } },
      });
      if (error) throw new ApiError(error.message, response.status);
      return data.data;
    },
  });
}
