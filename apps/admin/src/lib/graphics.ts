import type { AdminMatch, MatchEvent, Sport, SportEventType } from '@tournament/api-client';
import { plural } from '@tournament/ui';
import {
  SOCIAL_GRAPHIC_FORMATS,
  SOCIAL_GRAPHIC_KINDS,
  type GraphicScorer,
  type SocialGraphicFormat,
  type SocialGraphicKind,
} from '@tournament/ui/public';
import { MATCHES } from './plural';

/*
  Reguły zakładki „Grafiki” (#333), z rozstrzygnięć #322, #323 i #325: które
  mecze nadają się na zapowiedź i wynik, który jest domyślny, „po kolejce N”
  tabeli, strzelcy ze zdarzeń i kiedy rodzaj jest nieaktywny. Czyste funkcje,
  żeby dało się je sprawdzić bez ekranu.
*/

/** Kod samobója, jak w `MatchScorers` backendu i w oknie zdarzeń meczu. */
const OWN_GOAL = 'own_goal';

/** Najwięcej strzelców na drużynę w wyniku (#323 pkt 3). */
export const SCORERS_LIMIT = 6;

const kickoffTime = (match: AdminMatch) => new Date(match.kickoffAt!).getTime();

/**
 * Zapowiedź: mecze `scheduled` z terminem i z obiema drużynami, rosnąco po
 * terminie. `live` odpada, nierozstrzygnięta para w drabince też, a zaległe
 * zostają (#325).
 */
export function previewMatches(matches: readonly AdminMatch[]): AdminMatch[] {
  return matches
    .filter((match) => match.status === 'scheduled' && match.kickoffAt !== null && match.homeTeam && match.awayTeam)
    .sort((a, b) => kickoffTime(a) - kickoffTime(b));
}

/** Najbliższy termin od teraz, a bez takiego najpóźniejszy zaległy. */
export function defaultPreviewMatch(list: readonly AdminMatch[], now: Date): AdminMatch | undefined {
  return list.find((match) => kickoffTime(match) >= now.getTime()) ?? list.at(-1);
}

/**
 * Wynik: tylko `finished`, chronologicznie (#325). Kolejność wyznacza termin,
 * a gdy choć jeden mecz listy go nie ma, cała lista idzie po kolejce i numerze
 * meczu. Klucz wybiera się raz dla listy, nie dla każdej pary, bo mieszane
 * porównanie nie jest przechodnie i kolejność zależałaby od wejścia.
 */
export function resultMatches(matches: readonly AdminMatch[]): AdminMatch[] {
  const list = matches.filter((match) => match.status === 'finished');
  const allDated = list.every((match) => match.kickoffAt !== null);
  return list.sort((a, b) =>
    allDated ? kickoffTime(a) - kickoffTime(b) : a.round.order - b.round.order || a.matchNumber - b.matchNumber,
  );
}

/** Ostatni zakończony. */
export function defaultResultMatch(list: readonly AdminMatch[]): AdminMatch | undefined {
  return list.at(-1);
}

export interface StandingsCaption {
  /** Największy `round.order`, w którym wszystkie mecze są `finished`; `null`, gdy takiej kolejki nie ma. */
  afterRound: number | null;
  /** Mecze zakończone z kolejek o wyższym `order` niż N: tabela już je liczy. */
  aheadMatches: number;
  aheadRounds: number[];
}

/** „Po kolejce N” z meczów fazy tabeli (#323 pkt 1). */
export function standingsCaption(matches: readonly AdminMatch[]): StandingsCaption {
  const rounds = new Map<number, AdminMatch[]>();
  for (const match of matches) rounds.set(match.round.order, [...(rounds.get(match.round.order) ?? []), match]);
  const complete = [...rounds].filter(([, list]) => list.every((match) => match.status === 'finished')).map(([order]) => order);
  const afterRound = complete.length > 0 ? Math.max(...complete) : null;
  const ahead = matches.filter((match) => match.status === 'finished' && match.round.order > (afterRound ?? 0));
  return {
    afterRound,
    aheadMatches: ahead.length,
    aheadRounds: [...new Set(ahead.map((match) => match.round.order))].sort((a, b) => a - b),
  };
}

function roundsText(orders: readonly number[]): string {
  const list = orders.length === 1 ? String(orders[0]) : `${orders.slice(0, -1).join(', ')} i ${orders.at(-1)}`;
  return `${orders.length === 1 ? 'kolejki' : 'kolejek'} ${list}`;
}

/** Ostrzeżenie w podglądzie (nie na grafice), gdy podpis nie opisuje całej tabeli. */
export function standingsWarning(caption: StandingsCaption): string | null {
  const counted = caption.aheadMatches > 0 ? `${caption.aheadMatches} ${plural(caption.aheadMatches, MATCHES)} ${roundsText(caption.aheadRounds)}` : null;
  if (caption.afterRound === null) {
    const note = 'Żadna kolejka nie jest jeszcze zakończona w całości, więc grafika nie ma podpisu „po kolejce”.';
    return counted ? `${note} Tabela obejmuje ${counted}.` : note;
  }
  return counted ? `Tabela obejmuje już ${counted}, a grafika ma podpis „po kolejce ${caption.afterRound}”.` : null;
}

function minuteText(event: MatchEvent): string | null {
  if (event.minute === null) return null;
  return event.addedTime === null ? `${event.minute}′` : `${event.minute}+${event.addedTime}′`;
}

/**
 * Strzelcy wyniku w piłce: zdarzenia typów zdobyczy (pierwsza statystyka
 * sportu) i samobóje, w kolejności z API (minuta rosnąco, bez minuty na
 * końcu). Samobój stoi po stronie rywala drużyny zawodnika. Najwyżej
 * `SCORERS_LIMIT` na stronę. Poza piłką zawodników na grafice nie ma (#323).
 */
export function matchScorers(
  events: readonly MatchEvent[],
  homeTeamId: number,
  sport: { code: Sport['code']; eventTypes: readonly SportEventType[]; scoringStat: string | undefined },
): { home: GraphicScorer[]; away: GraphicScorer[] } | null {
  if (sport.code !== 'football') return null;
  const scoring = new Set(sport.eventTypes.filter((type) => type.stat === sport.scoringStat).map((type) => type.code));
  const sides = { home: [] as GraphicScorer[], away: [] as GraphicScorer[] };
  for (const event of events) {
    const ownGoal = event.type === OWN_GOAL;
    if (!event.player || (!ownGoal && !scoring.has(event.type))) continue;
    const forHome = (event.team.id === homeTeamId) !== ownGoal;
    const side = forHome ? sides.home : sides.away;
    if (side.length < SCORERS_LIMIT) side.push({ player: event.player.name, minute: minuteText(event), ownGoal });
  }
  return sides;
}

export type GraphicKindReasons = Record<SocialGraphicKind, string | null>;

/**
 * Powód, dla którego rodzaj jest nieaktywny, albo `null` (#325, „Warunki bez
 * danych”). Tabela patrzy tylko na mecze swojej fazy: zakończony mecz innej
 * fazy jej nie wypełnia.
 */
export function graphicKindReasons({
  matches,
  tables,
  leaderboard,
}: {
  matches: readonly AdminMatch[];
  tables: readonly { stageId: number }[];
  leaderboard: { label: string; rows: number };
}): GraphicKindReasons {
  const isFinished = (match: AdminMatch) => match.status === 'finished';
  const tableFinished = tables.length === 1 && matches.some((match) => isFinished(match) && match.stageId === tables[0]!.stageId);
  return {
    matchPreview:
      previewMatches(matches).length > 0 ? null : 'Brak meczu z terminem i znanymi drużynami, który można zapowiedzieć.',
    matchResult: matches.some(isFinished) ? null : 'Brak zakończonego meczu.',
    standings:
      tables.length === 0
        ? 'Turniej nie ma tabeli.'
        : tables.length > 1
          ? 'Turniej ma kilka tabel grup, a grafika pokazuje jedną tabelę.'
          : tableFinished
            ? null
            : 'Tabela nie ma jeszcze zakończonego meczu.',
    leaderboard: leaderboard.rows > 0 ? null : `Klasyfikacja „${leaderboard.label}” jest jeszcze pusta.`,
  };
}

export interface GraphicParams {
  kind: SocialGraphicKind;
  /** Mecz z adresu; czy pasuje do rodzaju, sprawdza ekran z listą meczów. */
  matchId: number | null;
  format: SocialGraphicFormat;
}

/**
 * Wybór z adresu (`graphics?kind=…&match=…&format=…`, #322 pkt 1). Błędny albo
 * nieaktywny rodzaj daje pierwszy aktywny, błędny format daje 4:5 (#325).
 */
export function readGraphicParams(search: URLSearchParams, reasons: GraphicKindReasons): GraphicParams {
  const requested = SOCIAL_GRAPHIC_KINDS.find(({ kind }) => kind === search.get('kind'))?.kind;
  const firstActive = SOCIAL_GRAPHIC_KINDS.find(({ kind }) => reasons[kind] === null)?.kind ?? 'matchPreview';
  const match = Number(search.get('match'));
  const format = SOCIAL_GRAPHIC_FORMATS.find((candidate) => candidate === search.get('format'));
  return {
    kind: requested && reasons[requested] === null ? requested : firstActive,
    matchId: Number.isInteger(match) && match > 0 ? match : null,
    format: format ?? '4:5',
  };
}

/** Wybór jako adres, w kolejności, którą czyta `readGraphicParams`; bez meczu bez `match`. */
export function writeGraphicParams({ kind, matchId, format }: GraphicParams): URLSearchParams {
  const search = new URLSearchParams({ kind });
  if (matchId !== null) search.set('match', String(matchId));
  search.set('format', format);
  return search;
}
