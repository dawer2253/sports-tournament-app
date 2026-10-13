import { CalendarClock, GitFork, MoreHorizontal, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { TournamentShellDemo } from './shell-demo'
import { BracketChampion, BracketMatchRow } from '../components/data/bracket-match-row'
import { FirstRoundPreview } from '../components/data/first-round-preview'
import { RoundTabs } from '../components/data/round-tabs'
import { SeedingList } from '../components/data/seeding-list'
import type { SeedingTeam } from '../components/data/seeding-team'
import { Button } from '../components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { EmptyState } from '../components/ui/empty-state'
import { FormDialog } from '../components/ui/form-dialog'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import { cupByes, cupChampion, cupFinishedRounds, cupRounds, scheduleTimeZone, teams } from '../lib/demo-data'

export interface AdminBracketProps {
  /**
   * `w-trakcie`: ćwierćfinały i pierwszy półfinał rozegrane. `rozegrana`:
   * finał ma zwycięzcę, pod listą stoi mistrz. `pusta`: drabinki jeszcze nie
   * ma. `rozstawienie`: otwarte okno „Rozstaw i wygeneruj”.
   */
  state?: 'w-trakcie' | 'rozegrana' | 'pusta' | 'rozstawienie'
}

const six: SeedingTeam[] = teams.slice(0, 6).map(({ id, name }) => ({ id, name }))

/** W pucharze karta Terminarz jest nieczynna: Drabinka ją zastępuje (#217, ustalenie 5). */
const navHref = (key: string) => (key === 'schedule' ? undefined : '#')
const navDisabledReason = (key: string) => (key === 'schedule' ? 'W pucharze terminarzem jest Drabinka' : undefined)

function Actions() {
  return (
    <>
      <Button variant="outline">
        <CalendarClock className="size-4" /> Rozłóż daty
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Więcej akcji drabinki">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          {/* Wyłączona, a nie ukryta: faza ma już mecze rozpoczęte. */}
          <DropdownMenuItem disabled>
            <RefreshCw /> Wygeneruj ponownie
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

/**
 * Okno „Rozstaw i wygeneruj” (#217, ustalenie 2): lista rozstawienia
 * z blokadą góry i losowaniem po lewej, podgląd par 1. rundy i mecz
 * o 3. miejsce po prawej. Poniżej `md` kolumny stoją jedna pod drugą.
 */
function SeedingDialog() {
  const [order, setOrder] = useState(six)
  const [locked, setLocked] = useState(2)
  const [thirdPlace, setThirdPlace] = useState(true)
  return (
    <FormDialog
      open
      onOpenChange={() => {}}
      onSubmit={(event) => event.preventDefault()}
      title="Rozstaw i wygeneruj"
      description="6 drużyn: drabinka na 8, 2 wolne losy dla najwyżej rozstawionych."
      submitLabel="Wygeneruj"
      contentClassName="max-h-[92vh] overflow-y-auto sm:max-w-3xl"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SeedingList value={order} onChange={setOrder} locked={locked} onLockedChange={setLocked} />
        <div className="grid content-start gap-3">
          <FirstRoundPreview seeding={order} />
          <Label className="flex items-start gap-3 rounded-md border p-3 font-normal">
            <Switch checked={thirdPlace} onCheckedChange={setThirdPlace} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">Mecz o 3. miejsce</span>
              <span className="block text-xs text-muted-foreground">
                Grają przegrani półfinałów, w rundzie finału, przed finałem.
              </span>
            </span>
          </Label>
        </div>
      </div>
    </FormDialog>
  )
}

/**
 * Drabinka w panelu, wariant B z #217: karty rund nad listą meczów wybranej
 * rundy. W rundzie finału mecz o 3. miejsce stoi przed finałem, bo gra
 * wcześniej. Wolne losy opisuje notka pod 1. i 2. rundą, a mistrz stoi pod
 * listą, gdy finał ma zwycięzcę.
 */
export function AdminBracket({ state = 'w-trakcie' }: AdminBracketProps) {
  const rounds = state === 'rozegrana' ? cupFinishedRounds : cupRounds
  const [selected, setSelected] = useState(rounds[state === 'rozegrana' ? 2 : 1]!.summary.id)

  if (state === 'pusta' || state === 'rozstawienie') {
    return (
      <TournamentShellDemo active="bracket" navHref={navHref} navDisabledReason={navDisabledReason}>
        <EmptyState
          icon={<GitFork />}
          title="Drabinka nie jest jeszcze wygenerowana"
          description="6 drużyn: drabinka na 8, 2 wolne losy dla najwyżej rozstawionych."
          action={
            <Button>
              <RefreshCw className="size-4" /> Rozstaw i wygeneruj
            </Button>
          }
        />
        {state === 'rozstawienie' && <SeedingDialog />}
      </TournamentShellDemo>
    )
  }

  const index = rounds.findIndex((round) => round.summary.id === selected)
  const round = rounds[index]!

  return (
    <TournamentShellDemo active="bracket" navHref={navHref} navDisabledReason={navDisabledReason} actions={<Actions />}>
      <RoundTabs
        rounds={rounds.map((candidate) => candidate.summary)}
        value={selected}
        onValueChange={setSelected}
        className="mb-4"
      />
      <ul aria-label={round.summary.name} className="space-y-2">
        {round.matches.map((match) => (
          <li key={match.id}>
            <BracketMatchRow match={match} timeZone={scheduleTimeZone} />
          </li>
        ))}
      </ul>
      {index < 2 && (
        <p className="mt-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Wolne losy (bez meczu w 1. rundzie): {cupByes.map((bye) => `${bye.team} → ${bye.target}`).join(', ')}
        </p>
      )}
      {state === 'rozegrana' && <BracketChampion team={cupChampion} className="mt-4 max-w-sm" />}
    </TournamentShellDemo>
  )
}
