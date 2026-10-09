/**
 * Wiersz listy drużyn. Podzbiór `Team` z kontraktu: pakiet UI nie zna klienta
 * API, więc bierze dokładnie te pola, które pokazuje.
 *
 * Typ mieszka w osobnym pliku z tego samego powodu co `TournamentRow`: żeby
 * `lib/demo-data.ts` mogło go użyć bez importowania komponentu.
 */
export type TeamRow = {
  id: number
  name: string
  logoUrl: string | null
  playersCount: number
}
