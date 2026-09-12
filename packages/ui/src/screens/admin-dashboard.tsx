import { ArrowUpRight, GitFork, ListOrdered, Plus, Swords, Trophy } from 'lucide-react'
import { ShellDemo } from './shell-demo'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Progress } from '../components/ui/progress'
import { Heading } from '../components/ui/typography'
import { TOURNAMENT_STATUS_BADGE, type TournamentRow } from '../components/data/tournament-row'
import { tournamentList } from '../lib/demo-data'

const stats = [
  { label: 'Aktywne turnieje', value: '2' },
  { label: 'Drużyny', value: '24' },
  { label: 'Mecze (30 dni)', value: '38' },
  { label: 'Odsłony public', value: '1 204' },
]

type Tile = {
  icon: typeof Trophy
  /** Format rozgrywek — jedyne, czego kafel nie ma z `tournamentList`. */
  format: string
  progress: number
  foot: string
}

// Warstwa prezentacyjna kafli, po `id` turnieju: wyłącznie to, czego nie ma
// w `tournamentList`. Nazwa, sport, liczba drużyn i status idą z listy, więc
// nie da się ich tutaj rozjechać. Ikona powtarza format, którego kafel i tak
// nie milczy — stoi wypisany pod tytułem.
const tiles: Record<TournamentRow['id'], Tile> = {
  1: { icon: ListOrdered, format: 'Liga', progress: 36, foot: 'Kolejka 5 / 14' },
  2: { icon: Swords, format: 'Puchar', progress: 0, foot: 'Terminarz niewygenerowany' },
  3: { icon: GitFork, format: 'Grupy + playoff', progress: 100, foot: 'Zwycięzca: FC Górka' },
}

export function AdminDashboard() {
  return (
    <ShellDemo
      active="dashboard"
      title="Twoje turnieje"
      subtitle="Zarządzaj ligami i turniejami"
      actions={<Button><Plus className="size-4" /> Nowy turniej</Button>}
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-bold">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tournamentList.map((tournament) => {
          const { icon: Icon, format, progress, foot } = tiles[tournament.id]
          const badge = TOURNAMENT_STATUS_BADGE[tournament.status]

          return (
            <Card key={tournament.id} className="cursor-pointer p-5 transition-shadow hover:shadow-md">
              <div className="mb-3 flex items-center justify-between">
                <div className="grid size-10 place-items-center rounded-lg bg-primary/10">
                  <Icon className="size-5 text-primary" />
                </div>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
              <Heading level="card" className="flex items-center gap-1">
                {tournament.name} <ArrowUpRight className="size-4 text-muted-foreground" />
              </Heading>
              <p className="text-sm text-muted-foreground">
                {tournament.sport.name} · {format} · {tournament.teamsCount} drużyn
              </p>
              {progress > 0 && progress < 100 && <Progress value={progress} className="mt-3 h-1.5" />}
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                {tournament.status === 'finished' && <Trophy className="size-3.5 text-primary" />}
                {foot} · /t/{tournament.slug}
              </div>
            </Card>
          )
        })}
      </div>
    </ShellDemo>
  )
}
