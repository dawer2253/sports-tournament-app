import { ArrowUpRight, GitFork, ListOrdered, Plus, Swords, Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ShellDemo } from './shell-demo'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Progress } from '../components/ui/progress'
import { Heading } from '../components/ui/typography'
import { TournamentStatusBadge } from '../components/data/tournament-status-badge'
import type { TournamentRow } from '../components/data/tournament-row'
import { tournamentList } from '../lib/demo-data'

const activeTournaments = tournamentList.filter((t) => t.status === 'active').length
const teamsTotal = tournamentList.reduce((sum, t) => sum + t.teamsCount, 0)

// Dwa pierwsze liczniki liczą się z `tournamentList`, więc nie mogą jej
// zaprzeczyć. Dwa pozostałe mierzą to, czego lista nie zna — mecze w oknie
// czasu i ruch na stronie publicznej — i zostają danymi demo.
//
// Każde `value` jest napisem: demo „1 204" ma spację tysięcy, a `number` obok
// `string` ukrywałby, że formatowanie liczników jest niespójne.
const stats = [
  { label: 'Aktywne turnieje', value: String(activeTournaments) },
  { label: 'Drużyny', value: String(teamsTotal) },
  { label: 'Mecze (30 dni)', value: '38' },
  { label: 'Odsłony public', value: '1 204' },
]

type Tile = {
  icon: LucideIcon
  /** Format rozgrywek: jedyne pole kafla, którego nie ma w `tournamentList`. */
  format: string
  /** Procent rozegranego terminarza. Tylko dla turnieju w trakcie. */
  progress?: number
  foot: string
}

// Warstwa prezentacyjna kafli, po `id` turnieju: wyłącznie to, czego nie ma
// w `tournamentList`. Nazwa, sport, liczba drużyn i status idą z listy, więc
// nie da się ich tutaj rozjechać. Ikona powtarza format — kafel i tak wypisuje
// go pod tytułem, więc nie niesie treści, której nie da się przeczytać.
const tiles: Partial<Record<TournamentRow['id'], Tile>> = {
  1: { icon: ListOrdered, format: 'Liga', progress: 36, foot: 'Kolejka 5 / 14' },
  2: { icon: Swords, format: 'Puchar', foot: 'Terminarz niewygenerowany' },
  3: { icon: GitFork, format: 'Grupy + playoff', foot: 'Zwycięzca: FC Górka' },
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
          // Turniej dopisany do `tournamentList` bez wpisu tutaj dostaje kafel
          // bez warstwy prezentacyjnej. Dashboard ma nie znikać przez ikonę.
          const tile = tiles[tournament.id]
          const Icon = tile?.icon ?? Trophy
          const meta = [tournament.sport.name, tile?.format, `${tournament.teamsCount} drużyn`]

          return (
            <Card key={tournament.id} className="cursor-pointer p-5 transition-shadow hover:shadow-md">
              <div className="mb-3 flex items-center justify-between">
                <div className="grid size-10 place-items-center rounded-lg bg-primary/10">
                  <Icon className="size-5 text-primary" />
                </div>
                <TournamentStatusBadge status={tournament.status} />
              </div>
              <Heading level="card" className="flex items-center gap-1">
                {tournament.name} <ArrowUpRight className="size-4 text-muted-foreground" />
              </Heading>
              <p className="text-sm text-muted-foreground">{meta.filter(Boolean).join(' · ')}</p>
              {tile?.progress !== undefined && <Progress value={tile.progress} className="mt-3 h-1.5" />}
              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                {tournament.status === 'finished' && <Trophy className="size-3.5 text-primary" />}
                {tile?.foot}
              </div>
            </Card>
          )
        })}
      </div>
    </ShellDemo>
  )
}
