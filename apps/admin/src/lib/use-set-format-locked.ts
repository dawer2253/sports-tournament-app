import { useQuery } from '@tanstack/react-query';
import { ApiError } from './api-error';
import { api } from './api';
import { scheduleKeys } from './schedule-queries';

/** Najwięcej meczów na stronie listy w kontrakcie. */
const PER_PAGE = 200;

/**
 * Czy format seta turnieju jest już zamknięty (#301, ADR-0012): czy któryś
 * mecz ma wpisany set. Serwer odrzuca wtedy zmianę formatu, a ustawienia
 * wyłączają jego pola z tym samym zdaniem.
 *
 * Mecz zakończony zawsze ma sety, więc wystarcza jeden mecz `finished`
 * (`perPage: 1`, liczy `meta.total`). Bez niego zostają mecze trwające, a te
 * mogą mieć listę setów jeszcze pustą, więc sprawdzamy ich `sets`. Mecz
 * zaplanowany setów nie ma. Klucz leży pod meczami turnieju, więc zapis meczu
 * (który unieważnia `scheduleKeys.matches`) odświeża także to.
 */
export function useSetFormatLocked(tournamentId: number, enabled: boolean) {
  return useQuery({
    queryKey: [...scheduleKeys.matches(tournamentId), 'set-format-locked'],
    enabled,
    queryFn: async () => {
      const finished = await api.GET('/tournaments/{tournament}/matches', {
        params: { path: { tournament: tournamentId }, query: { status: 'finished', perPage: 1 } },
      });
      if (finished.error) throw new ApiError(finished.error.message, finished.response.status);
      if (finished.data.meta.total > 0) return true;

      const live = await api.GET('/tournaments/{tournament}/matches', {
        params: { path: { tournament: tournamentId }, query: { status: 'live', perPage: PER_PAGE } },
      });
      if (live.error) throw new ApiError(live.error.message, live.response.status);
      return live.data.data.some((match) => (match.sets?.length ?? 0) > 0);
    },
  });
}
