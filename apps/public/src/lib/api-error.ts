/** Błąd API razem z kodem HTTP: 404 turnieju znaczy co innego niż padnięty serwer. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * 404 to turniej nieznany albo szkic — API nie mówi, który, i ma tak zostać
 * (decyzja #82). Ponawianie niczego tu nie zmieni.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

const NETWORK_FAILED = 'Nie możemy połączyć się z serwerem. Sprawdź internet i spróbuj ponownie.';
const SERVER_FAILED = 'Serwer odpowiedział błędem. Spróbuj ponownie za chwilę.';

/**
 * Komunikat ekranu błędu dla kibica. `error.message` nie nadaje się na ekran:
 * z `fetch` to angielskie „Failed to fetch”, z serwera — tekst techniczny.
 * `ApiError` znaczy, że serwer odpowiedział; każdy inny wyjątek to brak połączenia.
 */
export function loadErrorMessage(error: unknown): string {
  return error instanceof ApiError ? SERVER_FAILED : NETWORK_FAILED;
}
