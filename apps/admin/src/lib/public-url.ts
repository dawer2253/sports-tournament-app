/**
 * Adres strony publicznej. Bez zmiennej panel celuje w lokalny serwer dev
 * `apps/public`, tak jak `VITE_API_URL` domyślnie celuje w mock.
 */
const publicOrigin = import.meta.env.VITE_PUBLIC_URL ?? 'http://localhost:5174';

/** Strona turnieju pod danym slugiem. Linki podają zapisany slug: wpisany jeszcze nie działa. */
export function publicTournamentUrl(slug: string): string {
  return `${publicOrigin}/t/${slug}`;
}
