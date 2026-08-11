import { Goal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader } from '@/components/ui/card'
import { Heading } from '@/components/ui/typography'
import { PublicShell } from '@/components/layout/public-shell'
import { PhotoPanel } from '@/components/layout/photo-panel'
import { scorers } from '@/lib/demo-data'
import fieldImg from '@/assets/public/field.webp'

export function PublicScorers() {
  return (
    <PublicShell active="scorers">
      <Card className="gap-0 overflow-hidden py-0">
        <PhotoPanel src={fieldImg} focus="center 25%">
          <CardHeader className="flex-row items-center gap-2 space-y-0 px-5 py-4">
            <Goal className="size-5 drop-shadow-sm" />
            {/* Heading, nie CardTitle — CardTitle to <div>, a ta karta jest
                jedyną sekcją ekranu i musi zostać nagłówkiem h2. */}
            <Heading level="card" as="h2" className="text-current drop-shadow-sm">
              Klasyfikacja strzelców
            </Heading>
          </CardHeader>
        </PhotoPanel>
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
