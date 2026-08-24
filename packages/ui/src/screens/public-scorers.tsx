import { Goal } from 'lucide-react'
import { cn } from '../lib/utils'
import { Card, CardHeader } from '../components/ui/card'
import { Heading } from '../components/ui/typography'
import { PublicShell } from '../components/layout/public-shell'
import { PhotoPanel } from '../components/layout/photo-panel'
import { scorers } from '../lib/demo-data'
import fieldImg from '../assets/public/field.webp'

export function PublicScorers() {
  return (
    <PublicShell active="scorers">
      <Card className="gap-0 overflow-hidden py-0">
        <PhotoPanel src={fieldImg}>
          {/* CardHeader jest gridem, więc ikona i tytuł idą we własny flex —
              inaczej lądują jeden pod drugim. */}
          <CardHeader className="px-5 py-4">
            <span className="flex items-center gap-2">
              <Goal className="size-5 shrink-0 drop-shadow-sm" />
              {/* Heading, nie CardTitle — CardTitle to <div>, a ta karta jest
                  jedyną sekcją ekranu i musi zostać nagłówkiem h2. */}
              <Heading level="card" as="h2" className="text-current drop-shadow-sm">
                Klasyfikacja strzelców
              </Heading>
            </span>
          </CardHeader>
        </PhotoPanel>
        <ul className="divide-y">
          {scorers.map((s) => (
            <li key={s.pos} className="flex items-center gap-4 px-5 py-3">
              {/* Pozycja to liczba, nie odznaczenie — samo miejsce w tabeli
                  nie jest wyróżnieniem, które trzeba oprawiać w tło. */}
              <span
                className={cn(
                  'w-5 shrink-0 text-right text-sm tabular-nums',
                  s.pos === 1 ? 'font-bold text-primary' : 'text-muted-foreground',
                )}
              >
                {s.pos}
              </span>
              <span className="min-w-0 flex-1">
                {/* Zawodnik i klub to hierarchia, nie równorzędna para —
                    niesie ją układ i kontrast, nie znak między nimi. */}
                <span className="block truncate font-medium leading-tight">{s.player}</span>
                <span className="block truncate text-xs text-muted-foreground">{s.team.name}</span>
              </span>
              <span className="shrink-0 text-right leading-tight">
                <span className="text-lg font-bold tabular-nums">{s.goals}</span>{' '}
                <span className="text-xs text-muted-foreground">{golsLabel(s.goals)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
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
