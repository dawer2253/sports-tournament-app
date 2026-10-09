/**
 * Id bytu z adresu (`:id`, `:teamId`) albo `null`, gdy nie jest dodatnią
 * liczbą całkowitą.
 *
 * Adres pochodzi z paska przeglądarki, więc może być czymkolwiek. Id spoza
 * zakresu nie idzie do API, tylko od razu kończy się stanem „nie ma” — takiego
 * bytu i tak nie ma w bazie. Sprawdzamy zapis, a nie samą wartość po
 * `Number()`, bo ten przyjmuje też `1e3` czy `0x10` i zapytałby API o zupełnie
 * inny byt niż ten z adresu.
 */
export function parseRouteId(raw: string | undefined): number | null {
  const id = Number(raw);
  return /^[1-9]\d*$/.test(raw ?? '') && Number.isSafeInteger(id) ? id : null;
}
