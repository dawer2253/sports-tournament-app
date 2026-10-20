import * as React from 'react'
import { formatKickoff } from '../lib/kickoff'
import { Button } from './button'

/**
 * Zapisy na stronie publicznej (#300): pasek pod nagłówkiem turnieju na
 * każdej zakładce i kafel na Przeglądzie. Oba pokazują się tylko przy
 * otwartych zapisach (`PublicRegistration.open`) — o tym decyduje strona,
 * klocki dostają już tylko termin i adres formularza.
 */
export interface RegistrationEntryProps {
  /** Termin zapisów (`PublicRegistration.deadline`), `null` bez terminu. */
  deadline: string | null
  /** Strefa terminu; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Adres formularza zgłoszenia. */
  href?: string
  onNavigate?: () => void
}

/** „do sob., 15 lis, 18:00” albo nic, gdy zapisy nie mają terminu. */
export function registrationDeadline(deadline: string | null, timeZone?: string): string | null {
  return deadline === null ? null : `do ${formatKickoff(deadline, { timeZone })}`
}

/**
 * Pasek zapisów pod nagłówkiem turnieju (`Shell`, prop `banner`): „Zapisy
 * otwarte”, termin i „Zgłoś drużynę”. Stoi na każdej zakładce, więc kibic
 * trafi na formularz z dowolnego miejsca strony.
 */
export function RegistrationBanner({ deadline, timeZone, href, onNavigate }: RegistrationEntryProps) {
  const until = registrationDeadline(deadline, timeZone)
  return (
    <aside aria-label="Zapisy" data-slot="registration-banner" className="border-b border-hairline bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
        <p>
          <span className="pub-tab text-pub-16">Zapisy otwarte</span>
          {until && <span className="text-muted-foreground"> {until}</span>}
        </p>
        <Button href={href} onNavigate={onNavigate} className="min-h-10 text-pub-16">
          Zgłoś drużynę
        </Button>
      </div>
    </aside>
  )
}

/**
 * Kafel zapisów na Przeglądzie: kto może zgłosić drużynę, do kiedy, i wejście
 * w formularz. Nad treścią Przeglądu, także przed terminarzem.
 */
export function RegistrationTile({ deadline, timeZone, href, onNavigate }: RegistrationEntryProps) {
  const id = React.useId()
  const until = registrationDeadline(deadline, timeZone)
  return (
    <section
      aria-labelledby={id}
      data-slot="registration-tile"
      className="flex flex-col items-start gap-4 rounded-md bg-card p-5 ring-1 ring-border ring-inset sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h3 id={id} className="pub-h2">
          Zapisy otwarte{until && ` ${until}`}
        </h3>
        <p className="text-muted-foreground">Zgłoś drużynę do turnieju. Organizator rozpatrzy zgłoszenie i skontaktuje się z tobą.</p>
      </div>
      <Button href={href} onNavigate={onNavigate} className="shrink-0">
        Zgłoś drużynę
      </Button>
    </section>
  )
}
