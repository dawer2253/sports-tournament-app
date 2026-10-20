import type { AdminMatch, Match, MatchEvent, Player, SportEventType, StandingRow, Team, TeamRegistration, Tournament, Venue } from '@tournament/api-client';
import type { BracketMatch, BracketScore, EventTypeOption, MatchEventRow, MatchRowData, PlayerRow, RegistrationRow, RosterPlayer, SeedingTeam, StandingsTableRow, TeamRow, TournamentRow, VenueRow } from '@tournament/ui';

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
 * `player-row.ts`, `venue-row.ts`, `standings-table-row.ts`,
 * `match-row-data.ts`, `seeding-list.tsx`) albo w `lib/bracket.ts`.
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

/** Zgłoszenie z kontraktu daje się pokazać w `RegistrationCard` (#300). */
type ContractFitsRegistrationRow = TeamRegistration extends RegistrationRow ? true : never;

export const contractFitsRegistrationRow: ContractFitsRegistrationRow = true;

/** Wiersz tabeli z kontraktu daje się pokazać w `StandingsTable`. */
type ContractFitsStandingsRow = StandingRow extends StandingsTableRow ? true : never;

export const contractFitsStandingsRow: ContractFitsStandingsRow = true;

/**
 * Mecz z kontraktu daje się pokazać w `MatchRow`. Łapie zmianę nazwy pola,
 * nową wartość w `status` i `null` dopuszczony w polu, w którym wiersz go nie
 * przewiduje.
 */
type ContractFitsMatchRow = Match extends MatchRowData ? true : never;

export const contractFitsMatchRow: ContractFitsMatchRow = true;

/**
 * Mecz panelu (`AdminMatch`) niesie dodatkowo `collisions` (#175), więc musi
 * dać się pokazać w tym samym wierszu `MatchRow`. Łapie rozjazd kształtu
 * kolizji i to, że `collisions` przestaje być opcjonalne w wierszu.
 */
type ContractFitsAdminMatchRow = AdminMatch extends MatchRowData ? true : never;

export const contractFitsAdminMatchRow: ContractFitsAdminMatchRow = true;

/**
 * Zdarzenie z kontraktu daje się pokazać na osi meczu (`MatchTimeline`, #200).
 * Łapie zmianę nazwy pola i `player` albo `minute`, które przestają dopuszczać
 * `null`.
 */
type ContractFitsMatchEventRow = MatchEvent extends MatchEventRow ? true : never;

export const contractFitsMatchEventRow: ContractFitsMatchEventRow = true;

/** Typ zdarzenia sportu daje się pokazać jako przycisk (`EventTypeButtons`). */
type ContractFitsEventTypeOption = SportEventType extends EventTypeOption ? true : never;

export const contractFitsEventTypeOption: ContractFitsEventTypeOption = true;

/** Zawodnik z kontraktu daje się pokazać w siatce numerów (`PlayerNumberGrid`). */
type ContractFitsRosterPlayer = Player extends RosterPlayer ? true : never;

export const contractFitsRosterPlayer: ContractFitsRosterPlayer = true;

/** Drużyna z kontraktu daje się postawić na liście rozstawienia (#227). */
type ContractFitsSeedingTeam = Team extends SeedingTeam ? true : never;

export const contractFitsSeedingTeam: ContractFitsSeedingTeam = true;

/**
 * Mecz z kontraktu niesie wynik z karnymi w kształcie, z którego
 * `bracketWinnerSide` liczy zwycięzcę (#227).
 */
type ContractFitsBracketScore = AdminMatch extends BracketScore ? true : never;

export const contractFitsBracketScore: ContractFitsBracketScore = true;

/**
 * Mecz z kontraktu daje się podać regułom odczytu drabinki z design systemu
 * (`matchLabel`, `bracketByes`, `bracketChampion`, #234) wprost.
 */
type ContractFitsBracketMatch = AdminMatch extends BracketMatch ? true : never;

export const contractFitsBracketMatch: ContractFitsBracketMatch = true;
