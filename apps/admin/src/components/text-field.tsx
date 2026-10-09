import { Input, Label } from '@tournament/ui';
import { useId, type ComponentProps } from 'react';

type TextFieldProps = ComponentProps<typeof Input> & {
  label: string;
  /** Błąd pola z `zod` albo z `422`; siada pod polem i staje się jego opisem. */
  error?: string;
};

/**
 * Pole tekstowe formularza: etykieta, pole i błąd pod nim. Błąd jest opisem pola
 * (`aria-describedby`), więc czytnik ekranu przeczyta go razem z etykietą.
 * Id pola powstaje tu, bo okien jest kilka, a pola w nich nazywają się tak samo.
 * Starsze formularze (kreator, ustawienia) mają ten układ jeszcze wypisany ręcznie.
 */
export function TextField({ label, error, ...inputProps }: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
