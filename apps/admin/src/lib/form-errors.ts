import { firstFieldErrors, isValidationError } from '@tournament/api-client';

/** Komunikat, gdy API nie przysłało żadnego — organizer nie może zostać z pustym ekranem. */
const FALLBACK_MESSAGE = 'Nie udało się założyć turnieju. Spróbuj ponownie.';

/**
 * Minimalny kształt `setError` z react-hook-form: nazwa pola albo `root`
 * i komunikat. Generyk po nazwach pól, a nie po typie formularza, bo tylko tyle
 * ta funkcja potrzebuje — i dzięki temu `UseFormSetError` wchodzi tu bez
 * rzutowania.
 */
type SetFieldError<TField extends string> = (
  field: TField | 'root',
  error: { message: string },
) => void;

/**
 * Przekłada odpowiedź błędu z API na błędy formularza.
 *
 * Reguła jest jedna: żaden komunikat nie może przepaść. Błąd pola, które
 * formularz zna, siada przy tym polu; błąd pola nieznanego (bo kontrakt
 * wyprzedził panel) i zwykły błąd z samym `message` lądują w `root`, czyli nad
 * przyciskiem. Milczący formularz jest gorszy niż komunikat w złym miejscu.
 *
 * @param fields nazwy pól, które formularz umie podświetlić
 */
export function applyApiError<TField extends string>(
  error: unknown,
  fields: readonly TField[],
  setError: SetFieldError<TField>,
): void {
  if (isValidationError(error)) {
    const entries = Object.entries(firstFieldErrors(error));

    const known = entries.filter((entry): entry is [TField, string] =>
      fields.includes(entry[0] as TField),
    );
    for (const [field, message] of known) {
      setError(field, { message });
    }

    if (known.length > 0) return;

    // 422 bez pola, które formularz zna: pierwszy komunikat z mapy mówi więcej
    // niż ogólne „Podane dane są nieprawidłowe.", więc bierzemy go, gdy jest.
    setError('root', { message: entries[0]?.[1] || error.message || FALLBACK_MESSAGE });
    return;
  }

  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : '';

  setError('root', { message: message || FALLBACK_MESSAGE });
}
