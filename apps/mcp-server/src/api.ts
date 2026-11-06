import { type ApiClient, type ApiError, createApiClient, isValidationError } from '@tournament/api-client';
import type { Config } from './config.ts';

/**
 * Błąd, który narzędzie oddaje agentowi jako `isError: true` z samym tekstem.
 * Wszystko, co agent ma zobaczyć, musi siedzieć w `message`.
 */
export class ToolFailure extends Error {}

interface ApiResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/**
 * Klient z kontraktu z tokenem organizatora trzymanym w pamięci procesu.
 * Loguje się przez `POST /login` danymi ze zmiennych środowiskowych.
 */
export function createSession(config: Config) {
  let token: string | null = null;
  const client = createApiClient({ baseUrl: config.apiUrl, getToken: () => token });

  /** `fetch` odrzuca obietnicę `TypeError`-em, gdy nikt nie słucha pod adresem (np. Sail nie stoi). */
  async function reach<R>(send: () => Promise<R>): Promise<R> {
    try {
      return await send();
    } catch (error) {
      if (error instanceof TypeError) {
        throw new ToolFailure(
          `Backend nie odpowiada pod ${config.apiUrl} (TOURNAMENT_API_URL). ` +
            'Sprawdź, czy Laravel na Sailu stoi (make up) i czy adres ma prefiks /api/v1.',
        );
      }
      throw error;
    }
  }

  async function login(): Promise<void> {
    token = null;
    const { data, error, response } = await reach(() =>
      client.POST('/login', { body: { email: config.email, password: config.password } }),
    );
    if (!data) {
      throw new ToolFailure(
        `Logowanie organizatora (${config.email}) nie powiodło się. ${describeError(response.status, error)}`,
      );
    }
    token = data.data.token;
  }

  /**
   * Wysyła żądanie jako zalogowany organizer. Na `401` loguje się raz jeszcze
   * i powtarza żądanie jeden raz; drugi `401` jest już błędem narzędzia.
   */
  async function request<R extends ApiResult<unknown>>(send: (client: ApiClient) => Promise<R>): Promise<R> {
    if (token === null) {
      await login();
    }
    const first = await reach(() => send(client));
    if (first.response.status !== 401) {
      return first;
    }

    await login();
    const second = await reach(() => send(client));
    if (second.response.status === 401) {
      throw new ToolFailure(
        `API odpowiedziało 401 także po ponownym zalogowaniu jako ${config.email}. Sprawdź konto organizatora w seedzie.`,
      );
    }
    return second;
  }

  return { login, request };
}

export type Session = ReturnType<typeof createSession>;

/** Wyciąga `data` z udanej odpowiedzi, a każdą inną zamienia na `ToolFailure`. */
export function unwrap<T>(result: ApiResult<T>): T {
  if (result.data === undefined) {
    throw new ToolFailure(describeError(result.response.status, result.error));
  }
  return result.data;
}

/**
 * Treść błędu API dla agenta. `422` idzie bez zmian: komunikat i błędy pól,
 * bo to backend waliduje, a agent ma z tego poprawić wywołanie.
 */
export function describeError(status: number, error: unknown): string {
  if (status === 422 && isValidationError(error)) {
    const fields = Object.entries(error.errors).map(([field, messages]) => `- ${field}: ${messages.join(' ')}`);
    return [`API odrzuciło dane (422): ${error.message}`, ...fields].join('\n');
  }
  const message = (error as Partial<ApiError> | undefined)?.message ?? 'bez komunikatu';
  return `API odpowiedziało ${status}: ${message}`;
}
