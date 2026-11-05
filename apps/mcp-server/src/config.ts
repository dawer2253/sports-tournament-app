export interface Config {
  /** Adres API z prefiksem wersji, np. `http://localhost:8000/api/v1`. */
  apiUrl: string;
  /** Adres panelu, np. `http://localhost:5173`; z niego idą linki w odpowiedziach narzędzi. */
  panelUrl: string;
  email: string;
  password: string;
}

const VARIABLES = {
  apiUrl: 'TOURNAMENT_API_URL',
  panelUrl: 'TOURNAMENT_PANEL_URL',
  email: 'TOURNAMENT_EMAIL',
  password: 'TOURNAMENT_PASSWORD',
} as const satisfies Record<keyof Config, string>;

/** Czyta konfigurację ze zmiennych środowiskowych. Brak którejkolwiek rzuca błąd z ich listą. */
export function readConfig(env: NodeJS.ProcessEnv): Config {
  const missing = Object.values(VARIABLES).filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Brakuje zmiennych środowiskowych: ${missing.join(', ')}. ` +
        'Ustaw je w sekcji "env" wpisu serwera w claude_desktop_config.json (patrz docs/MCP-DEMO.md).',
    );
  }
  return {
    apiUrl: env[VARIABLES.apiUrl]!.trim().replace(/\/+$/, ''),
    panelUrl: env[VARIABLES.panelUrl]!.trim().replace(/\/+$/, ''),
    email: env[VARIABLES.email]!.trim(),
    password: env[VARIABLES.password]!,
  };
}
