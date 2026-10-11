import type { Match } from '@tournament/api-client';
import { formatRoundDates, type RoundSummary } from '@tournament/ui';

/** Kolejka terminarza złożona z meczów: kontrakt nie ma listy kolejek (#162, pkt 14). */
export interface ScheduleRound {
  id: number;
  name: string;
  order: number;
  /** Mecze kolejki po `matchNumber`. */
  matches: Match[];
  /** To, co pokazuje `RoundList`. */
  summary: RoundSummary;
}

/**
 * Kolejki fazy z jej meczów, po `round.order`, a w kolejce po `matchNumber`.
 * Kolejka bez meczów (n ≤ 3 po usunięciu drużyny, #161) nie powstaje wcale,
 * bo nie ma z czego jej złożyć. Numery mogą mieć dziury, więc liczy się
 * kolejność, a nie wartość numeru.
 *
 * `timeZone` tylko dla testów; panel pokazuje strefę przeglądarki (ADR-0008).
 */
export function scheduleRounds(matches: readonly Match[], timeZone?: string): ScheduleRound[] {
  const byRound = new Map<number, Match[]>();
  for (const match of matches) {
    byRound.set(match.round.id, [...(byRound.get(match.round.id) ?? []), match]);
  }

  return [...byRound.values()]
    .map((roundMatches) => {
      const { id, name, order } = roundMatches[0]!.round;
      const sorted = roundMatches.toSorted((a, b) => a.matchNumber - b.matchNumber);
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
 * Kolejka otwierana bez `?round=`: pierwsza z meczem innym niż `finished`,
 * czyli ta, nad którą organizer właśnie pracuje (#162, pkt 1). Po sezonie
 * zostaje ostatnia.
 */
export function defaultRound(rounds: readonly ScheduleRound[]): ScheduleRound | undefined {
  return rounds.find((round) => round.matches.some((match) => match.status !== 'finished')) ?? rounds.at(-1);
}

/** Czy któryś mecz jest rozpoczęty — wtedy terminarza nie wolno już wygenerować ponownie (#157). */
export function hasStartedMatches(matches: readonly Match[]): boolean {
  return matches.some((match) => match.status === 'live' || match.status === 'finished');
}

/**
 * Drużyny, które nie grają w żadnym meczu terminarza: dodane po jego
 * wygenerowaniu (#161). Bez terminarza lista jest pusta, bo ten stan ekran
 * pokazuje inaczej (pusty stan z generowaniem).
 */
export function teamsWithoutMatches<T extends { id: number }>(teams: readonly T[], matches: readonly Match[]): T[] {
  if (matches.length === 0) return [];
  const playing = new Set(matches.flatMap((match) => [match.homeTeam?.id, match.awayTeam?.id]));
  return teams.filter((team) => !playing.has(team.id));
}

/**
 * Rozmiar terminarza „każdy z każdym” przed wygenerowaniem, do opisu opcji
 * w oknie: n − 1 kolejek przy parzystym n, n przy nieparzystym (pauza), razy
 * liczba spotkań.
 */
export function roundRobinSize(teams: number, meetings: 1 | 2): { roundsCount: number; matchesCount: number } {
  return {
    roundsCount: (teams % 2 === 0 ? teams - 1 : teams) * meetings,
    matchesCount: ((teams * (teams - 1)) / 2) * meetings,
  };
}
