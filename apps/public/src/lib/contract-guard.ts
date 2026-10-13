import type { Match, PublicStat, PublicTournament, StandingRow, StatLeaderboard } from '@tournament/api-client';
import type {
  Leaderboard,
  MatchInRound,
  PublicShellTournament,
  SportCode,
  StandingsTableRow,
  StatOption,
} from '@tournament/ui';

/**
 * Strażnik zgodności typów z design systemu z kontraktem, jak
 * `apps/admin/src/lib/contract-guard.ts`. `packages/ui` nie zna klienta API,
 * więc każdy typ to ręcznie przepisany podzbiór kontraktu. Rozjazd psuje tu
 * `npm run typecheck`, zamiast rozjechać ekran po cichu.
 *
 * Jeżeli tu czerwone: kontrakt się zmienił, więc popraw odpowiedni typ
 * w `packages/ui` (`public-shell-tournament.ts`, `round-groups.ts`,
 * `standings-table-row.ts`, `leaderboard-row.ts`).
 */

/** Turniej z kontraktu daje się pokazać w nagłówku `PublicShell`. */
type ContractFitsShell = PublicTournament extends PublicShellTournament ? true : never;

export const contractFitsShell: ContractFitsShell = true;

/** Mecz z kontraktu daje się pogrupować po kolejce i pokazać w `MatchRow`. */
type ContractFitsMatch = Match extends MatchInRound ? true : never;

export const contractFitsMatch: ContractFitsMatch = true;

/** Wiersz tabeli z kontraktu daje się pokazać w `StandingsTable` i `StandingsSnippet`. */
type ContractFitsStandingsRow = StandingRow extends StandingsTableRow ? true : never;

export const contractFitsStandingsRow: ContractFitsStandingsRow = true;

/** Klasyfikacja z kontraktu daje się pokazać w `LeaderboardTable` i `LeaderboardLeaders`. */
type ContractFitsLeaderboard = StatLeaderboard extends Leaderboard ? true : never;

export const contractFitsLeaderboard: ContractFitsLeaderboard = true;

/** Statystyka turnieju z kontraktu daje się podać do `StatSwitcher`. */
type ContractFitsStatOption = PublicStat extends StatOption ? true : never;

export const contractFitsStatOption: ContractFitsStatOption = true;

/** Kody sportu w DS to dokładnie kody z kontraktu: nowy sport w kontrakcie czerwieni tu, aż DS go pozna. */
type ContractSportCode = PublicTournament['sport']['code'];
type SportCodesMatch = [ContractSportCode] extends [SportCode] ? ([SportCode] extends [ContractSportCode] ? true : never) : never;

export const sportCodesMatch: SportCodesMatch = true;
