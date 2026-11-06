/** Demo jest lokalne i polskie, więc strefa jest na sztywno, nie z systemu. */
export const TIME_ZONE = 'Europe/Warsaw';

const offsetFormat = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, timeZoneName: 'longOffset' });

/** Przesunięcie strefy względem UTC w danej chwili, w minutach („GMT+01:00” → 60). */
function offsetMinutes(instant: number): number {
  const name = offsetFormat.formatToParts(instant).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) {
    return 0;
  }
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
  return `${sign}${hours}:${String(absolute % 60).padStart(2, '0')}`;
}

/**
 * Składa `date-time` z offsetem dla godziny zegarowej w Warszawie tego dnia:
 * `2026-11-01` + `18:00` → `2026-11-01T18:00:00+01:00`. Offset bierze się
 * z dnia meczu, nie z dnia uruchomienia, bo API bez offsetu odpowiada `422`
 * (ADR-0008), a zły offset przesunąłby start o godzinę.
 */
export function warsawDateTime(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  // Drugie przybliżenie trafia w offset obowiązujący w tej chwili także
  // w dniu zmiany czasu, gdy offset o północy różni się od tego wieczorem.
  const guess = offsetMinutes(wallClockAsUtc);
  const offset = offsetMinutes(wallClockAsUtc - guess * 60_000);
  return `${date}T${time}:00${formatOffset(offset)}`;
}

const localFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Chwila z API (w UTC) jako warszawska data i godzina: `2026-11-01 18:00`. */
export function warsawLocal(instant: string): string {
  return localFormat.format(new Date(instant));
}

const longFormat = new Intl.DateTimeFormat('pl-PL', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Ta sama chwila słowami, do podsumowania w czacie: „niedziela, 1 listopada 2026 18:00”. */
export function warsawLong(instant: string): string {
  return longFormat.format(new Date(instant));
}
