import { Badge } from '@/components/ui/badge'
import { PublicShell } from '@/components/layout/public-shell'
import { fixtures } from '@/lib/demo-data'
import type { Match } from '@/lib/demo-data'

// Tylko mecze rozegrane lub trwające, najnowsze u góry.
const results = fixtures.filter((m) => m.status === 'finished' || m.status === 'live')

// Grupowanie po dacie z zachowaniem kolejności wystąpienia.
function groupByDate(matches: Match[]): { date: string; matches: Match[] }[] {
  const groups: { date: string; matches: Match[] }[] = []
  for (const m of matches) {
    const existing = groups.find((g) => g.date === m.date)
    if (existing) existing.matches.push(m)
    else groups.push({ date: m.date, matches: [m] })
  }
  return groups
}

function ScorerLine({ match }: { match: Match }) {
  const goals = (match.events ?? []).filter((e) => e.type === 'goal')
  if (goals.length === 0) return null
  return (
    <p className="mt-1 text-center text-xs text-muted-foreground">
      {goals.map((g, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {g.playerName} {g.minute}&apos;
        </span>
      ))}
    </p>
  )
}

function ResultRow({ match }: { match: Match }) {
  const live = match.status === 'live'
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex-1 text-right font-medium">{match.home.name}</span>
        <span className="rounded-md bg-foreground px-2.5 py-1 text-sm font-bold tabular-nums text-background">
          {match.homeScore ?? 0} : {match.awayScore ?? 0}
        </span>
        <span className="flex-1 font-medium">{match.away.name}</span>
      </div>
      <ScorerLine match={match} />
      {live && (
        <div className="mt-1.5 flex justify-center">
          <Badge variant="destructive" className="gap-1">
            <span className="size-2 animate-pulse rounded-full bg-destructive" /> Na żywo
          </Badge>
        </div>
      )}
    </li>
  )
}

export function PublicResults() {
  const groups = groupByDate(results)
  const hasLive = results.some((m) => m.status === 'live')

  return (
    <PublicShell active="results" live={hasLive}>
      {groups.length === 0 ? (
        <div className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground shadow-sm">
          Brak rozegranych meczów.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <section key={group.date}>
              <h2 className="mb-2 text-sm text-muted-foreground">{group.date}</h2>
              <ul className="divide-y rounded-xl border bg-card shadow-sm">
                {group.matches.map((m) => (
                  <ResultRow key={m.id} match={m} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PublicShell>
  )
}
