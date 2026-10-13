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
