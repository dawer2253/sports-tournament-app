/**
 * Kolejka na liście kolejek terminarza. Kontrakt nie ma listy kolejek (#162,
 * pkt 14): panel składa ten kształt sam z meczów fazy, więc nie ma tu
 * strażnika w `contract-guard.ts`.
 *
 * Typ mieszka osobno z tego samego powodu co `TournamentRow`: żeby
 * `lib/demo-data.ts` mogło go użyć bez importowania komponentu.
 */
export type RoundSummary = {
  id: number
  name: string
  /** Zakres dat gotowy do wyświetlenia, z `formatRoundDates`. */
  dates: string
  /** Mecze `finished` w kolejce. */
  finished: number
  /** Wszystkie mecze kolejki. Kolejka bez meczów nie trafia na listę. */
  total: number
  /** Mecze z kolizją; slot na licznik stoi zawsze, wypełni go #175. */
  collisions?: number
}
