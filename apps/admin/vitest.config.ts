import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Osobno od `vite.config.ts`: testy nie potrzebują Tailwinda ani serwera dev,
// a wciągnięcie pluginu CSS do jsdom-a tylko spowalnia uruchomienie.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Vitest czyta `.env` przez Vite, a `AGENTS.md` każe tam wpisać adres Laravela,
    // żeby przełączyć aplikację z mocka. Bez przypięcia klient strzelałby pod inny
    // host niż handlery msw i `onUnhandledRequest: 'error'` wywalałby cały zestaw.
    env: { VITE_API_URL: 'http://127.0.0.1:4010' },
  },
});
