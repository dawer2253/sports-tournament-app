import type { Player, Team, Tournament, Venue } from '@tournament/api-client';
import type { PlayerRow, TeamRow, TournamentRow, VenueRow } from '@tournament/ui';

/**
 * Strażnik zgodności typów wierszy z design systemu (`TournamentRow`,
 * `TeamRow`, `PlayerRow`, `VenueRow`) z kontraktem.
 *
 * `packages/ui` nie zna klienta API (patrz `packages/ui/AGENTS.md`), więc
 * każdy wiersz jest ręcznie przepisanym podzbiorem typu z kontraktu. Sam z siebie
 * nie pilnuje niczego: gdyby `openapi.yaml` zmienił nazwę pola albo dołożył
 * wartość do `status`, tabela dalej by się kompilowała i rozjechała cicho.
 *
 * Ten plik jest miejscem, w którym taki rozjazd psuje `npm run typecheck`.
 * Nie ma tu kodu wykonywanego — same przypisania typów.
 *
 * Jeżeli tu czerwone: kontrakt się zmienił, więc popraw odpowiedni wiersz
 * w `packages/ui/src/components/data/` (`tournament-row.ts`, `team-row.ts`,
 * `player-row.ts`, `venue-row.ts`).
 */

/**
 * Turniej z kontraktu daje się pokazać jako wiersz tabeli. Jedna asercja
 * wystarcza: łapie zmianę nazwy pola, zmianę jego typu i nową wartość
 * w `status`.
 */
type ContractFitsRow = Tournament extends TournamentRow ? true : never;

export const contractFitsRow: ContractFitsRow = true;

/** Drużyna z kontraktu daje się pokazać jako wiersz `TeamsTable`. */
type ContractFitsTeamRow = Team extends TeamRow ? true : never;

export const contractFitsTeamRow: ContractFitsTeamRow = true;

/** Zawodnik z kontraktu daje się pokazać jako wiersz `PlayersTable`. */
type ContractFitsPlayerRow = Player extends PlayerRow ? true : never;

export const contractFitsPlayerRow: ContractFitsPlayerRow = true;

/**
 * Obiekt z kontraktu daje się pokazać jako wiersz `VenuesTable`. Łapie zmianę
 * nazwy pola i to, że `address` przestaje dopuszczać `null` albo zmienia typ.
 */
type ContractFitsVenueRow = Venue extends VenueRow ? true : never;

export const contractFitsVenueRow: ContractFitsVenueRow = true;
