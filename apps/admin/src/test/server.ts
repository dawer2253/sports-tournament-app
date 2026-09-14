import { setupServer } from 'msw/node';

/** Adres, w który celuje `lib/api.ts`, gdy nie ma `VITE_API_URL` (mock kontraktu). */
export const API_URL = 'http://127.0.0.1:4010';

/**
 * Wspólny serwer msw dla testów panelu.
 *
 * Startuje w `setup.ts`, a nie w pliku testu, i to nie jest kosmetyka:
 * `openapi-fetch` zapamiętuje `globalThis.fetch` w chwili tworzenia klienta,
 * czyli przy imporcie `lib/api.ts`. Setup vitesta wykonuje się przed importem
 * modułu testowego, więc dopiero tam `server.listen()` zdąży podmienić `fetch`,
 * zanim klient go złapie. Przeniesienie tego do `beforeAll` w teście kończy się
 * cichym „fetch failed".
 *
 * Handlery dokłada każdy test przez `server.use(...)`; domyślnych nie ma, żeby
 * żadne żądanie nie przechodziło niezauważone.
 */
export const server = setupServer();
