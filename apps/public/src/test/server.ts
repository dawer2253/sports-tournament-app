import { setupServer } from 'msw/node';

/**
 * Adres, w który celuje `lib/api.ts`. Nie przepisujemy go z ręki: `vitest.config.ts`
 * przypina `VITE_API_URL` na czas testów, więc handlery i klient zawsze mówią
 * o tym samym hoście — także u kogoś, kto ma lokalny `.env` wskazujący Laravela.
 */
export const API_URL = import.meta.env.VITE_API_URL;

/**
 * Wspólny serwer msw dla testów strony publicznej.
 *
 * Startuje w zasięgu modułu `setup.ts`, a nie w `beforeAll`, i to nie jest
 * kosmetyka: `openapi-fetch` zapamiętuje `globalThis.fetch` w chwili tworzenia
 * klienta, czyli przy imporcie `lib/api.ts`. Setup vitesta wykonuje się przed
 * importem modułu testowego, ale hooki — już po nim, więc `listen()` w
 * `beforeAll` spóźnia się o tyle, że klient złapał niepodmienione `fetch`.
 * Objaw: ciche `TypeError: fetch failed`.
 *
 * Handlery dokłada każdy test przez `server.use(...)`; domyślnych nie ma,
 * a `onUnhandledRequest: 'error'` pilnuje, żeby żadne żądanie nie przeszło
 * niezauważone — dzięki temu „nie poszło żadne żądanie" asertuje sam brak
 * handlera.
 */
export const server = setupServer();
