import { CalendarDays, MoreHorizontal, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { TournamentShellDemo } from './shell-demo'
import { MatchRow } from '../components/data/match-row'
import { RoundList } from '../components/data/round-list'
import { Button } from '../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { EmptyState } from '../components/ui/empty-state'
import { Heading } from '../components/ui/typography'
import { matchDays } from '../lib/kickoff'
import {
  scheduleInProgress,
  scheduleRounds,
  scheduleTimeZone,
  scheduleUndated,
  teams,
  type ScheduleDemoMatch,
} from '../lib/demo-data'

export interface AdminScheduleProps {
  /**
   * `w-trakcie`: sezon z datami i rozegranymi kolejkami. `bez-dat`: świeżo
   * wygenerowany terminarz, mecze bez terminu i obiektu. `pusty`: terminarza
   * jeszcze nie ma.
   */
  state?: 'w-trakcie' | 'bez-dat' | 'pusty'
}

const MATCHES: Record<Exclude<AdminScheduleProps['state'], undefined | 'pusty'>, ScheduleDemoMatch[]> = {
  'w-trakcie': scheduleInProgress,
  'bez-dat': scheduleUndated,
}

/**
 * Terminarz ligi (#174, wariant D z #162): lista kolejek z boku, mecze
 * wybranej kolejki obok. Kolejki, daty i liczniki panel liczy z meczów fazy;
 * tu liczy je `scheduleRounds` z `lib/demo-data`.
 */
export function AdminSchedule({ state = 'w-trakcie' }: AdminScheduleProps) {
  if (state === 'pusty') {
    return (
      <TournamentShellDemo active="schedule">
        <EmptyState
          icon={<CalendarDays />}
          title="Terminarz nie jest jeszcze wygenerowany"
          description={`${teams.length} drużyn gra każdy z każdym. Najpierw powstaną pary i kolejki, daty rozłożysz potem.`}
          action={
            <Button>
              <RefreshCw className="size-4" /> Wygeneruj terminarz
            </Button>
          }
        />
      </TournamentShellDemo>
    )
  }

  return <ScheduleWithRounds matches={MATCHES[state]} />
}

function ScheduleWithRounds({ matches }: { matches: ScheduleDemoMatch[] }) {
  const rounds = scheduleRounds(matches)
  const started = matches.some((match) => match.status !== 'scheduled')
  // Domyślnie pierwsza kolejka z meczem niezakończonym (#162, pkt 1).
  const firstOpen = rounds.find((round) => round.finished < round.total) ?? rounds[rounds.length - 1]
  const [value, setValue] = useState(firstOpen.id)
  const round = rounds.find((candidate) => candidate.id === value)!
  const roundMatches = matches.filter((match) => match.round.id === value)
  const oneDay = matchDays(roundMatches.map((match) => match.kickoffAt), scheduleTimeZone).length === 1

  return (
    <TournamentShellDemo
      active="schedule"
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Więcej akcji terminarza">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={started}>
              <RefreshCw /> Wygeneruj ponownie
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      <div className="grid items-start gap-4 md:grid-cols-[15rem_minmax(0,1fr)]">
        <RoundList rounds={rounds} value={value} onValueChange={setValue} className="md:sticky md:top-4" />
        <section aria-labelledby="schedule-round" className="min-w-0 space-y-2">
          {/* Na telefonie nazwę i daty kolejki niesie już przycisk listy kolejek. */}
          <div className="hidden flex-wrap items-baseline gap-x-2 md:flex">
            <Heading level="card" id="schedule-round">
              {round.name}
            </Heading>
            <span className="text-sm text-muted-foreground">{round.dates}</span>
          </div>
          <ul className="space-y-2">
            {roundMatches.map((match) => (
              <li key={match.id}>
                <MatchRow match={match} showDate={!oneDay} timeZone={scheduleTimeZone} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </TournamentShellDemo>
  )
}
