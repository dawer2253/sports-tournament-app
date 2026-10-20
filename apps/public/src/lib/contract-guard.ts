import type {
  Match,
  PublicMatch,
  PublicMatchDetail,
  PublicStat,
  PublicTournament,
  StandingRow,
  StatLeaderboard,
  TeamSummary,
} from '@tournament/api-client';
import type {
  BracketMatch,
  Leaderboard,
  MatchClockSettings,
  MatchClockState,
  MatchInRound,
  MatchPageData,
  PublicBracketMatch,
  PublicShellTournament,
  SetScore,
  ShowcaseTeam,
  SportCode,
  StandingsTableRow,
  StatOption,
} from '@tournament/ui/public';

/**
 * Strażnik zgodności typów z design systemu z kontraktem, jak
 * `apps/admin/src/lib/contract-guard.ts`. `packages/ui` nie zna klienta API,
 * więc każdy typ to ręcznie przepisany podzbiór kontraktu. Rozjazd psuje tu
 * `npm run typecheck`, zamiast rozjechać ekran po cichu.
 *
 * Jeżeli tu czerwone: kontrakt się zmienił, więc popraw odpowiedni typ
 * w `packages/ui` (`src/public/public-shell-tournament.ts`, `round-groups.ts`,
 * `match-row-data.ts`, `match-page-data.ts`, `src/public/standings-table-row.ts`,
 * `src/public/overview-stage.ts`, `leaderboard-data.ts`).
 */

/** Turniej z kontraktu daje się pokazać w nagłówku shella strony publicznej (`Shell`). */
type ContractFitsShell = PublicTournament extends PublicShellTournament ? true : never;

export const contractFitsShell: ContractFitsShell = true;

/** Mecz z kontraktu daje się pogrupować po kolejce i pokazać w `MatchRow`. */
type ContractFitsMatch = Match extends MatchInRound ? true : never;

export const contractFitsMatch: ContractFitsMatch = true;

/** Mecz fazy z kontraktu daje się podać regułom drabinki (`lib/bracket.ts`, #234) i drzewu strony (`BracketTree` z `@tournament/ui/public`, #293). */
type ContractFitsBracketMatch = Match extends BracketMatch ? true : never;

export const contractFitsBracketMatch: ContractFitsBracketMatch = true;

/** Mecz fazy z kontraktu niesie herby drużyn do kafla Drabinki (`BracketTile`, #293). */
type ContractFitsPublicBracketMatch = Match extends PublicBracketMatch ? true : never;

export const contractFitsPublicBracketMatch: ContractFitsPublicBracketMatch = true;

/** Mecz strony publicznej ze strzelcami daje się pokazać w `MatchRow` i na tablicy pasa etapu Przeglądu (`StageMatchBoard`, #208, #296). */
type ContractFitsPublicMatch = PublicMatch extends MatchInRound ? true : never;

export const contractFitsPublicMatch: ContractFitsPublicMatch = true;

/** Strona meczu z kontraktu daje się pokazać w `MatchScreen` (`MatchBoard` i `MatchRelation` z `@tournament/ui/public`, #295). */
type ContractFitsMatchPage = PublicMatchDetail extends MatchPageData ? true : never;

export const contractFitsMatchPage: ContractFitsMatchPage = true;

/** Wiersz tabeli z kontraktu, z formą, daje się pokazać w publicznej `StandingsTable` (#291) na Tabeli i Przeglądzie. */
type ContractFitsStandingsRow = StandingRow extends StandingsTableRow ? true : never;

export const contractFitsStandingsRow: ContractFitsStandingsRow = true;

/** Klasyfikacja z kontraktu daje się pokazać w `StatRanking`, `StatLeaders` i `OtherStatLeaders` (`@tournament/ui/public`), także w bocznej kolumnie Przeglądu. */
type ContractFitsLeaderboard = StatLeaderboard extends Leaderboard ? true : never;

export const contractFitsLeaderboard: ContractFitsLeaderboard = true;

/** Drużyna z `/teams` daje się pokazać w prezentacji drużyn Przeglądu (`TeamsShowcase`, #296). */
type ContractFitsShowcaseTeam = TeamSummary extends ShowcaseTeam ? true : never;

export const contractFitsShowcaseTeam: ContractFitsShowcaseTeam = true;

/** Statystyka turnieju z kontraktu daje się podać do `StatTabs` i `StatsScreen` (`@tournament/ui/public`). */
type ContractFitsStatOption = PublicStat extends StatOption ? true : never;

export const contractFitsStatOption: ContractFitsStatOption = true;

/**
 * Mecz z kontraktu niesie zegar meczu na żywo (#297) w kształcie, z którego
 * `matchClock` liczy minutę. W typach wierszy, tablic i kafli pola są
 * opcjonalne (dane demo), więc dopiero ten strażnik łapie zmianę nazwy pola.
 */
type ContractFitsMatchClock = Match extends MatchClockState ? true : never;

export const contractFitsMatchClock: ContractFitsMatchClock = true;

/** Turniej z kontraktu niesie ustawienia zegara (`periods`, `matchDuration`, `runningClock`) dla `MatchClockProvider`. */
type ContractFitsClockSettings = PublicTournament extends MatchClockSettings ? true : never;

export const contractFitsClockSettings: ContractFitsClockSettings = true;

/** Kody sportu w DS to dokładnie kody z kontraktu: nowy sport w kontrakcie czerwieni tu, aż DS go pozna. */
type ContractSportCode = PublicTournament['sport']['code'];
type SportCodesMatch = [ContractSportCode] extends [SportCode] ? ([SportCode] extends [ContractSportCode] ? true : never) : never;

export const sportCodesMatch: SportCodesMatch = true;

/**
 * Mecz z kontraktu niesie wyniki setów (#301) pod nazwą, z której czytają
 * `MatchRow` i `MatchBoard`. W typach wiersza i tablicy pole jest opcjonalne,
 * więc dopiero ten strażnik łapie zmianę jego nazwy.
 */
type ContractFitsMatchSets = PublicMatch extends { sets: readonly SetScore[] | null } ? true : never;

export const contractFitsMatchSets: ContractFitsMatchSets = true;

/** Wiersz tabeli z kontraktu niesie punkty w setach (#301) pod nazwami z `StandingsTableRow`. */
type ContractFitsRallyPoints = StandingRow extends Required<Pick<StandingsTableRow, 'rallyPointsFor' | 'rallyPointsAgainst'>> ? true : never;

export const contractFitsRallyPoints: ContractFitsRallyPoints = true;
