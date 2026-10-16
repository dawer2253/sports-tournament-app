/** Drużyna turnieju, z jaką pracuje skład grup: id i nazwa do wyświetlenia. */
export interface GroupCompositionTeam {
  id: number
  name: string
}

/**
 * Grupa szkicu składu: nazwa, liczba wychodzących i drużyny. Kształt `Group`
 * z kontraktu bez `id`/`order` — te nadaje zapis (`PUT /stages/{stage}/groups`).
 */
export interface GroupCompositionGroup {
  name: string
  qualifiers: number
  teamIds: number[]
}

/** Litera grupy: „A", „B"…; dalej niż alfabet wraca numer. */
export function groupLetter(index: number): string {
  return 'ABCDEFGH'[index] ?? String(index + 1)
}

/** Fisher–Yates na kopii; `random` jak `Math.random`, wstrzykiwalne w testach. */
export function shuffled<T>(list: readonly T[], random: () => number): T[] {
  const next = [...list]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[next[i], next[j]] = [next[j]!, next[i]!]
  }
  return next
}

/**
 * Losowanie do `count` grup: wymieszane drużyny idą po kolei (`index % count`),
 * więc grupy napełniają się równo i żadna nie zostaje pusta, dopóki drużyn
 * wystarcza. Nazwy i liczby wychodzących pierwszych `count` grup zostają, nowe
 * dostają „Grupa A/B/C…" i 2 — tak zmiana liczby grup i „Losuj" nie gubią tego,
 * co organizer już ustawił.
 */
export function dealGroups(
  teams: readonly GroupCompositionTeam[],
  current: readonly GroupCompositionGroup[],
  count: number,
  random: () => number,
): GroupCompositionGroup[] {
  const shells = Array.from({ length: count }, (_, index) => ({
    name: current[index]?.name ?? `Grupa ${groupLetter(index)}`,
    qualifiers: current[index]?.qualifiers ?? 2,
    teamIds: [] as number[],
  }))
  shuffled(teams, random).forEach((team, index) => {
    shells[index % count]!.teamIds.push(team.id)
  })
  return shells
}

/**
 * Walidacja szkicu przed zapisem, w kolejności reguł kontraktu
 * (`PUT /stages/{stage}/groups`): każda drużyna turnieju dokładnie raz, co
 * najmniej dwie na grupę, nazwy rozłączne, `qualifiers` między 1 a liczebnością
 * grupy, a suma wychodzących co najmniej 2. Zwraca pierwszy komunikat odmowy
 * albo nic, gdy szkic da się zapisać. Komunikat 422 z backendu to osobna droga
 * (props `error`).
 */
export function groupCompositionError(
  value: readonly GroupCompositionGroup[],
  teams: readonly GroupCompositionTeam[],
): string | undefined {
  if (value.length === 0) return 'Faza grupowa potrzebuje co najmniej jednej grupy.'
  if (value.some((group) => group.teamIds.length < 2)) return 'Grupa potrzebuje co najmniej dwóch drużyn.'

  const known = new Set(teams.map((team) => team.id))
  const seen = new Set<number>()
  for (const group of value) {
    for (const id of group.teamIds) {
      if (!known.has(id) || seen.has(id)) return 'Skład musi zawierać każdą drużynę turnieju dokładnie raz.'
      seen.add(id)
    }
  }
  if (seen.size !== known.size) return 'Skład musi zawierać każdą drużynę turnieju dokładnie raz.'

  const names = new Set(value.map((group) => group.name))
  if (names.size !== value.length) return 'Nazwy grup w fazie nie mogą się powtarzać.'

  if (value.some((group) => group.qualifiers > group.teamIds.length)) {
    return 'Z grupy nie może wyjść więcej drużyn, niż w niej gra.'
  }
  if (value.reduce((sum, group) => sum + group.qualifiers, 0) < 2) {
    return 'Z grup muszą wyjść co najmniej dwie drużyny.'
  }

  return undefined
}
