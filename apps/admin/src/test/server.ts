import { setupServer } from 'msw/node';

const apiUrl = import.meta.env.VITE_API_URL;
if (!apiUrl) {
  throw new Error(
    'Brak VITE_API_URL: testy muszą iść przez vitest.config.ts, który przypina adres mocka.',
  );
}

/** Adres, w który celuje `lib/api.ts`; przypięty w `vitest.config.ts`, nie przepisuj go z ręki. */
export const API_URL = apiUrl;

/**
 * Wspólny serwer msw dla testów panelu.
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
 * niezauważone — dzięki temu „nie poszedł żaden POST" asertuje sam brak
 * handlera.
 */
export const server = setupServer();
