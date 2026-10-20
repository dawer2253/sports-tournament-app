/**
 * Ekran zgłoszenia drużyny strony publicznej (#300): formularz, zapisy
 * zamknięte i potwierdzenie po wysłaniu. Dane w propsach (#289 pkt 8):
 * strona w `apps/public` wysyła zgłoszenie i podaje ekranowi błędy
 * z odpowiedzi `422` pod kluczami z kontraktu (`teamName`,
 * `players.0.number`…). Ekran sam niczego nie waliduje — reguły zna API.
 */
import * as React from 'react'
import { EmptyBoard } from '../board'
import { Button, TextLink } from '../button'
import { CheckboxField, FieldError, TextField } from '../fields'
import { PageHead, SectionHead } from '../heads'
import { registrationDeadline } from '../registration'

/** Najwięcej zawodników w składzie zgłoszenia, jak w drużynie (`TeamRegistrationCreate.players`). */
export const REGISTRATION_MAX_PLAYERS = 50

export interface RegistrationPlayerDraft {
  name: string
  /** Napis z pola; liczbę robi z niego strona przed wysłaniem. */
  number: string
}

/** Formularz w kształcie pól, zanim strona zrobi z niego `TeamRegistrationCreate`. */
export interface RegistrationDraft {
  teamName: string
  contactName: string
  contactEmail: string
  contactPhone: string
  players: RegistrationPlayerDraft[]
  consent: boolean
  /** Pole-pułapka: człowiek go nie widzi, więc zostaje puste. */
  website: string
}

export const EMPTY_REGISTRATION: RegistrationDraft = {
  teamName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  players: [],
  consent: false,
  website: '',
}

/** Błędy pod kluczami z kontraktu → komunikat pod polem. */
export type RegistrationErrors = Readonly<Record<string, string>>

const FIELD_KEYS = ['teamName', 'contactName', 'contactEmail', 'contactPhone', 'consent', 'players']

/** Czy błąd ma swoje pole w formularzu; reszta (np. `registration`) idzie nad formularz. */
function isFieldKey(key: string): boolean {
  return FIELD_KEYS.includes(key) || /^players\.\d+\.(name|number)$/.test(key)
}

/** Grupa pól z belką sekcji jako nazwą grupy. */
function FormSection({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  const id = React.useId()
  return (
    <fieldset aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <SectionHead id={id} title={title} sub={sub} />
      {children}
    </fieldset>
  )
}

export interface RegistrationScreenProps {
  /** Termin zapisów (`PublicRegistration.deadline`). */
  deadline: string | null
  timeZone?: string
  errors?: RegistrationErrors
  /** Komunikat zbiorczy nad formularzem, np. treść `422` albo `429`. */
  formError?: string
  submitting?: boolean
  onSubmit: (draft: RegistrationDraft) => void
  /** Stan początkowy pól, np. w story z błędami. */
  initialDraft?: RegistrationDraft
}

/**
 * Formularz zgłoszenia: drużyna, osoba kontaktowa, skład (opcjonalny,
 * wiersz po wierszu) i zgoda. Błędy z API stoją pod polami, a błąd bez
 * pola i komunikat zbiorczy w tablicy nad formularzem (`role="alert"`).
 */
export function RegistrationScreen({ deadline, timeZone, errors = {}, formError, submitting = false, onSubmit, initialDraft = EMPTY_REGISTRATION }: RegistrationScreenProps) {
  const [draft, setDraft] = React.useState(initialDraft)
  const headId = React.useId()
  const until = registrationDeadline(deadline, timeZone)
  const general = [formError, ...Object.entries(errors).filter(([key]) => !isFieldKey(key)).map(([, message]) => message)].filter(
    (message, index, all): message is string => Boolean(message) && all.indexOf(message) === index,
  )

  const set = <K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const setPlayer = (index: number, patch: Partial<RegistrationPlayerDraft>) =>
    set(
      'players',
      draft.players.map((player, at) => (at === index ? { ...player, ...patch } : player)),
    )

  return (
    <section aria-labelledby={headId} data-slot="registration" className="flex flex-col gap-8">
      <PageHead id={headId} eyebrow="Zapisy" title="Zgłoś drużynę" meta={until && <span>Zgłoszenia {until}</span>} />

      <form
        noValidate
        aria-labelledby={headId}
        className="flex max-w-2xl flex-col gap-10"
        onSubmit={(event) => {
          event.preventDefault()
          if (!submitting) onSubmit(draft)
        }}
      >
        {general.length > 0 && (
          <div role="alert" data-slot="registration-alert" className="flex flex-col gap-1 rounded-md bg-sunken px-5 py-4 ring-1 ring-destructive ring-inset">
            {general.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        )}

        <FormSection title="Drużyna">
          <TextField
            label="Nazwa drużyny"
            name="teamName"
            autoComplete="organization"
            maxLength={120}
            value={draft.teamName}
            error={errors.teamName}
            onChange={(event) => set('teamName', event.target.value)}
          />
        </FormSection>

        <FormSection title="Osoba kontaktowa" sub="Z tymi danymi organizator skontaktuje się w sprawie zgłoszenia. Nie pokazujemy ich na stronie.">
          <TextField
            label="Imię i nazwisko"
            name="contactName"
            autoComplete="name"
            maxLength={120}
            hint="Np. kapitan albo trener drużyny."
            value={draft.contactName}
            error={errors.contactName}
            onChange={(event) => set('contactName', event.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="E-mail"
              name="contactEmail"
              type="email"
              autoComplete="email"
              maxLength={254}
              value={draft.contactEmail}
              error={errors.contactEmail}
              onChange={(event) => set('contactEmail', event.target.value)}
            />
            <TextField
              label="Telefon"
              optional
              name="contactPhone"
              type="tel"
              autoComplete="tel"
              maxLength={40}
              value={draft.contactPhone}
              error={errors.contactPhone}
              onChange={(event) => set('contactPhone', event.target.value)}
            />
          </div>
        </FormSection>

        <FormSection title="Skład" sub="Opcjonalnie. Organizator może dopisać zawodników później.">
          {draft.players.length > 0 && (
            <ol className="flex flex-col gap-3">
              {draft.players.map((player, index) => {
                const n = index + 1
                return (
                  <li key={index} data-slot="registration-player" className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_6rem_auto]">
                    <TextField
                      label={`Zawodnik ${n}`}
                      maxLength={120}
                      value={player.name}
                      error={errors[`players.${index}.name`]}
                      onChange={(event) => setPlayer(index, { name: event.target.value })}
                    />
                    <TextField
                      label="Numer"
                      aria-label={`Numer zawodnika ${n}`}
                      inputMode="numeric"
                      maxLength={3}
                      value={player.number}
                      error={errors[`players.${index}.number`]}
                      onChange={(event) => setPlayer(index, { number: event.target.value })}
                    />
                    <Button
                      aria-label={`Usuń zawodnika ${n}`}
                      className="col-span-2 justify-self-start sm:col-span-1 sm:mt-[1.875rem]"
                      onClick={() =>
                        set(
                          'players',
                          draft.players.filter((_, at) => at !== index),
                        )
                      }
                    >
                      Usuń
                    </Button>
                  </li>
                )
              })}
            </ol>
          )}
          {errors.players && <FieldError id={`${headId}-sklad-blad`}>{errors.players}</FieldError>}
          {draft.players.length < REGISTRATION_MAX_PLAYERS && (
            <Button className="self-start" onClick={() => set('players', [...draft.players, { name: '', number: '' }])}>
              Dodaj zawodnika
            </Button>
          )}
        </FormSection>

        {/* Pole-pułapka (#300): poza ekranem i poza kolejnością fokusu, więc
            wypełnia je tylko bot. Czytniki ekranu go nie widzą. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Strona internetowa
            <input name="website" tabIndex={-1} autoComplete="off" value={draft.website} onChange={(event) => set('website', event.target.value)} />
          </label>
        </div>

        <CheckboxField name="consent" checked={draft.consent} error={errors.consent} onChange={(event) => set('consent', event.target.checked)}>
          Zgadzam się na przetwarzanie moich danych kontaktowych przez organizatora turnieju w celu rozpatrzenia zgłoszenia.
        </CheckboxField>

        <Button type="submit" disabled={submitting} className="self-start disabled:opacity-60">
          {submitting ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
        </Button>
      </form>
    </section>
  )
}

/** Adres powrotu na Przegląd w kształcie propsów `Anchor`. */
interface BackProps {
  backHref?: string
  onBack?: () => void
}

/** Zapisy zamknięte: formularza nie ma, jest powrót na Przegląd. Tak też pod bezpośrednim adresem. */
export function RegistrationClosed({ backHref, onBack }: BackProps) {
  return (
    <EmptyBoard
      title="Zapisy są zamknięte"
      action={
        <TextLink href={backHref} onNavigate={onBack}>
          Wróć do przeglądu
        </TextLink>
      }
    >
      Ten turniej nie przyjmuje teraz zgłoszeń drużyn. Jeśli chcesz zagrać, skontaktuj się z organizatorem.
    </EmptyBoard>
  )
}

/** Potwierdzenie po wysłaniu: drużyna czeka na decyzję, a kontakt przyjdzie od organizatora. */
export function RegistrationSent({ teamName, backHref, onBack }: BackProps & { teamName: string }) {
  return (
    <div role="status" className="contents">
      <EmptyBoard
        title="Zgłoszenie wysłane"
        action={
          <TextLink href={backHref} onNavigate={onBack}>
            Wróć do przeglądu
          </TextLink>
        }
      >
        Drużyna „{teamName}” czeka na decyzję organizatora. Organizator skontaktuje się z tobą mailem albo telefonem podanym w zgłoszeniu.
      </EmptyBoard>
    </div>
  )
}
