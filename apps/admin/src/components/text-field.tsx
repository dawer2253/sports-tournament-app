import { Input, Label } from '@tournament/ui';
import { useId, type ComponentProps } from 'react';

type TextFieldProps = ComponentProps<typeof Input> & {
  label: string;
  /** Błąd pola z `zod` albo z `422`; siada pod polem i staje się jego opisem. */
  error?: string;
  /** Podpis pod polem, gdy nie jest błędem, np. „Zmieni długość meczu w całym turnieju”. */
  hint?: string;
};

/**
 * Pole tekstowe formularza: etykieta, pole i błąd pod nim. Błąd jest opisem pola
 * (`aria-describedby`), więc czytnik ekranu przeczyta go razem z etykietą.
 * Id pola powstaje tu, bo okien jest kilka, a pola w nich nazywają się tak samo.
 * Starsze formularze (kreator, ustawienia) mają ten układ jeszcze wypisany ręcznie.
 */
export function TextField({ label, error, hint, ...inputProps }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  return (
    // `content-start`: w siatce kilku pól podpis pod jednym nie rozpycha
    // sąsiada (`apps/admin/AGENTS.md`, „Formularze i okna”).
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
