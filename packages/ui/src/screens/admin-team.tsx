import { ArrowLeft, ImageMinus, ImageUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { TournamentShellDemo } from './shell-demo'
import { Button } from '../components/ui/button'
import { Heading } from '../components/ui/typography'
import { TeamLogo } from '../components/layout/team-logo'
import { PlayersTable } from '../components/data/players-table'
import type { PlayerRow } from '../components/data/player-row'
import type { TeamRow } from '../components/data/team-row'
import { rosterTeam, teamPlayers } from '../lib/demo-data'

export interface AdminTeamProps {
  team?: TeamRow
  players?: PlayerRow[]
}

/**
 * Skład drużyny (#89 pkt 3). Ekran stoi w karcie „Drużyny": tytuł to nazwa
 * turnieju, a drużynę pokazuje jej własny nagłówek pod kartami, razem z jej
 * akcjami (pkt 4). Zawodnicy mają ołówek i kosz w wierszu.
 */
export function AdminTeam({ team = rosterTeam, players = teamPlayers }: AdminTeamProps) {
  const hasLogo = team.logoUrl !== null

  return (
    <TournamentShellDemo active="teams">
      <a
        href="#/tournaments/1/teams"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" /> Drużyny
      </a>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <TeamLogo logoUrl={team.logoUrl} name={team.name} className="size-12" />
          <Heading level="section" className="truncate">
            {team.name}
          </Heading>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <Button variant="outline">
            <Pencil className="size-4" /> Zmień nazwę
          </Button>
          <Button variant="outline">
            <ImageUp className="size-4" /> {hasLogo ? 'Zmień herb' : 'Wgraj herb'}
          </Button>
          {/* Tylko przy wgranym herbie: przy herbie zastępczym nie ma czego usuwać. */}
          {hasLogo && (
            <Button variant="outline">
              <ImageMinus className="size-4" /> Usuń herb
            </Button>
          )}
          <Button variant="destructive">
            <Trash2 className="size-4" /> Usuń drużynę
          </Button>
        </div>
      </div>

      {/* Przy pustym składzie akcję niesie pusty stan tabeli: dwa przyciski
          „Dodaj zawodnika" jeden pod drugim mówiłyby to samo dwa razy. */}
      <div className="mt-6 mb-3 flex min-h-8 justify-end">
        {players.length > 0 && (
          <Button>
            <Plus className="size-4" /> Dodaj zawodnika
          </Button>
        )}
      </div>
      <PlayersTable players={players} onCreate={() => {}} onEdit={() => {}} onDelete={() => {}} />
    </TournamentShellDemo>
  )
}
