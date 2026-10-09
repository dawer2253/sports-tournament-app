/**
 * Walidacja pliku logo turnieju i herbu drużyny przed wysłaniem (#88, #120).
 * Komunikaty brzmią jak w `LogoUploadRequest` backendu (#111 pkt 5), żeby
 * organizer nie widział dwóch wersji tego samego błędu. Wymiary sprawdza tylko
 * serwer: klient musiałby najpierw zdekodować obraz.
 */

/** Typy, które przyjmuje kontrakt. Jak `accept` w `ImageFileField`. */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const MAX_MEGABYTES = 2;
const MAX_BYTES = MAX_MEGABYTES * 1024 * 1024;

/**
 * Rzeczownik w dwóch przypadkach: „Logo musi…" i „plik z logo". Jak
 * `nounForms()` w backendzie, bez dopełniacza: komunikat `uploaded` daje tylko
 * serwer.
 */
export type LogoNounForms = { subject: string; instrumental: string };

export const TOURNAMENT_LOGO: LogoNounForms = { subject: 'Logo', instrumental: 'logo' };

/** Komunikat błędu pliku albo `undefined`, gdy plik może iść do serwera. */
export function logoFileError(file: File | null, { subject, instrumental }: LogoNounForms): string | undefined {
  if (!file) return `Wybierz plik z ${instrumental}.`;
  // `file.type` bierze się z rozszerzenia, a serwer patrzy na treść. Klient
  // zatrzymuje oczywiste pomyłki; podmienione rozszerzenie odrzuci serwer.
  if (!ALLOWED_TYPES.includes(file.type)) return `${subject} musi być plikiem PNG, JPG albo WebP.`;
  if (file.size > MAX_BYTES) return `${subject} może mieć najwyżej ${MAX_MEGABYTES} MB.`;
  return undefined;
}
