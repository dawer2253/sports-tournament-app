/**
 * Wiersz składu drużyny. Podzbiór `Player` z kontraktu, z tego samego powodu
 * co `TeamRow`.
 */
export type PlayerRow = {
  id: number
  name: string
  number: number | null
  position: string | null
}
