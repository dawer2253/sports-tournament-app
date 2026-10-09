/**
 * Wiersz listy obiektów. Podzbiór `Venue` z kontraktu, z tego samego powodu
 * co `TeamRow`. Bez liczby meczów: kontrakt jej nie ma (#90).
 */
export type VenueRow = {
  id: number
  name: string
  address: string | null
}
