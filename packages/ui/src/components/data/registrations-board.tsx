import * as React from 'react'
import { Inbox } from 'lucide-react'
import { plural } from '../../lib/plural'
import { EmptyState } from '../ui/empty-state'
import { Heading } from '../ui/typography'
import { RegistrationCard, type RegistrationCardProps } from './registration-card'
import type { RegistrationRow } from './registration-row'

/** Plakietka karty „Zgłoszenia” (`AdminShell.sectionBadge`): liczba oczekujących i jej opis. */
export function pendingRegistrationsBadge(count: number): { count: number; label: string } {
  return { count, label: `${count} ${plural(count, ['oczekujące', 'oczekujące', 'oczekujących'])}` }
}

/** Zdanie pustego stanu: co zrobić, żeby zgłoszenia przyszły, zależnie od tego, czy zapisy są otwarte. */
export function registrationsEmptyDescription(open: boolean): string {
  return open
    ? 'Zapisy są otwarte. Zgłoszenia z formularza na stronie turnieju pojawią się tutaj.'
    : 'Zapisy są zamknięte. Otwórz je w ustawieniach turnieju, żeby drużyny mogły się zgłaszać ze strony turnieju.'
}

export interface RegistrationsBoardProps<R extends RegistrationRow = RegistrationRow> {
  /** Zgłoszenia turnieju od najstarszego, jak oddaje je API. */
  registrations: readonly R[]
  timeZone?: string
  /**
   * Akcje, uwaga i błąd przy zgłoszeniu oczekującym — dokłada je aplikacja,
   * bo zna zapis. Storybook podaje same przyciski.
   */
  pendingCard?: (registration: R) => Pick<RegistrationCardProps, 'actions' | 'note' | 'error'>
  /** Zdanie pustego stanu: co zrobić, żeby zgłoszenia przyszły (zależy od zapisów). */
  emptyDescription: string
}

/**
 * Zgłoszenia drużyn w panelu (#300): oczekujące na górze, z akcjami, pod
 * nimi rozpatrzone, od najnowszej decyzji. Bez zgłoszeń pusty stan ze
 * zdaniem, co dalej.
 */
export function RegistrationsBoard<R extends RegistrationRow>({ registrations, timeZone, pendingCard, emptyDescription }: RegistrationsBoardProps<R>) {
  const pendingId = React.useId()
  const decidedId = React.useId()

  if (registrations.length === 0) {
    return <EmptyState icon={<Inbox />} title="Nie ma jeszcze zgłoszeń" description={emptyDescription} />
  }

  const pending = registrations.filter((registration) => registration.status === 'pending')
  const decided = registrations
    .filter((registration) => registration.status !== 'pending')
    .toSorted((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''))

  return (
    <div data-slot="registrations-board" className="space-y-8">
      <section aria-labelledby={pendingId} className="space-y-3">
        <Heading level="section" id={pendingId}>
          Oczekujące
        </Heading>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Wszystkie zgłoszenia są rozpatrzone.</p>
        ) : (
          pending.map((registration) => (
            <RegistrationCard key={registration.id} registration={registration} timeZone={timeZone} {...pendingCard?.(registration)} />
          ))
        )}
      </section>
      {decided.length > 0 && (
        <section aria-labelledby={decidedId} className="space-y-3">
          <Heading level="section" id={decidedId}>
            Rozpatrzone
          </Heading>
          {decided.map((registration) => (
            <RegistrationCard key={registration.id} registration={registration} timeZone={timeZone} />
          ))}
        </section>
      )}
    </div>
  )
}
