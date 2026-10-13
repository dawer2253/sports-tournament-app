import type { AdminMatch, Stage } from '@tournament/api-client';
import {
  bracketSize,
  bracketWinnerSide,
  byesCount,
  formatRoundDates,
  type BracketMatchRowData,
  type BracketSlot,
  type RoundSummary,
} from '@tournament/ui';
import { plural, TEAMS } from './plural';

/**
 * Drabinka panelu złożona z meczów fazy (#227). Kontrakt nie ma listy rund
 * ani etykiet pozycji, więc wszystko poniżej wyprowadza się z kompletu meczów
 * i ich krawędzi, tak jak przewiduje ADR-0004.
 */

/**
 * Turniej w formacie `knockout`: same fazy pucharowe. Format nie jest polem
 * turnieju, mówią o nim wyłącznie fazy (ADR-0002, „Format” w `CONTEXT.md`).
 * W takim turnieju Drabinka zastępuje Terminarz.
 */
export function isKnockoutOnly(stages: readonly Stage[]): boolean {
  return stages.length > 0 && stages.every((stage) => stage.type === 'knockout');
}

/** Runda drabinki: mecze w kolejności gry i to, co pokazują karty rund. */
export interface BracketRound {
  id: number;
  name: string;
  order: number;
  /** Mecz o 3. miejsce przed finałem, dalej po `matchNumber`. */
  matches: AdminMatch[];
  summary: RoundSummary;
}

/** Mecz o 3. miejsce: prowadzą do niego krawędzie przegranego. Osobnej flagi nie ma. */
export function isThirdPlaceMatch(match: AdminMatch, matches: readonly AdminMatch[]): boolean {
  return matches.some((candidate) => candidate.loserToMatchId === match.id);
}

/**
 * Etykieta pozycji meczu, której nie ma w danych: „Półfinał 1”, „Finał”,
 * „Mecz o 3. miejsce”. Numer to pozycja w pełnej drabince, więc w pierwszej
 * rundzie ma dziury po wolnych losach i tak zostaje w etykiecie.
 */
export function matchLabel(match: AdminMatch, matches: readonly AdminMatch[]): string {
  if (isThirdPlaceMatch(match, matches)) return 'Mecz o 3. miejsce';
  return match.round.name === 'Finał' ? 'Finał' : `${match.round.name} ${match.matchNumber}`;
}

/** Skąd przyjdzie drużyna do pustego slotu: „Zwycięzca: Półfinał 1”. */
function slotSource(match: AdminMatch, side: 'home' | 'away', matches: readonly AdminMatch[]): string | undefined {
  const winner = matches.find((source) => source.winnerToMatchId === match.id && source.advancesToSlot === side);
  if (winner) return `Zwycięzca: ${matchLabel(winner, matches)}`;
  const loser = matches.find((source) => source.loserToMatchId === match.id && source.advancesToSlot === side);
  if (loser) return `Przegrany: ${matchLabel(loser, matches)}`;
  return undefined;
}

function slot(match: AdminMatch, side: 'home' | 'away', matches: readonly AdminMatch[]): BracketSlot {
  const team = side === 'home' ? match.homeTeam : match.awayTeam;
  return { team: team && { id: team.id, name: team.name }, source: slotSource(match, side, matches) };
}

/** Wiersz meczu drabinki z gotowymi napisami dla `BracketMatchRow`. */
export function bracketRow(match: AdminMatch, matches: readonly AdminMatch[]): BracketMatchRowData {
  const next = matches.find((candidate) => candidate.id === match.winnerToMatchId);
  return {
    id: match.id,
    label: matchLabel(match, matches),
    kickoffAt: match.kickoffAt,
    status: match.status,
    home: slot(match, 'home', matches),
    away: slot(match, 'away', matches),
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    homePenalties: match.homePenalties,
    awayPenalties: match.awayPenalties,
    winnerTo: next && matchLabel(next, matches),
    loserTo: match.loserToMatchId !== null ? 'o 3. miejsce' : undefined,
  };
}

/**
 * Rundy fazy po `order`. W rundzie finału mecz o 3. miejsce idzie przed
 * finałem, bo gra wcześniej (rozkład dat daje mu termin przed nim), a dalej
 * mecze stoją po `matchNumber`.
 *
 * `timeZone` tylko dla testów; panel pokazuje strefę przeglądarki (ADR-0008).
 */
export function bracketRounds(matches: readonly AdminMatch[], timeZone?: string): BracketRound[] {
  const byRound = new Map<number, AdminMatch[]>();
  for (const match of matches) {
    byRound.set(match.round.id, [...(byRound.get(match.round.id) ?? []), match]);
  }

  return [...byRound.values()]
    .map((roundMatches) => {
      const { id, name, order } = roundMatches[0]!.round;
      const sorted = roundMatches.toSorted(
        (a, b) =>
          Number(isThirdPlaceMatch(b, matches)) - Number(isThirdPlaceMatch(a, matches)) || a.matchNumber - b.matchNumber,
      );
      return {
        id,
        name,
        order,
        matches: sorted,
        summary: {
          id,
          name,
          dates: formatRoundDates(
            sorted.map((match) => match.kickoffAt),
            timeZone,
          ),
          finished: sorted.filter((match) => match.status === 'finished').length,
          total: sorted.length,
        },
      };
    })
    .toSorted((a, b) => a.order - b.order);
}

/**
 * Wolne losy: drużyny postawione w meczu drugiej rundy bez krawędzi
 * prowadzącej do ich slotu, z etykietą tego meczu.
 */
export function bracketByes(matches: readonly AdminMatch[]): { team: string; target: string }[] {
  return matches
    .filter((match) => match.round.order === 2)
    .toSorted((a, b) => a.matchNumber - b.matchNumber)
    .flatMap((match) =>
      (['home', 'away'] as const).flatMap((side) => {
        const team = side === 'home' ? match.homeTeam : match.awayTeam;
        const fed = matches.some((source) => source.winnerToMatchId === match.id && source.advancesToSlot === side);
        return team && !fed ? [{ team: team.name, target: matchLabel(match, matches) }] : [];
      }),
    );
}

/** Mistrz: zwycięzca finału (ostatnia runda, nie mecz o 3. miejsce), jeśli już jest. */
export function bracketChampion(matches: readonly AdminMatch[]): { id: number; name: string } | null {
  const lastOrder = Math.max(0, ...matches.map((match) => match.round.order));
  const final = matches.find((match) => match.round.order === lastOrder && !isThirdPlaceMatch(match, matches));
  if (!final) return null;
  const side = bracketWinnerSide(final);
  const team = side === 'home' ? final.homeTeam : side === 'away' ? final.awayTeam : null;
  return team && { id: team.id, name: team.name };
}

const BYES = ['wolny los', 'wolne losy', 'wolnych losów'] as const;

/** „6 drużyn: drabinka na 8, 2 wolne losy dla najwyżej rozstawionych.” */
export function bracketSizeSentence(teams: number): string {
  const byes = byesCount(teams);
  const head = `${teams} ${plural(teams, TEAMS)}: drabinka na ${bracketSize(teams)}`;
  return byes > 0 ? `${head}, ${byes} ${plural(byes, BYES)} dla najwyżej rozstawionych.` : `${head}.`;
}
