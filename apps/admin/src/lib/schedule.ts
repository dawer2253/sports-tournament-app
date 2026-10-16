import type { AdminMatch } from '@tournament/api-client';
import { collisionLabel, formatKickoff, formatRoundDates, type MatchCollision, type RoundSummary } from '@tournament/ui';

/**
 * Mecz terminarza panelu: `AdminMatch` z kolizjami wzbogaconymi o opis drugiej
 * strony pary. Kontrakt zna tylko `matchId`, więc tytuł do plakietki dokłada
 * panel, który ma cały komplet meczów (#175).
 */
export type ScheduleMatch = Omit<AdminMatch, 'collisions'> & { collisions: MatchCollision[] };

/** Kolejka terminarza złożona z meczów: kontrakt nie ma listy kolejek (#162, pkt 14). */
export interface ScheduleRound {
  id: number;
  name: string;
  order: number;
  /** Mecze kolejki po `matchNumber`. */
  matches: ScheduleMatch[];
  /** To, co pokazuje `RoundList`. */
  summary: RoundSummary;
}

/**
 * Dokłada kolizjom opis drugiej strony pary (`MatchCollision.title`), którego
 * kontrakt nie niesie (#158). Mecz drugiej strony może wypaść z odpowiedzi
 * (np. filtr po fazie), więc wtedy tytuł zostaje przy samym rodzaju.
 */
export function withCollisionTitles(matches: readonly AdminMatch[]): ScheduleMatch[] {
  const byId = new Map(matches.map((match) => [match.id, match]));

  return matches.map((match) => ({
    ...match,
    collisions: match.collisions.map((collision) => {
      const other = byId.get(collision.matchId);
      if (!other) return collision;
      const described = `${other.homeTeam?.name ?? 'Do ustalenia'} – ${other.awayTeam?.name ?? 'Do ustalenia'} (${other.round.name}, ${formatKickoff(other.kickoffAt)})`;
      return { ...collision, title: `${collisionLabel(collision.type)}: ${described}` };
    }),
  }));
}

/**
 * Kolejki fazy z jej meczów, po `round.order`, a w kolejce po `matchNumber`.
 * Kolejka bez meczów (n ≤ 3 po usunięciu drużyny, #161) nie powstaje wcale,
 * bo nie ma z czego jej złożyć. Numery mogą mieć dziury, więc liczy się
 * kolejność, a nie wartość numeru.
 *
 * Licznik kolizji kolejki (#175) idzie z `AdminMatch.collisions`; slot na niego
 * przygotował `RoundList` w #174.
 *
 * `timeZone` tylko dla testów; panel pokazuje strefę przeglądarki (ADR-0008).
 */
export function scheduleRounds(matches: readonly ScheduleMatch[], timeZone?: string): ScheduleRound[] {
  const byRound = new Map<number, AdminMatch[]>();
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
          collisions: sorted.filter((match) => match.collisions.length > 0).length,
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
export function defaultRound<R extends { matches: readonly { status: string }[] }>(rounds: readonly R[]): R | undefined {
  return rounds.find((round) => round.matches.some((match) => match.status !== 'finished')) ?? rounds.at(-1);
}

/** Czy któryś mecz jest rozpoczęty — wtedy terminarza nie wolno już wygenerować ponownie (#157). */
export function hasStartedMatches(matches: readonly AdminMatch[]): boolean {
  return matches.some((match) => match.status === 'live' || match.status === 'finished');
}

/**
 * Drużyny, które nie grają w żadnym meczu terminarza: dodane po jego
 * wygenerowaniu (#161). Bez terminarza lista jest pusta, bo ten stan ekran
 * pokazuje inaczej (pusty stan z generowaniem).
 */
export function teamsWithoutMatches<T extends { id: number }>(teams: readonly T[], matches: readonly AdminMatch[]): T[] {
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

/**
 * Rozmiar terminarza fazy grupowej przed wygenerowaniem, do opisu opcji w oknie
 * (#258): kolejki to najdłuższa grupa (n przy nieparzystym, n − 1 przy
 * parzystym), a mecze to suma par w grupach, razy liczba spotkań. Grupa
 * z jedyną żywą drużyną nie daje ani kolejki, ani meczu.
 */
export function groupScheduleSize(
  sizes: readonly number[],
  meetings: 1 | 2,
): { roundsCount: number; matchesCount: number } {
  const rounds = (size: number) => (size < 2 ? 0 : size % 2 === 0 ? size - 1 : size);
  const matches = (size: number) => (size < 2 ? 0 : (size * (size - 1)) / 2);

  return {
    roundsCount: Math.max(0, ...sizes.map(rounds)) * meetings,
    matchesCount: sizes.reduce((sum, size) => sum + matches(size), 0) * meetings,
  };
}

/**
 * Mecze `scheduled` z terminem w kolejkach od `fromRound` — tyle terminów
 * nadpisze ponowny rozkład dat (#158). Panel pyta o potwierdzenie tylko
 * wtedy, gdy `overwritten > 0`.
 */
export function scheduledWithDates(matches: readonly AdminMatch[], fromRound: number): AdminMatch[] {
  return matches.filter(
    (match) => match.status === 'scheduled' && match.kickoffAt !== null && match.round.order >= fromRound,
  );
}

/**
 * Mecze trwające i zakończone w kolejkach od `fromRound` — rozkład ich nie
 * ruszy, więc opis potwierdzenia mówi o nich osobno (#158).
 */
export function startedFromRound(matches: readonly AdminMatch[], fromRound: number): number {
  return matches.filter((match) => match.status !== 'scheduled' && match.round.order >= fromRound).length;
}
