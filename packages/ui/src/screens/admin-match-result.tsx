import { TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { TournamentShellDemo } from './shell-demo'
import { collisionLabel } from '../components/data/match-row'
import { MatchStatusToggle } from '../components/data/match-status-toggle'
import { ScoreInputs } from '../components/data/score-inputs'
import type { MatchStatus } from '../components/data/match-row-data'
import { FormDialog } from '../components/ui/form-dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { formatKickoff } from '../lib/kickoff'
import {
  scheduleInProgress,
  scheduleTimeZone,
  scheduleVenues,
  type ScheduleDemoMatch,
} from '../lib/demo-data'

/**
 * Mecz z kolizją terminu: makieta pokazuje listę kolizji, więc musi być na czym
 * ją oprzeć. Wybór jest deterministyczny (snapshoty Chromatica).
 */
const demoMatch = scheduleInProgress.find((match) => (match.collisions?.length ?? 0) > 0) ?? scheduleInProgress[0]!

/** Numer meczu w kolejce — makieta terminarza trzyma go w `id` (patrz `scheduleUndated`). */
function demoMatchNumber(match: ScheduleDemoMatch): number {
  return ((match.id - 1) % 10) + 1
}

/**
 * Okno meczu (#176): wynik, stan, termin, obiekt i kolizje — bez sekcji
 * zdarzeń. Zdarzenia S3 dochodzą do tego samego okna zamiast osobnej strony.
 *
 * Makieta trzyma cały ekran w tle (`TournamentShellDemo`), bo okno otwiera się
 * nad terminarzem. Reguła przełącznika jest tu odtworzona, żeby prototyp
 * pokazywał to samo, co robi panel: „Trwa” na meczu bez wyniku wstawia `0:0`,
 * a „Zaplanowany” czyści oba pola.
 */
export function AdminMatchResult() {
  const [match, setMatch] = useState(demoMatch)

  return (
    <TournamentShellDemo active="schedule">
      <MatchDialog key={match.id} match={match} onOpenMatch={setMatch} />
    </TournamentShellDemo>
  )
}

function MatchDialog({
  match,
  onOpenMatch,
}: {
  match: ScheduleDemoMatch
  onOpenMatch: (match: ScheduleDemoMatch) => void
}) {
  const [status, setStatus] = useState<MatchStatus>(match.status)
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? '')
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? '')
  const [venueId, setVenueId] = useState(match.venue ? String(match.venue.id) : 'none')

  const home = match.homeTeam?.name ?? 'Do ustalenia'
  const away = match.awayTeam?.name ?? 'Do ustalenia'

  function changeStatus(next: MatchStatus) {
    setStatus(next)
    if (next === 'scheduled') {
      setHomeScore('')
      setAwayScore('')
    } else if (next === 'live') {
      setHomeScore((value) => (value === '' ? '0' : value))
      setAwayScore((value) => (value === '' ? '0' : value))
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={() => {}}
      onSubmit={(event) => event.preventDefault()}
      title={`${home} – ${away}`}
      description={`${match.round.name} · mecz ${demoMatchNumber(match)}`}
      submitLabel="Zapisz"
    >
      <div className="grid gap-4">
        <div className="grid content-start gap-3">
          <ScoreInputs
            homeValue={homeScore}
            awayValue={awayScore}
            onHomeChange={setHomeScore}
            onAwayChange={setAwayScore}
            homeLabel={`Wynik ${home}`}
            awayLabel={`Wynik ${away}`}
          />
          <MatchStatusToggle value={status} onChange={changeStatus} className="justify-self-center" />
        </div>

        <div className="grid content-start gap-3 sm:grid-cols-2">
          <div className="grid content-start gap-2">
            <Label htmlFor="match-kickoff">Termin</Label>
            <Input
              id="match-kickoff"
              type="datetime-local"
              defaultValue={match.kickoffAt?.slice(0, 16)}
              aria-label="Termin meczu"
            />
            <p className="text-xs text-muted-foreground">Puste pole to „Termin do ustalenia”.</p>
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor="match-venue">Obiekt</Label>
            {/* Lista wyboru przez `Select` z DS, nie natywny `<select>` („Formularze i okna”). */}
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger id="match-venue" aria-label="Obiekt" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bez obiektu</SelectItem>
                {scheduleVenues.map((venue) => (
                  <SelectItem key={venue.id} value={String(venue.id)}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <CollisionList match={match} onOpenMatch={onOpenMatch} />
      </div>
    </FormDialog>
  )
}

/**
 * Kolizje terminu tego meczu z innymi meczami turnieju (#158). Kontrakt zna
 * tylko `matchId`, więc opis drugiej strony dokłada ekran. Kliknięcie otwiera
 * okno tamtego meczu — w panelu przełącza też listę kolejek.
 */
function CollisionList({
  match,
  onOpenMatch,
}: {
  match: ScheduleDemoMatch
  onOpenMatch: (match: ScheduleDemoMatch) => void
}) {
  const collisions = match.collisions ?? []
  if (collisions.length === 0) return null

  return (
    <div className="grid content-start gap-1">
      <p className="text-sm font-medium">Kolizje</p>
      <ul className="space-y-1">
        {collisions.map((collision, index) => {
          const other = scheduleInProgress.find((candidate) => candidate.id === collision.matchId)
          const type = collisionLabel(collision.type)
          if (!other) {
            return (
              <li key={`${collision.type}-${index}`} className="flex items-center gap-2 px-2 text-sm">
                <TriangleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
                <span>{type} z meczem innej fazy</span>
              </li>
            )
          }
          const description = `${other.homeTeam?.name ?? 'Do ustalenia'} – ${other.awayTeam?.name ?? 'Do ustalenia'} (${other.round.name}, ${formatKickoff(other.kickoffAt, { timeZone: scheduleTimeZone })})`
          return (
            <li key={`${collision.type}-${index}`}>
              <button
                type="button"
                onClick={() => onOpenMatch(other)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
              >
                <TriangleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
                <span className="min-w-0">
                  {type}: {description}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="px-2 text-xs text-muted-foreground">Kolizja nie blokuje zapisu.</p>
    </div>
  )
}
