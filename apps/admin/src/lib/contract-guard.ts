import type { Tournament } from '@tournament/api-client';
import type { TournamentRow } from '@tournament/ui';

/**
 * Strażnik zgodności `TournamentRow` z kontraktem.
 *
 * `packages/ui` nie zna klienta API (patrz `packages/ui/AGENTS.md`), więc
 * `TournamentRow` jest ręcznie przepisanym podzbiorem `Tournament`. Sam z siebie
 * nie pilnuje niczego: gdyby `openapi.yaml` zmienił nazwę pola albo dołożył
 * wartość do `status`, tabela dalej by się kompilowała i rozjechała cicho.
 *
 * Ten plik jest miejscem, w którym taki rozjazd psuje `npm run typecheck`.
 * Nie ma tu kodu wykonywanego — same przypisania typów.
 *
 * Jeżeli tu czerwone: kontrakt się zmienił, więc popraw `TournamentRow`
 * w `packages/ui/src/components/data/tournament-row.ts`.
 */

/**
 * Turniej z kontraktu daje się pokazać jako wiersz tabeli. Jedna asercja
 * wystarcza: łapie zmianę nazwy pola, zmianę jego typu i nową wartość
 * w `status`.
 */
type ContractFitsRow = Tournament extends TournamentRow ? true : never;

export const contractFitsRow: ContractFitsRow = true;
