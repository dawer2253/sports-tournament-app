import type { Stage } from '@tournament/api-client';
import { HttpResponse, http } from 'msw';
import { API_URL as API } from './server';

/** Faza ligi, jak po założeniu turnieju w formacie `league`. */
export const LEAGUE_STAGE: Stage = { id: 11, type: 'league', name: 'Faza zasadnicza', order: 1, groups: [] };

/** Faza pucharowa, jak po założeniu turnieju w formacie `knockout`. */
export const CUP_STAGE: Stage = { id: 12, type: 'knockout', name: 'Faza pucharowa', order: 1, groups: [] };

/**
 * `GET /tournaments/{id}/stages`. Pyta o nie każdy ekran turnieju, bo
 * nawigacja wyszarza Terminarz w pucharze (#227), więc każdy plik testów
 * ekranu turnieju musi na nie odpowiedzieć, tak jak na `/me`. Domyślnie liga.
 */
export function tournamentStages(stages: Stage[] = [LEAGUE_STAGE]) {
  return http.get(`${API}/tournaments/:id/stages`, () => HttpResponse.json({ data: stages }));
}
