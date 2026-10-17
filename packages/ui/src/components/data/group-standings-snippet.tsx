import { plural, QUALIFY } from '../../lib/plural'
import { withQualifiers } from '../../lib/qualifiers'
import { cn } from '../../lib/utils'
import type { GroupStandings } from './group-standings'

export type { GroupStandings }

const NUMBER = 'w-9 px-1 py-1.5 text-center tabular-nums'

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Różnica ze znakiem: „+3”, „0”, „-2”. */
function signed(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

/**
 * Skrót tabeli jednej grupy na Przeglądzie (#268, wariant A z #252): miejsce,
 * nazwa, mecze, różnica i punkty, z linią wyjścia po `qualifiers` miejscach
 * (`withQualifiers`) i zdaniem „Wychodzą 2 z 4” pod tabelą. Nazwa drużyny jest
 * zawsze cała i łamie się do drugiej linii zamiast wielokropka — ustalenie
 * #252 dla tabel grup.
 *
 * Kolejności nie poprawia: rozstrzygają ją kryteria turnieju po stronie API.
 */
export function GroupStandingsSnippet({ group }: { group: GroupStandings }) {
  const rows = withQualifiers(group.rows, group.qualifiers)
  const lineAfter = (index: number) => rows[index]!.qualifies && rows[index + 1]?.qualifies === false

  return (
    <section aria-label={group.name} className="min-w-0 space-y-2">
      <p className="text-sm font-semibold">{group.name}</p>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className={cn(NUMBER, 'pl-3 font-medium')}>
                <abbr title="Miejsce" className="no-underline">#</abbr>
              </th>
              <th scope="col" className="px-1 py-1.5 text-left font-medium">Drużyna</th>
              <th scope="col" className={cn(NUMBER, 'font-medium')}>
                <abbr title="Mecze" className="no-underline">M</abbr>
              </th>
              <th scope="col" className={cn(NUMBER, 'font-medium')}>
                <abbr title="Różnica" className="no-underline">+/-</abbr>
              </th>
              <th scope="col" className={cn(NUMBER, 'pr-3 font-bold text-foreground')}>Pkt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.team.id}
                data-qualifies={row.qualifies || undefined}
                className={cn(
                  'border-t',
                  row.qualifies && 'bg-primary/5',
                  lineAfter(index) && 'border-b-2 border-dashed border-b-border',
                )}
              >
                <td className={cn(NUMBER, 'pl-3 font-semibold text-muted-foreground')}>
                  {row.position}
                  {row.qualifies && <span className="sr-only">, wychodzi z grupy</span>}
                </td>
                <td className="px-1 py-1.5 font-medium wrap-break-word">{row.team.name}</td>
                <td className={NUMBER}>{row.played}</td>
                <td className={NUMBER}>{signed(row.scoreDifference)}</td>
                <td className={cn(NUMBER, 'pr-3 font-bold')}>{row.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {capitalize(plural(group.qualifiers, QUALIFY))} {group.qualifiers} z {rows.length}
      </p>
    </section>
  )
}
