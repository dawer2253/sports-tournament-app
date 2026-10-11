/**
 * Wiersz listy obiektów. Podzbiór `Venue` z kontraktu, z tego samego powodu
 * co `TeamRow`. Bez liczby meczów `scheduled`: tabela jej nie pokazuje (#90),
 * a okno usuwania w panelu bierze ją z całego `Venue` (#171).
 */
export type VenueRow = {
  id: number
  name: string
  address: string | null
}
