import type { ElementType } from 'react'
import {
  Check, CheckCircle2, ListOrdered, GitFork, Trophy, ArrowRight,
} from 'lucide-react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type StepState = 'done' | 'active' | 'todo'

const STEPS: { n: number; label: string; state: StepState }[] = [
  { n: 1, label: 'Sport', state: 'done' },
  { n: 2, label: 'Format', state: 'active' },
  { n: 3, label: 'Drużyny', state: 'todo' },
  { n: 4, label: 'Terminarz', state: 'todo' },
]

function Stepper({ current }: { current: number }) {
  const steps = STEPS.map((s) => ({
    ...s,
    state: (s.n < current ? 'done' : s.n === current ? 'active' : 'todo') as StepState,
  }))
  return (
    <ol className="mb-6 flex items-center gap-2">
      {steps.map((s, i) => (
        <li key={s.n} className="flex flex-1 items-center gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold',
                s.state === 'done' && 'border-primary bg-primary text-primary-foreground',
                s.state === 'active' && 'border-primary text-primary ring-2 ring-primary/40',
                s.state === 'todo' && 'border-border text-muted-foreground',
              )}
            >
              {s.state === 'done' ? <Check className="size-4" /> : s.n}
            </span>
            <span
              className={cn(
                'hidden text-sm sm:inline',
                s.state === 'active' ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <span
              className={cn(
                'h-px flex-1',
                s.state === 'done' ? 'bg-primary' : 'bg-border',
              )}
            />
          )}
        </li>
      ))}
    </ol>
  )
}

interface FormatOption {
  key: string
  title: string
  description: string
  icon: ElementType
  selected?: boolean
}

const FORMATS: FormatOption[] = [
  {
    key: 'league',
    title: 'Liga każdy z każdym',
    description: 'Wszystkie drużyny grają ze sobą, o kolejności decyduje tabela punktowa.',
    icon: ListOrdered,
    selected: true,
  },
  {
    key: 'cup',
    title: 'Puchar (drabinka)',
    description: 'System pucharowy — przegrany odpada, wygrany awansuje do kolejnej rundy.',
    icon: GitFork,
  },
  {
    key: 'groups',
    title: 'Grupy + playoff',
    description: 'Faza grupowa wyłania najlepszych, potem rozgrywki pucharowe.',
    icon: Trophy,
  },
]

export function AdminTournamentCreate() {
  return (
    <AdminShell
      active="dashboard"
      title="Nowy turniej"
      subtitle="Skonfiguruj rozgrywki w 4 krokach"
    >
      <Stepper current={2} />

      <div className="grid gap-4 md:grid-cols-3">
        {FORMATS.map((f) => (
          <Card
            key={f.key}
            className={cn(
              'relative cursor-pointer transition-shadow hover:shadow-md',
              f.selected && 'ring-2 ring-primary',
            )}
          >
            {f.selected && (
              <CheckCircle2 className="absolute right-3 top-3 size-5 text-primary" />
            )}
            <CardHeader>
              <div
                className={cn(
                  'mb-2 grid size-10 place-items-center rounded-lg',
                  f.selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                <f.icon className="size-5" />
              </div>
              <CardTitle>{f.title}</CardTitle>
              <CardDescription>{f.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="mt-6 max-w-2xl">
        <CardHeader>
          <CardTitle>Ustawienia ligi</CardTitle>
          <CardDescription>Zasady punktacji i harmonogramu dla formatu ligowego.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="rematch">Mecz i rewanż</Label>
              <p className="text-sm text-muted-foreground">Każda para gra dwa spotkania (dom i wyjazd).</p>
            </div>
            <Switch id="rematch" defaultChecked />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="auto-schedule">Auto-harmonogram dat</Label>
              <p className="text-sm text-muted-foreground">Automatycznie rozłóż mecze na dostępne terminy.</p>
            </div>
            <Switch id="auto-schedule" defaultChecked />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="points-win">Punkty za zwycięstwo</Label>
              <Input id="points-win" type="number" defaultValue={3} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="points-draw">Punkty za remis</Label>
              <Input id="points-draw" type="number" defaultValue={1} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 flex items-center justify-between border-t pt-4">
        <Button variant="outline">Anuluj</Button>
        <Button>
          Dalej: drużyny <ArrowRight className="size-4" />
        </Button>
      </div>
    </AdminShell>
  )
}

const SPORTS: { key: string; emoji: string; title: string; description: string; selected?: boolean }[] = [
  { key: 'football', emoji: '⚽', title: 'Piłka nożna', description: 'Mecze 11 na 11, punktacja 3-1-0, tabela ligowa.', selected: true },
  { key: 'basketball', emoji: '🏀', title: 'Koszykówka', description: 'Rozgrywki koszykarskie, brak remisów, bilans zwycięstw.' },
]

export function AdminTournamentCreateStep1() {
  return (
    <AdminShell
      active="dashboard"
      title="Nowy turniej"
      subtitle="Skonfiguruj rozgrywki w 4 krokach"
    >
      <Stepper current={1} />

      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        {SPORTS.map((s) => (
          <Card
            key={s.key}
            className={cn(
              'relative cursor-pointer transition-shadow hover:shadow-md',
              s.selected && 'ring-2 ring-primary',
            )}
          >
            {s.selected && (
              <CheckCircle2 className="absolute right-3 top-3 size-5 text-primary" />
            )}
            <CardHeader>
              <div className="mb-2 grid size-10 place-items-center rounded-lg bg-primary/10 text-xl">
                {s.emoji}
              </div>
              <CardTitle>{s.title}</CardTitle>
              <CardDescription>{s.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between border-t pt-4">
        <Button variant="outline">Anuluj</Button>
        <Button>
          Dalej: format <ArrowRight className="size-4" />
        </Button>
      </div>
    </AdminShell>
  )
}
