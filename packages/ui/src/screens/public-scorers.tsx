import { Goal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { PublicShell } from '@/components/layout/public-shell'
import { scorers } from '@/lib/demo-data'

export function PublicScorers() {
  return (
    <PublicShell active="scorers">
      <div className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Goal className="size-5 text-primary" />
          <h2 className="text-base font-semibold">Klasyfikacja strzelców</h2>
        </div>
        <ul className="divide-y">
          {scorers.map((s) => (
            <li key={s.pos} className="flex items-center gap-3 px-5 py-3">
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full text-sm',
                  s.pos === 1 ? 'bg-primary/10 font-bold text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {s.pos}
              </span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">{s.player}</span>{' '}
                <span className="text-muted-foreground">· {s.team.name}</span>
              </span>
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {s.goals} {golsLabel(s.goals)}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Klasyfikacja obejmuje wszystkie rozegrane mecze turnieju. Przy równej liczbie goli decyduje mniejsza liczba
        rozegranych spotkań.
      </p>
    </PublicShell>
  )
}

function golsLabel(goals: number): string {
  if (goals === 1) return 'gol'
  const rest = goals % 10
  const tens = goals % 100
  if (rest >= 2 && rest <= 4 && (tens < 10 || tens >= 20)) return 'gole'
  return 'goli'
}
