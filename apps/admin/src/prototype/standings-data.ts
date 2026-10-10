// PROTOTYP (#163) — dane ligi i zabawkowy kalkulator tabeli. Nie do main.
//
// Mock kontraktu oddaje tabelę z trzema drużynami bez remisów, a na tym nie da
// się ocenić podglądu skutku zmiany kryteriów. Tu jest liga ośmiu drużyn po
// pięciu kolejkach, ułożona tak, żeby każda reguła z #160 miała swój przypadek:
//
// - Wilki i Sokoły (12 pkt): mecz bezpośredni wygrały Wilki 1:0, bilans mają
//   lepszy Sokoły. Zamiana `head_to_head` z `score_diff` zamienia je miejscami.
// - Mazur, Łosie, Legia (7 pkt): mini-tabela wyciąga tylko Mazura (dwa 2:0),
//   Łosie i Legia remisują 1:1 i schodzą do następnego kryterium (reguła 2).
// - Orły i Bobry (6 pkt): ich mecz jest w kolejce 6, więc `head_to_head` jest
//   pomijane (reguła 3), a rozstrzyga bilans.
// - Samo `[points]`: remisy układa alfabet po polsku (Legia, Łosie, Mazur).
// - Żubry–Legia trwa (`live`) i nie liczy się do tabeli.
//
// Kalkulator odwzorowuje reguły #160 1–5 i nie udaje backendu w niczym więcej.

export type TiebreakerCode = 'points' | 'head_to_head' | 'score_diff' | 'score_for' | 'wins';
export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type SportCode = 'football' | 'basketball';

export type Team = { id: number; name: string };
export type Match = {
  id: number;
  round: number;
  home: number;
  away: number;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
};

export type Fixture = {
  sport: SportCode;
  teams: Team[];
  matches: Match[];
  points: { win: number; draw: number; loss: number };
  defaultTiebreakers: TiebreakerCode[];
};

/** Kryterium, które rozdzieliło wiersz od wiersza wyżej; `name` to ukryty alfabet. */
export type Separator = TiebreakerCode | 'name';

export type Row = {
  position: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDifference: number;
  points: number;
  /** `null` w pierwszym wierszu. */
  separatedBy: Separator | null;
};

// [kolejka, gospodarz, gość, wynik gospodarza, wynik gościa, status]
type M = [number, number, number, number | null, number | null, MatchStatus?];

function matches(list: M[]): Match[] {
  return list.map(([round, home, away, hs, as, status], i) => ({
    id: i + 1,
    round,
    home,
    away,
    homeScore: hs,
    awayScore: as,
    status: status ?? (hs === null ? 'scheduled' : 'finished'),
  }));
}

const football: Fixture = {
  sport: 'football',
  points: { win: 3, draw: 1, loss: 0 },
  defaultTiebreakers: ['points', 'head_to_head', 'score_diff', 'score_for'],
  teams: [
    { id: 1, name: 'Wilki Bemowo' },
    { id: 2, name: 'Sokoły Ursus' },
    { id: 3, name: 'Orły Bielany' },
    { id: 4, name: 'Bobry Targówek' },
    { id: 5, name: 'Mazur Wesoła' },
    { id: 6, name: 'Łosie Wawer' },
    { id: 7, name: 'Legia Gocław' },
    { id: 8, name: 'Żubry Wola' },
  ],
  // Tablice Bergera dla 8 drużyn, jak w #157.
  matches: matches([
    [1, 1, 8, 3, 0],
    [1, 2, 7, 4, 1],
    [1, 3, 6, 0, 2],
    [1, 4, 5, 2, 1],
    [2, 8, 5, 1, 1],
    [2, 6, 4, 0, 1],
    [2, 7, 3, 2, 1],
    [2, 1, 2, 1, 0],
    [3, 2, 8, 5, 0],
    [3, 3, 1, 2, 1],
    [3, 4, 7, 0, 3],
    [3, 5, 6, 2, 0],
    [4, 8, 6, 0, 4],
    [4, 7, 5, 0, 2],
    [4, 1, 4, 2, 1],
    [4, 2, 3, 3, 0],
    [5, 3, 8, 2, 0],
    [5, 4, 2, 0, 2],
    [5, 5, 1, 0, 1],
    [5, 6, 7, 1, 1],
    [6, 8, 7, 1, 0, 'live'],
    [6, 1, 6, null, null],
    [6, 2, 5, null, null],
    [6, 3, 4, null, null],
    [7, 4, 8, null, null],
    [7, 5, 3, null, null],
    [7, 6, 2, null, null],
    [7, 7, 1, null, null],
  ]),
};

// Koszykówka: 2 pkt za wygraną, 1 za porażkę, bez remisów. Rysie, Kosy i Żubry
// mają po 7 pkt i wygrały ze sobą „w kółko”, więc mini-tabela rozstrzyga
// bilansem meczów bezpośrednich (Rysie, Kosy, Żubry), a sam bilans ogólny daje
// Rysie, Żubry, Kosy.
const basketball: Fixture = {
  sport: 'basketball',
  points: { win: 2, draw: 0, loss: 1 },
  defaultTiebreakers: ['points', 'head_to_head', 'score_diff'],
  teams: [
    { id: 11, name: 'Żubry Wola' },
    { id: 12, name: 'Rysie Mokotów' },
    { id: 13, name: 'Kosy Ochota' },
    { id: 14, name: 'Lisy Praga' },
    { id: 15, name: 'Łabędzie Żerań' },
    { id: 16, name: 'Morsy Wawer' },
  ],
  matches: matches([
    [1, 11, 16, 81, 64],
    [1, 12, 15, 92, 70],
    [1, 13, 14, 77, 75],
    [2, 16, 14, 68, 71],
    [2, 15, 13, 66, 80],
    [2, 11, 12, 70, 88],
    [3, 12, 16, 101, 72],
    [3, 13, 11, 74, 79],
    [3, 14, 15, 69, 73],
    [4, 16, 15, 77, 75],
    [4, 11, 14, 85, 63],
    [4, 12, 13, 82, 83],
    [5, 13, 16, null, null],
    [5, 14, 12, null, null],
    [5, 15, 11, null, null],
  ]),
};

export const FIXTURES: Record<SportCode, Fixture> = { football, basketball };

const collator = new Intl.Collator('pl', { sensitivity: 'base' });

type Stat = Omit<Row, 'position' | 'separatedBy'>;
type Ranked = { stat: Stat; separatedBy: Separator | null };

function baseStats(f: Fixture): Map<number, Stat> {
  const stats = new Map<number, Stat>();
  for (const team of f.teams) {
    stats.set(team.id, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      scoreFor: 0,
      scoreAgainst: 0,
      scoreDifference: 0,
      points: 0,
    });
  }
  // Reguła z #159: tylko `finished` wchodzi do tabeli, `live` nie.
  for (const m of f.matches) {
    if (m.status !== 'finished') continue;
    const home = stats.get(m.home)!;
    const away = stats.get(m.away)!;
    apply(home, m.homeScore!, m.awayScore!, f.points);
    apply(away, m.awayScore!, m.homeScore!, f.points);
  }
  return stats;
}

function apply(s: Stat, scored: number, conceded: number, points: Fixture['points']) {
  s.played += 1;
  s.scoreFor += scored;
  s.scoreAgainst += conceded;
  s.scoreDifference = s.scoreFor - s.scoreAgainst;
  if (scored > conceded) {
    s.won += 1;
    s.points += points.win;
  } else if (scored === conceded) {
    s.drawn += 1;
    s.points += points.draw;
  } else {
    s.lost += 1;
    s.points += points.loss;
  }
}

/** Klucz sortowania grupy według jednego kryterium; `null`, gdy kryterium jest pomijane. */
function keys(group: Stat[], code: TiebreakerCode, f: Fixture): Map<number, number[]> | null {
  if (code !== 'head_to_head') {
    const pick = (s: Stat) =>
      code === 'points'
        ? s.points
        : code === 'score_diff'
          ? s.scoreDifference
          : code === 'score_for'
            ? s.scoreFor
            : s.won;
    return new Map(group.map((s) => [s.team.id, [pick(s)]]));
  }
  // Reguła 1 i 3: mini-tabela z meczów między remisującymi, pomijana, dopóki
  // którykolwiek z nich nie jest `finished`.
  const ids = new Set(group.map((s) => s.team.id));
  const direct = f.matches.filter((m) => ids.has(m.home) && ids.has(m.away));
  if (direct.length === 0 || direct.some((m) => m.status !== 'finished')) return null;
  const mini = new Map(
    group.map((s) => [
      s.team.id,
      { ...s, played: 0, won: 0, drawn: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, scoreDifference: 0, points: 0 },
    ]),
  );
  for (const m of direct) {
    apply(mini.get(m.home)!, m.homeScore!, m.awayScore!, f.points);
    apply(mini.get(m.away)!, m.awayScore!, m.homeScore!, f.points);
  }
  return new Map([...mini].map(([id, s]) => [id, [s.points, s.scoreDifference, s.scoreFor]]));
}

const compareKeys = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
  return 0;
};

/**
 * Reguła 2: grupa remisujących przechodzi przez kryteria po kolei, bez
 * rekurencji. Podgrupa, której kryterium nie rozdzieliło, idzie do następnego
 * kryterium listy, nigdy z powrotem do `head_to_head`.
 */
function rank(group: Stat[], criteria: TiebreakerCode[], idx: number, f: Fixture): Ranked[] {
  if (group.length === 1) return [{ stat: group[0], separatedBy: null }];
  if (idx >= criteria.length) {
    // Reguła 4: ukryte ostatnie kryterium, alfabet po polsku, `id` jako bezpiecznik.
    return [...group]
      .sort((a, b) => collator.compare(a.team.name, b.team.name) || a.team.id - b.team.id)
      .map((stat, i) => ({ stat, separatedBy: i === 0 ? null : 'name' }));
  }
  const code = criteria[idx];
  const k = keys(group, code, f);
  if (!k) return rank(group, criteria, idx + 1, f);
  const sorted = [...group].sort((a, b) => compareKeys(k.get(a.team.id)!, k.get(b.team.id)!));
  const subgroups: Stat[][] = [];
  for (const s of sorted) {
    const last = subgroups.at(-1);
    if (last && compareKeys(k.get(last[0].team.id)!, k.get(s.team.id)!) === 0) last.push(s);
    else subgroups.push([s]);
  }
  if (subgroups.length === 1) return rank(group, criteria, idx + 1, f);
  return subgroups.flatMap((sub, j) => {
    const ranked = rank(sub, criteria, idx + 1, f);
    ranked[0] = { ...ranked[0], separatedBy: j === 0 ? null : code };
    return ranked;
  });
}

/** Reguła 5: komplet drużyn fazy, także bez meczów; `position` zawsze 1..n. */
export function computeStandings(f: Fixture, tiebreakers: TiebreakerCode[]): Row[] {
  const stats = [...baseStats(f).values()];
  return rank(stats, tiebreakers, 0, f).map(({ stat, separatedBy }, i) => ({
    ...stat,
    position: i + 1,
    separatedBy: i === 0 ? null : separatedBy,
  }));
}

export function liveCount(f: Fixture): number {
  return f.matches.filter((m) => m.status === 'live').length;
}
