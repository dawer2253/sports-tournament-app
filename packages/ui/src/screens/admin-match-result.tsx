import { ChevronDown, Play, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { TournamentShellDemo } from './shell-demo'
import { EventTypeButtons } from '../components/data/event-type-buttons'
import type { MatchEventRow } from '../components/data/match-event-data'
import { collisionLabel } from '../components/data/match-row'
import type { MatchStatus } from '../components/data/match-row-data'
import { MatchStatusToggle } from '../components/data/match-status-toggle'
import { MatchTimeline } from '../components/data/match-timeline'
import { PlayerNumberGrid } from '../components/data/player-number-grid'
import { ScoreInputs } from '../components/data/score-inputs'
import { Button } from '../components/ui/button'
import { ConfirmDeleteDialog } from '../components/ui/confirm-delete-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
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
import { cn } from '../lib/utils'
import {
  demoRoster,
  eventTypesBySport,
  matchInProgress,
  matchInProgressEvents,
  scheduleInProgress,
  scheduleTimeZone,
  scheduleVenues,
  scoringStatBySport,
  type ScheduleDemoMatch,
} from '../lib/demo-data'

/** Typy i zdobycz piłki — terminarz demo to liga piłkarska. */
const eventTypes = eventTypesBySport.football
const scoringStat = scoringStatBySport.football

/**
 * Mecz zaplanowany z kolizją terminu: na nim makieta pokazuje listę kolizji
 * i „Rozpocznij mecz”. Wybór jest deterministyczny (snapshoty Chromatica).
 */
const scheduledMatch = scheduleInProgress.find((match) => (match.collisions?.length ?? 0) > 0) ?? scheduleInProgress[0]!

/** Numer meczu w kolejce — makieta terminarza trzyma go w `id` (patrz `scheduleUndated`). */
function demoMatchNumber(match: ScheduleDemoMatch): number {
  return ((match.id - 1) % 10) + 1
}

export interface AdminMatchResultProps {
  /** Mecz w trakcie ze zdarzeniami (domyślnie) albo zaplanowany z kolizjami. */
  match?: 'live' | 'scheduled'
}

/**
 * Okno meczu (#176, zdarzenia #200): wynik, stan, termin, obiekt, kolizje
 * i zdarzenia w jednym oknie, w układzie wybranym na prototypie #191.
 *
 * Makieta trzyma cały ekran w tle (`TournamentShellDemo`), bo okno otwiera się
 * nad terminarzem. Reguły okna są tu odtworzone, żeby makieta pokazywała to
 * samo co panel: „Trwa” na meczu bez wyniku wstawia `0:0`, „Zaplanowany”
 * czyści oba pola, a zdarzenia zapisują się od razu, osobno od „Zapisz”.
 */
export function AdminMatchResult({ match: variant = 'live' }: AdminMatchResultProps) {
  const [match, setMatch] = useState(variant === 'live' ? matchInProgress : scheduledMatch)

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
  const [savedStatus, setSavedStatus] = useState<MatchStatus>(match.status)
  const [status, setStatus] = useState<MatchStatus>(match.status)
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? '')
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? '')
  const [venueId, setVenueId] = useState(match.venue ? String(match.venue.id) : 'none')
  const [scheduleOpen, setScheduleOpen] = useState(false)

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

  /** „Rozpocznij mecz”: w panelu od razu `PATCH` z `status: live` i `0:0`. */
  function startMatch() {
    setSavedStatus('live')
    changeStatus('live')
  }

  return (
    <Dialog open onOpenChange={() => {}}>
      {/* Bez `<form>`: zdarzenia zapisują się od razu, więc Enter w polu minuty
          nie może wysłać całego meczu. */}
      <DialogContent showCloseButton={false} className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{`${home} – ${away}`}</DialogTitle>
          <DialogDescription>{`${match.round.name}, mecz ${demoMatchNumber(match)}`}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <ScoreInputs
              homeValue={homeScore}
              awayValue={awayScore}
              onHomeChange={setHomeScore}
              onAwayChange={setAwayScore}
              homeLabel={`Wynik ${home}`}
              awayLabel={`Wynik ${away}`}
            />
            <MatchStatusToggle value={status} onChange={changeStatus} />
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              aria-expanded={scheduleOpen}
              onClick={() => setScheduleOpen(!scheduleOpen)}
              className="flex items-center gap-1 justify-self-start text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronDown aria-hidden className={cn('size-4 transition-transform', !scheduleOpen && '-rotate-90')} />
              Termin i obiekt
            </button>
            {scheduleOpen && (
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
            )}
          </div>

          <CollisionList match={match} onOpenMatch={onOpenMatch} />

          <EventsSection
            match={match}
            started={savedStatus !== 'scheduled'}
            homeScore={homeScore}
            awayScore={awayScore}
            onStart={startMatch}
          />
        </div>

        <DialogFooter className="items-center">
          <p className="mr-auto text-xs text-muted-foreground">
            Zdarzenia zapisują się od razu. „Zapisz” dotyczy wyniku, stanu, terminu i obiektu.
          </p>
          <Button type="button" variant="outline">
            Anuluj
          </Button>
          <Button type="button">Zapisz</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Sekcja zdarzeń (#200): przy każdej drużynie przyciski typów, po kliknięciu
 * siatka numerów, a pod spodem oś meczu. Minuta zostaje w polu między wpisami.
 */
function EventsSection({
  match,
  started,
  homeScore,
  awayScore,
  onStart,
}: {
  match: ScheduleDemoMatch
  started: boolean
  homeScore: string
  awayScore: string
  onStart: () => void
}) {
  const [events, setEvents] = useState<MatchEventRow[]>(match.id === matchInProgress.id ? matchInProgressEvents : [])
  const [picking, setPicking] = useState<{ teamId: number; type: string } | null>(null)
  const [minute, setMinute] = useState('')
  const [editing, setEditing] = useState<MatchEventRow | null>(null)
  const teams = [match.homeTeam, match.awayTeam].filter((team) => team !== null)

  if (teams.length < 2) return null

  function add(teamId: number, typeCode: string, playerId: number) {
    const team = teams.find((candidate) => candidate.id === teamId)!
    const player = demoRoster(teamId).find((candidate) => candidate.id === playerId)!
    const type = eventTypes.find((candidate) => candidate.code === typeCode)!
    const event: MatchEventRow = {
      id: Math.max(0, ...events.map((existing) => existing.id)) + 1,
      team: { id: team.id, name: team.name },
      player: { id: player.id, name: player.name },
      type: type.code,
      typeLabel: type.label,
      minute: minute === '' ? null : Number(minute),
    }
    // Kolejność jak z API: minuta rosnąco, bez minuty na końcu, potem `id`.
    setEvents((current) =>
      [...current, event].sort((a, b) => (a.minute ?? Infinity) - (b.minute ?? Infinity) || a.id - b.id),
    )
    setPicking(null)
  }

  return (
    <div className="grid gap-3 border-t pt-4">
      <p className="text-sm font-medium">Zdarzenia</p>

      {started ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team) => (
            <div key={team.id} className="grid content-start gap-2 rounded-lg border p-3">
              <p className="truncate text-sm font-semibold">{team.name}</p>
              {picking?.teamId === team.id ? (
                <PlayerNumberGrid
                  title={`${eventTypes.find((type) => type.code === picking.type)?.label} — kto?`}
                  players={demoRoster(team.id)}
                  minute={minute}
                  onMinuteChange={setMinute}
                  onBack={() => setPicking(null)}
                  onSelect={(playerId) => add(team.id, picking.type, playerId)}
                />
              ) : (
                <EventTypeButtons
                  teamName={team.name}
                  types={eventTypes}
                  scoringStat={scoringStat}
                  disabled={picking !== null}
                  onSelect={(type) => setPicking({ teamId: team.id, type })}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed px-3 py-2">
          <p className="mr-auto text-sm text-muted-foreground">Zdarzenia wpiszesz, gdy mecz się zacznie.</p>
          <Button type="button" size="sm" onClick={onStart}>
            <Play className="size-4" /> Rozpocznij mecz
          </Button>
        </div>
      )}

      <MismatchLine match={match} events={events} homeScore={homeScore} awayScore={awayScore} />
      <MatchTimeline
        events={events}
        homeTeamId={teams[0].id}
        types={eventTypes}
        onSelect={started ? setEditing : undefined}
      />

      {editing && (
        <EventEditDialog
          event={editing}
          match={match}
          onClose={() => setEditing(null)}
          onSave={(next) => {
            setEvents((current) => current.map((event) => (event.id === next.id ? next : event)))
            setEditing(null)
          }}
          onDelete={() => {
            setEvents((current) => current.filter((event) => event.id !== editing.id))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * Cicha linia zgodności: tylko przy rozjeździe zdarzeń bramkowych z wynikiem.
 * Samobój liczy się przeciwnikowi. Niczego nie blokuje — wynik wpisuje się
 * osobno (#188, reguła 11).
 */
function MismatchLine({
  match,
  events,
  homeScore,
  awayScore,
}: {
  match: ScheduleDemoMatch
  events: MatchEventRow[]
  homeScore: string
  awayScore: string
}) {
  if (homeScore === '' || awayScore === '') return null

  let home = 0
  let away = 0
  for (const event of events) {
    const type = eventTypes.find((candidate) => candidate.code === event.type)
    const scores = type?.stat === scoringStat || type?.stat === null
    if (!type || !scores) continue
    const forHome = event.team.id === match.homeTeam?.id
    // Samobój (`stat: null`) daje bramkę drużynie przeciwnej.
    const creditedHome = type.stat === null ? !forHome : forHome
    if (creditedHome) home += type.value
    else away += type.value
  }

  if (home === Number(homeScore) && away === Number(awayScore)) return null

  return (
    <p className="text-xs text-muted-foreground">
      Bramki ze zdarzeń: {home}:{away} · wynik meczu {homeScore}:{awayScore}
    </p>
  )
}

/** Pod-okno edycji zdarzenia z osi (wzorzec `FormDialog`), z usuwaniem za potwierdzeniem. */
function EventEditDialog({
  event,
  match,
  onClose,
  onSave,
  onDelete,
}: {
  event: MatchEventRow
  match: ScheduleDemoMatch
  onClose: () => void
  onSave: (event: MatchEventRow) => void
  onDelete: () => void
}) {
  const [type, setType] = useState(event.type)
  const [teamId, setTeamId] = useState(String(event.team.id))
  const [playerId, setPlayerId] = useState(event.player ? String(event.player.id) : '')
  const [minute, setMinute] = useState(event.minute?.toString() ?? '')
  const [confirming, setConfirming] = useState(false)
  const teams = [match.homeTeam, match.awayTeam].filter((team) => team !== null)
  const roster = demoRoster(Number(teamId))

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      onSubmit={(submit) => {
        submit.preventDefault()
        const team = teams.find((candidate) => candidate.id === Number(teamId))!
        const player = roster.find((candidate) => candidate.id === Number(playerId))
        onSave({
          ...event,
          type,
          typeLabel: eventTypes.find((candidate) => candidate.code === type)!.label,
          team: { id: team.id, name: team.name },
          player: player ? { id: player.id, name: player.name } : null,
          minute: minute === '' ? null : Number(minute),
        })
      }}
      title="Edytuj zdarzenie"
      submitLabel="Zapisz"
    >
      <div className="grid gap-3">
        <div className="grid content-start gap-2">
          <Label htmlFor="event-type">Typ</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="event-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid content-start gap-2">
          <Label htmlFor="event-team">Drużyna</Label>
          <Select
            value={teamId}
            onValueChange={(next) => {
              setTeamId(next)
              setPlayerId('')
            }}
          >
            <SelectTrigger id="event-team" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team.id} value={String(team.id)}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid content-start gap-3 sm:grid-cols-[1fr_6rem]">
          <div className="grid content-start gap-2">
            <Label htmlFor="event-player">Zawodnik</Label>
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger id="event-player" className="w-full">
                <SelectValue placeholder="Wybierz zawodnika" />
              </SelectTrigger>
              <SelectContent>
                {roster.map((player) => (
                  <SelectItem key={player.id} value={String(player.id)}>
                    {player.number === null ? player.name : `${player.number}. ${player.name}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor="event-minute">Minuta</Label>
            <Input
              id="event-minute"
              inputMode="numeric"
              value={minute}
              onChange={(change) => setMinute(change.target.value.replace(/\D/g, '').slice(0, 3))}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Puste pole to zdarzenie bez minuty. Doliczony czas „90+3” wpisz jako 93.</p>
        <Button type="button" variant="destructive" className="justify-self-start" onClick={() => setConfirming(true)}>
          <Trash2 className="size-4" /> Usuń zdarzenie
        </Button>
      </div>
      <ConfirmDeleteDialog
        open={confirming}
        onOpenChange={setConfirming}
        onConfirm={onDelete}
        entity="zdarzenie"
        name={`${event.minute === null ? '' : `${event.minute}′ `}${event.typeLabel} · ${event.player?.name ?? event.team.name}`}
      />
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
