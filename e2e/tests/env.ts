import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Adresy przebiegu E2E w jednym miejscu: konfiguracja stawia pod nimi serwery,
 * a fixture'y i testy z nich korzystają.
 *
 * Laravel E2E stoi na 8001, obok deweloperskiego na 8000, żeby przebieg nie
 * wymagał zatrzymania Saila. Aplikacje muszą chodzić na 5173 i 5174, bo tylko
 * te porty wpuszcza CORS (`backend/config/cors.php`).
 */
export const BACKEND_URL = 'http://127.0.0.1:8001';
export const API_URL = `${BACKEND_URL}/api/v1`;
export const ADMIN_URL = 'http://localhost:5173';
export const PUBLIC_URL = 'http://localhost:5174';

/** Konto z seeda demo (`DemoTournamentSeeder`), zaseedowane na starcie przebiegu. */
export const ORGANIZER = { email: 'dawid@example.com', password: 'tajnehaslo123' } as const;

/** Klucz, pod którym panel trzyma token (`apps/admin/src/lib/session.ts`). */
export const TOKEN_KEY = 'tournament.token';

/** Stan sesji z projektu `setup`. Katalog jest w `e2e/.gitignore`. */
export const AUTH_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../playwright/.auth/organizer.json',
);
