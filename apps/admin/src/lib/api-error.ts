/** Błąd API razem z kodem HTTP: 403 i 404 znaczą co innego niż padnięty serwer. */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * 403 to cudzy byt: organizer nie dowie się z panelu, czy taki istnieje, więc
 * 403 i 404 wyglądają tak samo, jako stan „nie ma”. Ponawianie niczego tu nie zmieni.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}
