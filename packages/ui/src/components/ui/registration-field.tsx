import { Input } from './input'
import { Label } from './label'
import { Switch } from './switch'

/**
 * Zapisy w formularzu ustawień (#300): przełącznik organizera i termin jako
 * wartość pola `datetime-local` (czas lokalny, `''` bez terminu). Zamianę na
 * moment z offsetem (ADR-0008) robi aplikacja.
 */
export type RegistrationFieldValue = { open: boolean; deadline: string }

/** Opis sekcji „Zapisy” w ustawieniach: kiedy formularz przyjmuje zgłoszenia (`CONTEXT.md`, „Zapisy”). */
export const REGISTRATION_DESCRIPTION =
  'Formularz zgłoszenia drużyny na stronie turnieju. Przyjmuje zgłoszenia tylko w turnieju opublikowanym, przed pierwszym meczem i przed terminem.'

/**
 * Zdanie pod przełącznikiem, gdy zapisy są otwarte, ale status turnieju nie
 * pozwala na zgłoszenia: w szkicu strony nie ma, a zakończony turniej nie
 * przyjmuje drużyn. Mecz rozpoczęty mówi sam opis sekcji, bo ustawienia go
 * nie znają.
 */
export function registrationNotice(status: 'draft' | 'active' | 'finished', open: boolean): string | undefined {
  if (!open) return undefined
  if (status === 'draft') return 'Turniej jest w szkicu: formularz pojawi się na stronie turnieju po opublikowaniu.'
  if (status === 'finished') return 'Turniej jest zakończony: strona turnieju nie przyjmuje zgłoszeń.'
  return undefined
}

export interface RegistrationFieldProps {
  value: RegistrationFieldValue
  onChange: (value: RegistrationFieldValue) => void
  /** Błędy pod `registration.open` i `registration.deadline`, z klienta albo z `422`. */
  errors?: { open?: string; deadline?: string }
  /**
   * Czy strona publiczna pokaże formularz mimo otwartych zapisów — np. turniej
   * w szkicu albo z meczem rozpoczętym. Zdanie trafia pod przełącznik.
   */
  notice?: string
  disabled?: boolean
}

/**
 * Pole „Zapisy” w ustawieniach turnieju (#300): przełącznik „Zapisy otwarte”
 * i opcjonalny termin, po którym formularz na stronie turnieju przestaje
 * przyjmować zgłoszenia. Termin stoi zawsze, także przy zamkniętych zapisach,
 * żeby dało się go ustawić przed otwarciem.
 */
export function RegistrationField({ value, onChange, errors = {}, notice, disabled }: RegistrationFieldProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <div className="flex items-center gap-3">
          <Switch
            id="registration-open"
            checked={value.open}
            disabled={disabled}
            aria-describedby={[notice && 'registration-notice', errors.open && 'registration-open-error'].filter(Boolean).join(' ') || undefined}
            onCheckedChange={(open) => onChange({ ...value, open })}
          />
          <Label htmlFor="registration-open">Zapisy otwarte</Label>
        </div>
        {notice && (
          <p id="registration-notice" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
        {errors.open && (
          <p id="registration-open-error" className="text-sm text-destructive">
            {errors.open}
          </p>
        )}
      </div>
      <div className="grid w-60 content-start gap-2">
        <Label htmlFor="registration-deadline">Termin zapisów (opcjonalnie)</Label>
        <Input
          id="registration-deadline"
          type="datetime-local"
          value={value.deadline}
          disabled={disabled}
          aria-invalid={errors.deadline ? true : undefined}
          aria-describedby={['registration-deadline-hint', errors.deadline && 'registration-deadline-error'].filter(Boolean).join(' ')}
          onChange={(event) => onChange({ ...value, deadline: event.target.value })}
        />
        <p id="registration-deadline-hint" className="text-xs text-muted-foreground">
          Po tej chwili formularz nie przyjmie zgłoszenia. Puste pole: bez terminu.
        </p>
        {errors.deadline && (
          <p id="registration-deadline-error" className="text-sm text-destructive">
            {errors.deadline}
          </p>
        )}
      </div>
    </div>
  )
}
