import { firstFieldErrors, isValidationError } from '@tournament/api-client';

/**
 * Minimalny kształt `setError` z react-hook-form: nazwa pola albo `root`
 * i komunikat. Generyk po nazwach pól, a nie po typie formularza, bo tylko tyle
 * ta funkcja potrzebuje — i dzięki temu `UseFormSetError` wchodzi tu bez
 * rzutowania.
 */
export type SetFieldError<TField extends string> = (
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
 * @param fallbackMessage komunikat, gdy API nie przysłało żadnego — organizer
 *   nie może zostać z pustym ekranem. Podaje go ekran, bo tylko on wie, czego
 *   nie udało się zrobić.
 */
export function applyApiError<TField extends string>(
  error: unknown,
  fields: readonly TField[],
  setError: SetFieldError<TField>,
  fallbackMessage: string,
): void {
  if (isValidationError(error)) {
    const entries = Object.entries(firstFieldErrors(error));

    const known = entries.filter((entry): entry is [TField, string] =>
      fields.includes(entry[0] as TField),
    );
    for (const [field, message] of known) {
      setError(field, { message });
    }

    // Pola, których formularz nie umie podświetlić, trafiają nad przycisk —
    // także wtedy, gdy obok nich przyszło pole znane. Inaczej organizer
    // poprawia to, co widzi, i dostaje to samo 422 bez wyjaśnienia.
    const unknown = entries.filter(([field]) => !fields.includes(field as TField));

    if (unknown.length > 0) {
      setError('root', { message: unknown.map(([, message]) => message).join(' ') });
      return;
    }

    // 422 z pustą mapą pól: zostaje komunikat ogólny.
    if (known.length === 0) {
      setError('root', { message: error.message || fallbackMessage });
    }

    return;
  }

  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : '';

  setError('root', { message: message || fallbackMessage });
}
