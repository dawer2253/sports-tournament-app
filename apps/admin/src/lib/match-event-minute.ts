import { parseEventMinute } from '@tournament/ui';

/** Komunikat przy polu „Minuta”, gdy wpis nie jest ani „67”, ani „45+3” (#317). */
export const BAD_MINUTE = 'Minuta to liczba od 1 do 150, np. 67 albo 45+3.';

/** Wpis w polu „Minuta” nie jest minutą: błąd siada przy polu bez wizyty na serwerze. */
export class MinuteError extends Error {
  constructor() {
    super(BAD_MINUTE);
  }
}

/** Minuta i doliczony czas z pola tekstowego; rzuca `MinuteError` przy złym wpisie. */
export function minuteFromField(text: string): { minute: number | null; addedTime: number | null } {
  const at = parseEventMinute(text);
  if (at === null) throw new MinuteError();
  return at;
}
