import type { SetScore } from '../../lib/sets'
import type { EventMinute } from './match-event-data'

/**
 * Mecz w wierszu terminarza. Podzbiór `Match` z kontraktu, przepisany ręcznie,
 * bo pakiet UI nie zna klienta API — zgodność pilnuje
 * `apps/admin/src/lib/contract-guard.ts`.
 *
 * Typ mieszka osobno z tego samego powodu co `TournamentRow`: żeby
 * `lib/demo-data.ts` mogło go użyć bez importowania komponentu.
 */
export type MatchRowData = {
  id: number
  /** `null`, gdy miejsce w drabince nie jest jeszcze rozstrzygnięte. */
  homeTeam: MatchRowTeam | null
  awayTeam: MatchRowTeam | null
  /** W sporcie z setami sety wygrane (#301). */
  homeScore: number | null
  awayScore: number | null
  /**
   * Wyniki setów (`Match.sets`, #301): lista w sporcie z setami, `null`
   * w pozostałych. Brak pola to mecz bez setów; zmianę nazwy pola łapie
   * strażnik w aplikacji, wzorem zegara niżej.
   */
  sets?: readonly SetScore[] | null
  status: MatchStatus
  /** ISO 8601 z offsetem; `null` to „Termin do ustalenia”. */
  kickoffAt: string | null
  venue: { id: number; name: string } | null
  /**
   * Kolizje terminu tego meczu (`AdminMatch.collisions` z kontraktu), liczone
   * przy odczycie (#158). Brak pola i pusta lista znaczą to samo: brak kolizji.
   */
  collisions?: MatchCollision[]
  /**
   * Strzelcy meczu (`PublicMatch.scorers` z kontraktu, #208), w kolejności
   * z API. Ma je tylko strona publiczna; brak pola i pusta lista znaczą to
   * samo: pod wynikiem nic nie stoi.
   */
  scorers?: MatchScorer[]
  /** Karne meczu pucharowego rozstrzygniętego remisem (#216); brak pola to brak karnych. */
  homePenalties?: number | null
  awayPenalties?: number | null
  /** Mecz fazy `knockout` (#234); mecz ligi go nie ma. */
  bracket?: MatchRowBracket
  /**
   * Nazwa grupy meczu fazy `group` (#268), np. „Grupa B”. Kontrakt niesie
   * `Match.groupId`, a nazwę dokłada aplikacja z grup fazy. Własne pole, a nie
   * `bracket.label`, bo mecz grupy nie jest meczem drabinki: nie ma pozycji
   * ani miejsca na karne.
   */
  group?: string
  /**
   * Zegar meczu trwającego (`Match.livePeriod`, `periodStartedAt`, `onBreak`,
   * #297): z niego strona publiczna liczy minutę przy „Na żywo”. Brak pól to
   * samo „Na żywo”; panel ich nie pokazuje.
   */
  livePeriod?: number | null
  periodStartedAt?: string | null
  onBreak?: boolean
}

/**
 * Drużyna meczu (`TeamSummary` z kontraktu). `logoUrl` jest wymagane, wzorem
 * `StandingsTableRow.team`, żeby strażnik w aplikacji złapał zmianę nazwy pola
 * w kontrakcie; `null` to drużyna bez wgranego herbu (#292). Panelowy
 * `MatchRow` herbu nie rysuje, publiczny tak.
 */
export type MatchRowTeam = { id: number; name: string; logoUrl: string | null }

/**
 * Pozycja meczu fazy `knockout` w wierszu (#234): etykieta, podpisy pustych
 * slotów i miejsce na karne. Liczy je aplikacja z kompletu meczów fazy
 * (`bracketPosition`), bo wiersz zna tylko siebie, a z listy wierszy
 * Terminarza etykiety nie da się policzyć.
 */
export type MatchRowBracket = {
  /** „Półfinał 1”, „Mecz o 3. miejsce”, „Finał”. */
  label: string
  /** Skąd przyjdzie drużyna do pustego slotu: „Zwycięzca: Półfinał 1”. */
  homeSource?: string
  awaySource?: string
  /**
   * Sport z remisem (`allowsDraw`): pole wyniku zawsze ma miejsce na karne,
   * także w meczu bez karnych, więc wynik nie skacze między wierszami (#162).
   */
  penaltySlot: boolean
}

/**
 * Jeden zawodnik w jednym meczu (`PublicMatchScorer` z kontraktu). `team` to
 * drużyna strzelca, także przy samobóju; stronę wiersza wyznacza `ownGoal`.
 */
export type MatchScorer = {
  team: { id: number; name: string }
  player: { id: number; name: string }
  /** Suma wartości zdarzeń zawodnika w meczu, także tych bez minuty. */
  value: number
  /** Minuty zdarzeń rosnąco (minuta, potem doliczony czas); zdarzenia bez minuty tu nie ma. */
  minutes: EventMinute[]
  ownGoal: boolean
}

/** Stany meczu z kontraktu (`MatchStatus`). */
export type MatchStatus = 'scheduled' | 'live' | 'finished'

/**
 * Nazwy stanów meczu. Jedno źródło dla plakietki w wierszu terminarza
 * (`MatchRow`) i przełącznika w oknie meczu (`MatchStatusToggle`), żeby oba
 * mówiły o stanie tak samo (#159).
 */
export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'Zaplanowany',
  live: 'Trwa',
  finished: 'Zakończony',
}

/** Rodzaj kolizji terminu: wspólna drużyna (`team`) albo ten sam obiekt (`venue`). */
export type MatchCollisionType = 'team' | 'venue'

/**
 * Kolizja z innym meczem tego samego turnieju (`MatchCollision` z kontraktu).
 * `title` jest dodatkiem panelu: kontrakt zna tylko `matchId`, a wiersz nie ma
 * jak sam dotrzeć do drugiego meczu, więc opis drugiej strony dokłada ekran.
 */
export type MatchCollision = {
  type: MatchCollisionType
  /** Mecz po drugiej stronie kolizji; kolizja jest symetryczna. */
  matchId: number
  /** Opis drugiej strony kolizji do `title`, np. „Kolizja boiska: Lwy – Żubry”. */
  title?: string
}

