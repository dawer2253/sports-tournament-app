import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach } from 'vitest';
import { server } from './server';

// Start w zasięgu modułu, a nie w `beforeAll`: hooki odpalają się dopiero po
// zaimportowaniu pliku testowego, a wtedy `lib/api.ts` zdążył już utworzyć
// klienta i zapamiętać niepodmienione `fetch` (patrz komentarz w `server.ts`).
// `error` zamiast `warn`: żądanie bez handlera ma wywalić test, a nie wyjść
// w logu — dzięki temu „nie poszedł żaden POST" asertuje sam brak handlera.
server.listen({ onUnhandledRequest: 'error' });

afterEach(() => {
  server.resetHandlers();
  cleanup();
  localStorage.clear();
});

afterAll(() => server.close());
