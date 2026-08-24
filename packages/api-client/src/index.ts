import createClient, { type Middleware } from 'openapi-fetch';
import type { components, paths } from './schema';

export type { paths, components };

/**
 * Skróty na najczęściej używane kształty z kontraktu. Nie dopisuj tu własnych
 * typów DTO: jeżeli czegoś brakuje, brakuje tego w `openapi.yaml`.
 */
export type Schemas = components['schemas'];

export type User = Schemas['User'];
export type Sport = Schemas['Sport'];
export type SportConfig = Schemas['SportConfig'];
export type Tournament = Schemas['Tournament'];
export type TournamentCreate = Schemas['TournamentCreate'];
export type TournamentUpdate = Schemas['TournamentUpdate'];
export type TournamentFormat = Schemas['TournamentFormat'];
export type TournamentStatus = Schemas['TournamentStatus'];
export type Stage = Schemas['Stage'];
export type StageType = Schemas['StageType'];
export type Group = Schemas['Group'];
export type Team = Schemas['Team'];
export type Player = Schemas['Player'];
export type Venue = Schemas['Venue'];
export type Match = Schemas['Match'];
export type MatchStatus = Schemas['MatchStatus'];
export type StandingTable = Schemas['StandingTable'];
export type StandingRow = Schemas['StandingRow'];
export type StatLeaderboard = Schemas['StatLeaderboard'];
export type TiebreakerCode = Schemas['TiebreakerCode'];
export type PublicTournament = Schemas['PublicTournament'];
export type Branding = Schemas['Branding'];
export type Points = Schemas['Points'];

export type ApiError = Schemas['Error'];
export type ApiValidationError = Schemas['ValidationError'];

export interface ApiClientOptions {
  /** Adres API z prefiksem wersji, np. `http://localhost:8000/api/v1`. */
  baseUrl: string;
  /** Wywoływane przed każdym żądaniem. Zwróć `null`, gdy nikt nie jest zalogowany. */
  getToken?: () => string | null;
  /** Wywoływane, gdy API odpowie 401. Miejsce na wyczyszczenie sesji i przekierowanie na logowanie. */
  onUnauthenticated?: () => void;
}

export function createApiClient({ baseUrl, getToken, onUnauthenticated }: ApiClientOptions) {
  const client = createClient<paths>({ baseUrl });

  const middleware: Middleware = {
    onRequest({ request }) {
      request.headers.set('Accept', 'application/json');
      const token = getToken?.();
      if (token) {
        request.headers.set('Authorization', `Bearer ${token}`);
      }
      return request;
    },
    onResponse({ response }) {
      if (response.status === 401) {
        onUnauthenticated?.();
      }
      return response;
    },
  };

  client.use(middleware);

  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

/**
 * Odróżnia błąd walidacji (422 z mapą pól) od zwykłego błędu z samym `message`.
 * Przydatne przy wpinaniu odpowiedzi w `setError` z react-hook-form.
 */
export function isValidationError(error: unknown): error is ApiValidationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'errors' in error &&
    typeof (error as ApiValidationError).errors === 'object'
  );
}

/** Spłaszcza `{ pole: ["komunikat"] }` do `{ pole: "komunikat" }`. */
export function firstFieldErrors(error: ApiValidationError): Record<string, string> {
  return Object.fromEntries(
    Object.entries(error.errors).map(([field, messages]) => [field, messages[0] ?? '']),
  );
}
