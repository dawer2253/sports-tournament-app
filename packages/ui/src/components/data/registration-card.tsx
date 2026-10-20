import * as React from 'react'
import { Badge } from '../ui/badge'
import { Card, CardContent } from '../ui/card'
import { Heading } from '../ui/typography'
import type { RegistrationRow } from './registration-row'

const DECISION: Record<Exclude<RegistrationRow['status'], 'pending'>, { label: string; variant: 'default' | 'outline' }> = {
  accepted: { label: 'Przyjęte', variant: 'default' },
  rejected: { label: 'Odrzucone', variant: 'outline' },
}

export interface RegistrationCardProps {
  registration: RegistrationRow
  /** Strefa dat; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** „Przyjmij” i „Odrzuć” przy zgłoszeniu oczekującym. */
  actions?: React.ReactNode
  /** Uwaga nad akcjami, np. o skutkach przyjęcia po ustaleniu grup. */
  note?: string
  /** Błąd przyjęcia albo odrzucenia, przy zgłoszeniu, którego dotyczy. */
  error?: string
}

/** Chwila zgłoszenia albo decyzji, „10 paź, 19:42”: bez dnia tygodnia, bo liczy się kiedy, nie jaki to dzień. */
function formatDecisionTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(iso))
}

/**
 * Zgłoszenie drużyny w panelu (#300): nazwa drużyny, kiedy przyszło, osoba
 * kontaktowa z odnośnikami do maila i telefonu i skład. Zgłoszenie
 * rozpatrzone ma etykietę decyzji i jej datę; odrzucone nie ma już danych
 * osobowych, więc zostaje sama nazwa.
 */
export function RegistrationCard({ registration, timeZone, actions, note, error }: RegistrationCardProps) {
  const id = React.useId()
  const { contact, players } = registration
  const decision = registration.status === 'pending' ? null : DECISION[registration.status]

  return (
    <Card data-slot="registration-card" role="article" aria-labelledby={id}>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <Heading level="card" id={id}>
            {registration.teamName}
          </Heading>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {decision && <Badge variant={decision.variant}>{decision.label}</Badge>}
            <span>
              {decision && registration.decidedAt
                ? `${decision.label} ${formatDecisionTime(registration.decidedAt, timeZone)}`
                : `Zgłoszone ${formatDecisionTime(registration.createdAt, timeZone)}`}
            </span>
          </div>
        </div>

        {contact && (
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
            <dt className="text-muted-foreground">Osoba kontaktowa</dt>
            <dd>{contact.name}</dd>
            <dt className="text-muted-foreground">E-mail</dt>
            <dd>
              <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
            </dd>
            {contact.phone && (
              <>
                <dt className="text-muted-foreground">Telefon</dt>
                <dd>
                  <a className="text-primary underline-offset-4 hover:underline" href={`tel:${contact.phone.replace(/\s/g, '')}`}>
                    {contact.phone}
                  </a>
                </dd>
              </>
            )}
          </dl>
        )}

        {contact &&
          (players.length > 0 ? (
            <div className="space-y-1">
              <p className="text-sm font-medium">Skład</p>
              <ul aria-label={`Skład: ${registration.teamName}`} className="grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
                {players.map((player, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="w-7 shrink-0 text-right text-muted-foreground tabular-nums">{player.number ?? '–'}</span>
                    <span className="min-w-0 truncate">{player.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Bez składu — zawodników dopiszesz po przyjęciu.</p>
          ))}

        {note && <p className="text-sm text-muted-foreground">{note}</p>}
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
