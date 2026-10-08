import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toast } from '@tournament/ui';
import { afterAll, afterEach } from 'vitest';
import { server } from './server';

// Start w zasięgu modułu, a nie w `beforeAll` — dlaczego, tłumaczy `server.ts`.
server.listen({ onUnhandledRequest: 'error' });

// jsdom nie ma `matchMedia`, a `Toaster` z `sonner` pyta go o motyw systemu przy
// każdym montowaniu i bez niego wywraca test. Zaślepka odpowiada „jasny”.
window.matchMedia = (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
  localStorage.clear();
  // `sonner` trzyma toasty w zasięgu modułu i każdemu nowemu `Toaster` odtwarza
  // te, które jeszcze nie zgasły. Bez tego toast z poprzedniego testu pojawia
  // się w następnym i psuje asercje w rodzaju „toastu nie ma”.
  toast.dismiss();
});

afterAll(() => server.close());
