import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { toast } from '@tournament/ui';
import { afterAll, afterEach } from 'vitest';
import { server } from './server';

// Start w zasięgu modułu, a nie w `beforeAll` — dlaczego, tłumaczy `server.ts`.
server.listen({ onUnhandledRequest: 'error' });

// Upload plików (logo, #120): vitest w środowisku jsdom podmienia `FormData`,
// `File` i `Blob` na klasy jsdom, a `fetch` zostaje z Node. Most vitesta między
// nimi gubi nazwę i treść pliku, a `request.formData()` w handlerze msw pada na
// asercji undici. Wracamy więc do klas z Node: aplikacja i testy tworzą wtedy
// to, co `fetch` umie wysłać. `FormData` z Node nie ma eksportu w żadnym module,
// więc bierzemy konstruktor z odpowiedzi, którą parsuje sam Node.
const NodeFormData = (
  await new Response('', { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).formData()
).constructor as typeof FormData;
globalThis.FormData = NodeFormData;
globalThis.File = NodeFile as typeof File;
globalThis.Blob = NodeBlob as typeof Blob;

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
