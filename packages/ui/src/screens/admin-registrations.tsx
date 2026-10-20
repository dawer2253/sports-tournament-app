import { TournamentShellDemo } from './shell-demo'
import { Button } from '../components/ui/button'
import type { RegistrationRow } from '../components/data/registration-row'
import { pendingRegistrationsBadge, RegistrationsBoard, registrationsEmptyDescription } from '../components/data/registrations-board'
import { registrationRows, scheduleTimeZone } from '../lib/demo-data'

export interface AdminRegistrationsProps {
  registrations?: RegistrationRow[]
  /** Czy organizer otworzył zapisy (`Tournament.registration.open`). */
  open?: boolean
  /** Uwaga przy „Przyjmij”, gdy turniej ma już grupy albo terminarz. */
  note?: string
  /** Błąd przyjęcia przy pierwszym zgłoszeniu oczekującym. */
  error?: string
}

/** Zgłoszenia drużyn turnieju (#300): oczekujące z akcjami, pod nimi rozpatrzone. */
export function AdminRegistrations({ registrations = registrationRows, open = true, note, error }: AdminRegistrationsProps) {
  const pending = registrations.filter((registration) => registration.status === 'pending')
  return (
    <TournamentShellDemo
      active="registrations"
      sectionBadge={(key) => (key === 'registrations' ? pendingRegistrationsBadge(pending.length) : undefined)}
    >
      <RegistrationsBoard
        registrations={registrations}
        timeZone={scheduleTimeZone}
        emptyDescription={registrationsEmptyDescription(open)}
        pendingCard={(registration) => ({
          note,
          error: registration === pending[0] ? error : undefined,
          actions: (
            <>
              <Button>Przyjmij</Button>
              <Button variant="outline">Odrzuć</Button>
            </>
          ),
        })}
      />
    </TournamentShellDemo>
  )
}
