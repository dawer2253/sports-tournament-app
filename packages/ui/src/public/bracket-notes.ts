/**
 * Zdania ekranu Drabinki, które liczą się z danych: notka o rozjeździe
 * drabinki z tabelami grup (#268, #272) i liczba wychodzących w pustym
 * stanie turnieju z grupami. Czyste funkcje, więc strona i stories mówią to
 * samo, a zdanie testuje się bez ekranu.
 */
import { plural, QUALIFY, TEAMS } from '../lib/plural'
import { qualifiersDivergence } from '../lib/qualifiers'

const LIST = new Intl.ListFormat('pl', { type: 'conjunction' })

/** Wiersz tabeli grupy w zdaniu notki: miejsce i drużyna. */
type NoteRow = { position: number; team: { id: number; name: string } }

/** Tabela grupy razem z liczbą wychodzących (`Group.qualifiers`). */
export type DivergenceGroup = { rows: readonly NoteRow[]; qualifiers: number }

/** Nazwy drużyn jako wyliczenie: „Wilki”, „Wilki i Orły”, „Wilki, Orły i Lwy”. */
function teamNames(rows: readonly NoteRow[]) {
  return LIST.format(rows.map((row) => row.team.name))
}

/**
 * Orzeczenie przy wyliczeniu drużyn: liczba pojedyncza dla jednej, mnoga dla
 * kilku („gra Wilki”, „grają Wilki i Orły”) — zgoda z wyliczeniem, a nie
 * z liczebnikiem, więc bez `plural`.
 */
function verb(rows: readonly NoteRow[], one: string, many: string) {
  return rows.length === 1 ? one : many
}

/**
 * Notka nad drzewem, gdy drabinka nie idzie za dzisiejszą tabelą którejś grupy
 * (#268, z wariantu B #252), np. po wyniku grupy wpisanym po wygenerowaniu,
 * po świadomej podmianie przy remisie na linii albo po zmianie liczby
 * wychodzących. Regułę liczy `qualifiersDivergence`, niczego się nie zapisuje,
 * a po ponownym wygenerowaniu drabinki notka znika. Zdanie jest neutralne: kto
 * gra w drabince i kto stoi dziś nad linią, bez oceny i bez przyczyny, bo
 * przyczyny strona nie zna (#272). Bez rozjazdu `null`.
 */
export function divergenceNote(groups: readonly DivergenceGroup[], bracketTeams: ReadonlySet<number>): string | null {
  const clauses = groups.flatMap(({ rows, qualifiers }) => {
    const { plays, missing } = qualifiersDivergence(rows, qualifiers, bracketTeams)
    const play = (list: readonly NoteRow[]) => verb(list, 'gra', 'grają')
    const stand = (list: readonly NoteRow[]) => verb(list, 'stoi', 'stoją')
    if (plays.length && missing.length) {
      return [`w drabince ${play(plays)} ${teamNames(plays)}, a w tabeli grupy nad linią ${stand(missing)} dziś ${teamNames(missing)}`]
    }
    // Człon bez pary zostaje po zmianie liczby wychodzących po wygenerowaniu.
    if (plays.length) return [`w drabince ${play(plays)} ${teamNames(plays)}, choć w tabeli grupy ${stand(plays)} dziś pod linią`]
    if (missing.length) return [`w tabeli grupy nad linią ${stand(missing)} dziś ${teamNames(missing)}, a w drabince nie ${play(missing)}`]
    return []
  })
  return clauses.length === 0 ? null : `Drabinka różni się od dzisiejszych tabel grup: ${clauses.join('; ')}.`
}

/**
 * Ile drużyn wychodzi z grup, z `Group.qualifiers`: „Z każdej grupy wychodzą
 * 2 drużyny.”, przy jednej grupie „Z grupy…”, a przy różnych liczbach suma
 * („Z grup wychodzą łącznie 3 drużyny.”). Bez grup `null`.
 */
export function groupsQualifiersSentence(groups: readonly { qualifiers: number }[]): string | null {
  if (groups.length === 0) return null
  const counts = new Set(groups.map((group) => group.qualifiers))
  const count = (n: number) => `${plural(n, QUALIFY)} ${n} ${plural(n, TEAMS)}`
  if (counts.size === 1) {
    return `Z ${groups.length === 1 ? 'grupy' : 'każdej grupy'} ${count(groups[0]!.qualifiers)}.`
  }
  const total = groups.reduce((sum, group) => sum + group.qualifiers, 0)
  return `Z grup ${plural(total, QUALIFY)} łącznie ${total} ${plural(total, TEAMS)}.`
}
