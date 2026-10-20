/**
 * Zgłoszenie drużyny w panelu (#300). Podzbiór `TeamRegistration`
 * z kontraktu: pakiet UI nie zna klienta API, więc bierze dokładnie te pola,
 * które pokazuje. Zgodność pilnuje `apps/admin/src/lib/contract-guard.ts`.
 *
 * Typ mieszka w osobnym pliku, żeby `lib/demo-data.ts` mogło go użyć bez
 * importowania komponentu.
 */
export type RegistrationRow = {
  id: number
  teamName: string
  status: 'pending' | 'accepted' | 'rejected'
  /** `null` w zgłoszeniu odrzuconym: odrzucenie usuwa dane osobowe. */
  contact: { name: string; email: string; phone: string | null } | null
  players: readonly { name: string; number: number | null }[]
  createdAt: string
  decidedAt: string | null
}
