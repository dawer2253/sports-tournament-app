import { Goal } from 'lucide-react'
import { PublicShell } from '../components/layout/public-shell'
import { LiveMarker } from '../components/layout/live-marker'
import { fixtures } from '../lib/demo-data'
import type { Match } from '../lib/demo-data'

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

// Strzelcy ustawieni pod swoją drużyną. Jedna lista sklejona kropkami gubiła
// informację, dla kogo padł gol — układ odtwarza ją bez ani jednego znaku.
function ScorerLists({ match }: { match: Match }) {
  const goals = (match.events ?? []).filter((e) => e.type === 'goal')
  if (goals.length === 0) return null
  const side = (teamId: number) =>
    goals.filter((g) => g.teamId === teamId).map((g) => `${g.playerName} ${g.minute}'`)

  return (
    <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] gap-3 text-xs text-muted-foreground">
      <ul className="space-y-0.5 text-right">
        {side(match.home.id).map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
      <Goal className="size-3.5 shrink-0 justify-self-center text-muted-foreground/60" aria-hidden />
      <ul className="space-y-0.5">
        {side(match.away.id).map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
    </div>
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
      <ScorerLists match={match} />
      {live && (
        <LiveMarker className="mt-1.5 justify-center" />
      )}
    </li>
  )
}

export function PublicResults() {
  const groups = groupByDate(results)

  return (
    <PublicShell active="results">
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
