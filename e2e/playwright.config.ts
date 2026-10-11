import { defineConfig, devices } from '@playwright/test';
import { ADMIN_URL, API_URL, AUTH_FILE, BACKEND_URL, PUBLIC_URL } from './tests/env';

const CI = Boolean(process.env.CI);

/**
 * Adres API podajemy aplikacjom jawnie w środowisku procesu. Vite stawia
 * zmienne, które już istnieją, nad plikami `.env`, więc lokalny `.env`
 * wskazujący mock albo Laravela deweloperskiego nie przekieruje przebiegu
 * (ta sama pułapka co w testach admina, PR #68).
 */
const appEnv = { VITE_API_URL: API_URL, VITE_PUBLIC_URL: PUBLIC_URL };

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: CI,
  // Ponowienie na CI jest po to, żeby był trace (`on-first-retry`), a nie żeby
  // maskować flaki: test zielony dopiero za drugim razem raport oznacza jako „flaky”.
  retries: CI ? 1 : 0,
  workers: CI ? 1 : undefined,
  // Job na CI ma własny `timeout-minutes`, wyższy od tego budżetu.
  globalTimeout: 10 * 60_000,
  // Laravel chodzi na wbudowanym serwerze PHP, więc odpowiedzi bywają wolniejsze
  // niż przy Sailu.
  expect: { timeout: 10_000 },
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: ADMIN_URL,
    trace: 'on-first-retry',
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: AUTH_FILE },
      dependencies: ['setup'],
    },
  ],
  // Bez `reuseExistingServer`: serwer dev postawiony ręcznie celuje w inne API
  // (mock albo baza deweloperska), a przebieg na nim zielenieje bez sprawdzenia
  // czegokolwiek. Zajęty port kończy się więc błędem, a nie cichym podpięciem.
  // Porty 5173 i 5174 są jedynymi, które wpuszcza CORS Laravela.
  webServer: [
    {
      name: 'Laravel',
      command: './scripts/backend.sh',
      url: BACKEND_URL,
      // Lokalnie pierwszy start kontenera i `migrate:fresh --seed` trwają dłużej
      // niż domyślne 60 s.
      timeout: 180_000,
      // Bez sygnału Playwright zabija proces `SIGKILL`-em, a wtedy kontener
      // z `docker compose run` przeżywa przebieg i trzyma port 8001.
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      name: 'Panel',
      command: 'npm run dev -w @tournament/admin -- --strictPort',
      cwd: '..',
      url: ADMIN_URL,
      env: appEnv,
    },
    {
      name: 'Strona publiczna',
      command: 'npm run dev -w @tournament/public -- --strictPort',
      cwd: '..',
      url: PUBLIC_URL,
      env: appEnv,
    },
  ],
});
