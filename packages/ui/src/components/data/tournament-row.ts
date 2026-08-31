/**
 * Wiersz listy turniejów. Podzbiór `Tournament` z kontraktu: pakiet UI nie zna
 * klienta API, więc bierze dokładnie te pola, które pokazuje.
 *
 * Typ mieszka w osobnym pliku, żeby `lib/demo-data.ts` mogło go użyć bez
 * importowania komponentu — inaczej dane demo i tabela zamykają się w cyklu.
 * Zgodność z kontraktem pilnuje `apps/admin/src/lib/contract-guard.ts`.
 */
export type TournamentRow = {
  id: number
  name: string
  slug: string
  status: 'draft' | 'active' | 'finished'
  sport: { name: string }
  teamsCount: number
}
