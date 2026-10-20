/**
 * Turniej w nagłówku strony publicznej. Podzbiór `PublicTournament`
 * z kontraktu, przepisany ręcznie, bo pakiet UI nie zna klienta API —
 * zgodność pilnuje `apps/public/src/lib/contract-guard.ts`.
 *
 * Typ mieszka osobno od shella, żeby `lib/demo-data.ts` mogło go użyć bez
 * importowania komponentów strony publicznej.
 */
export type PublicShellTournament = {
  name: string
  slug: string
  status: 'active' | 'finished'
  sport: { code: string; name: string }
  branding: { logoUrl: string | null; primaryColor: string }
}

/**
 * Kod sportu z kontraktu (`SportCode`). `PublicShellTournament.sport.code`
 * zostaje stringiem, bo shell ma pokazać także sport spoza tej listy;
 * typ służy kluczom map per sport. Zgodność pilnuje
 * `apps/public/src/lib/contract-guard.ts`.
 */
export type SportCode = 'football' | 'basketball' | 'volleyball'
