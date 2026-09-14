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
  },
});
