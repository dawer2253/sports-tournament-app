import type { AdminMatch } from '@tournament/api-client';
import {
  THIRD_PLACE_LABEL,
  bracketSize,
  bracketSlotSource,
  bracketWinnerSide,
  byesCount,
  formatRoundDates,
  isThirdPlaceMatch,
  matchLabel,
  type BracketMatchRowData,
  type BracketScore,
  type BracketSlot,
  type RoundSummary,
} from '@tournament/ui';
import { plural, TEAMS } from './plural';

/**
 * Drabinka panelu złożona z meczów fazy (#227). Kontrakt nie ma listy rund
 * ani etykiet pozycji, więc wszystko wyprowadza się z kompletu meczów i ich
 * krawędzi, tak jak przewiduje ADR-0004. Reguły odczytu (etykieta pozycji,
 * mecz o 3. miejsce, podpis źródła, wolne losy, mistrz) leżą w `@tournament/ui`,
 * bo te same woła strona publiczna (#234). Tu zostaje to, czego potrzebuje
 * tylko panel: karty rund, wiersz drabinki i notka przed zapisem.
 */

/** Runda drabinki: mecze w kolejności gry i to, co pokazują karty rund. */
export interface BracketRound {
  id: number;
  name: string;
  order: number;
  /** Mecz o 3. miejsce przed finałem, dalej po `matchNumber`. */
  matches: AdminMatch[];
  summary: RoundSummary;
}

function slot(match: AdminMatch, side: 'home' | 'away', matches: readonly AdminMatch[]): BracketSlot {
  const team = side === 'home' ? match.homeTeam : match.awayTeam;
  return { team: team && { id: team.id, name: team.name }, source: bracketSlotSource(match, side, matches) };
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
 * Etykieta pozycji w przypadku, którego wymaga notka: „do finału”, „w półfinale
 * 2”, „z meczu o 3. miejsce”. Nazwy rund pochodzą z generatora (#215), więc
 * odmiana obejmuje tylko je: „Finał”, „Półfinał”, „Ćwierćfinał” i „1/n finału”,
 * które się nie odmienia.
 */
function positionPhrase(label: string, form: 'to' | 'in' | 'from'): string {
  const preposition = { to: 'do', in: 'w', from: 'z' }[form];
  if (label === THIRD_PLACE_LABEL) return `${preposition} meczu o 3. miejsce`;
  if (label.startsWith('1/')) return `${preposition} ${label}`;
  const [word = '', number] = label.split(' ');
  const base = word.toLowerCase();
  const inflected = form === 'in' ? base.replace(/ł$/, 'le') : `${base}u`;
  return [preposition, inflected, number].filter(Boolean).join(' ');
}

/** Notka przed zapisem: zwykła informacja albo ostrzeżenie o blokadzie z kontraktu. */
export type AdvanceNote = { tone: 'info' | 'block'; lines: string[] };

/**
 * Notka przed zapisem meczu drabinki (#216, #228), liczona z krawędzi
 * i kompletu meczów fazy: kto awansuje, kto kogo zastąpi i kto zniknie
 * z meczu zależnego. Reguła ruchu jest ta sama co w backendzie
 * (`App\Matches\Advancement`): slot meczu zależnego dostaje drużynę, którą
 * wyłania mecz po zmianie, i rusza się tylko wtedy, gdy ta drużyna jest inna.
 *
 * Gdy którykolwiek mecz zależny do ruszenia jest rozpoczęty, zamiast notki
 * stoi treść blokady z kontraktu (`422` pod `homeScore`), w tej samej
 * kolejności: najpierw mecz zwycięzcy, potem przegranego. `null`, gdy zapis
 * nie rusza żadnego slotu.
 */
export function advanceNote(original: AdminMatch, draft: BracketScore, matches: readonly AdminMatch[]): AdvanceNote | null {
  const teamOf = (match: AdminMatch, score: BracketScore, role: 'winner' | 'loser') => {
    const winner = bracketWinnerSide(score);
    if (winner === null) return null;
    const side = role === 'winner' ? winner : winner === 'home' ? 'away' : 'home';
    return side === 'home' ? match.homeTeam : match.awayTeam;
  };

  const moves = (
    [
      ['winner', original.winnerToMatchId],
      ['loser', original.loserToMatchId],
    ] as const
  ).flatMap(([role, dependentId]) => {
    const dependent = matches.find((candidate) => candidate.id === dependentId);
    const from = teamOf(original, original, role);
    const to = teamOf(original, draft, role);
    return dependent && from?.id !== to?.id ? [{ dependent, label: matchLabel(dependent, matches), from, to }] : [];
  });
  if (moves.length === 0) return null;

  const started = moves.filter(({ dependent }) => dependent.status !== 'scheduled');
  if (started.length > 0) {
    const listed = started
      .map(({ dependent, label }) => {
        const pair = `${dependent.homeTeam?.name ?? 'Do ustalenia'} – ${dependent.awayTeam?.name ?? 'Do ustalenia'}`;
        return `${label} (${pair})`;
      })
      .join(', ');
    return {
      tone: 'block',
      lines: [`Zwycięzca zagrał już dalej: ${listed}. Cofnij te mecze do zaplanowanych, zanim zmienisz zwycięzcę.`],
    };
  }

  return {
    tone: 'info',
    lines: moves.map(({ label, from, to }) => {
      if (from && to) {
        const where = positionPhrase(label, 'in');
        return `${where.charAt(0).toUpperCase()}${where.slice(1)} ${to.name} zastąpią ${from.name}.`;
      }
      if (to) {
        return label === THIRD_PLACE_LABEL
          ? `${to.name} zagrają ${positionPhrase(label, 'in')}.`
          : `${to.name} awansują ${positionPhrase(label, 'to')}.`;
      }
      return `${from!.name} znikną ${positionPhrase(label, 'from')}.`;
    }),
  };
}

const BYES = ['wolny los', 'wolne losy', 'wolnych losów'] as const;

/** „6 drużyn: drabinka na 8, 2 wolne losy dla najwyżej rozstawionych.” */
export function bracketSizeSentence(teams: number): string {
  const byes = byesCount(teams);
  const head = `${teams} ${plural(teams, TEAMS)}: drabinka na ${bracketSize(teams)}`;
  return byes > 0 ? `${head}, ${byes} ${plural(byes, BYES)} dla najwyżej rozstawionych.` : `${head}.`;
}
