/**
 * Dane grafiki turnieju (`SocialGraphic`, #321–#325, #333): gotowy wycinek
 * pod jeden szablon, a nie kształt z kontraktu. Pakiet nie zna API, więc
 * składanie (który mecz, „po kolejce N”, strzelcy ze zdarzeń) robi panel,
 * a szablon tylko rysuje i przycina listy (`rows.ts`).
 */

import type { SetScore } from '../../lib/sets'

/** Rodzaj grafiki (#322 pkt 2), ten sam kod co w adresie `graphics?kind=…`. */
export type SocialGraphicKind = 'matchPreview' | 'matchResult' | 'standings' | 'leaderboard'

/** Rodzaje w kolejności wyboru, z nazwą do interfejsu. */
export const SOCIAL_GRAPHIC_KINDS: readonly { kind: SocialGraphicKind; label: string }[] = [
  { kind: 'matchPreview', label: 'Zapowiedź meczu' },
  { kind: 'matchResult', label: 'Wynik meczu' },
  { kind: 'standings', label: 'Tabela' },
  { kind: 'leaderboard', label: 'Klasyfikacja' },
]

/** Format grafiki (#322 pkt 3): 4:5 jest domyślny, kwadratu nie ma. */
export type SocialGraphicFormat = '4:5' | '9:16'

export const SOCIAL_GRAPHIC_FORMATS: readonly SocialGraphicFormat[] = ['4:5', '9:16']

/**
 * Wymiary szablonu w pikselach CSS. Eksport mnoży je przez
 * `SOCIAL_GRAPHIC_SCALE`, więc PNG ma 1440 × 1800 albo 1440 × 2560 (#321 §9).
 */
export const SOCIAL_GRAPHIC_SIZE: Record<SocialGraphicFormat, { width: number; height: number }> = {
  '4:5': { width: 360, height: 450 },
  '9:16': { width: 360, height: 640 },
}

export const SOCIAL_GRAPHIC_SCALE = 4

/**
 * Herb albo logo. `logoUrl` to adres, który da się narysować w PNG (w panelu
 * `data:` z `GET …/logo`), albo `null` dla herbu zastępczego.
 */
export interface GraphicTeam {
  name: string
  logoUrl: string | null
}

export interface GraphicTournament {
  name: string
  logoUrl: string | null
  /** `branding.primaryColor`: tło grafiki. */
  primaryColor: string
}

/** Zapowiedź (#323 pkt 4): bez obiektu linia znika. */
export interface GraphicPreview {
  roundName: string
  kickoffAt: string
  venue: string | null
  home: GraphicTeam
  away: GraphicTeam
}

/** Strzelec w wyniku: minuta jak na osi meczu („45+2′”) albo `null`, gdy jej nie wpisano. */
export interface GraphicScorer {
  player: string
  minute: string | null
  ownGoal: boolean
}

/** Wynik (#323 pkt 3): sety i karne, jeśli są; strzelcy tylko w piłce. */
export interface GraphicResult {
  roundName: string
  home: GraphicTeam
  away: GraphicTeam
  homeScore: number
  awayScore: number
  sets: SetScore[] | null
  penalties: { home: number; away: number } | null
  /** Strona wyniku, po której strzelec stoi (samobój po stronie rywala); `null` poza piłką. */
  scorers: { home: GraphicScorer[]; away: GraphicScorer[] } | null
}

export interface GraphicStandingRow {
  position: number
  team: GraphicTeam
  played: number
  scoreFor: number
  scoreAgainst: number
  points: number
}

/** Tabela (#323 pkt 1). */
export interface GraphicStandings {
  /** N z podpisu „po kolejce N”; `null`, gdy żadna kolejka nie jest zakończona w całości. */
  afterRound: number | null
  /** `StandingTable.scoreLabel`: „Bramki”, „Punkty”, „Sety” (ADR-0006). */
  scoreLabel: string
  rows: GraphicStandingRow[]
}

export interface GraphicLeaderRow {
  /** Miejsce z API, wspólne przy remisie. */
  position: number
  player: string
  team: GraphicTeam
  value: number
}

/** Klasyfikacja w domyślnej statystyce sportu (#322 pkt 2). */
export interface GraphicLeaderboard {
  /** `StatLeaderboard.label`: nagłówek grafiki. */
  label: string
  rows: GraphicLeaderRow[]
}

/** Rodzaj z danymi do jego szablonu. */
export type SocialGraphicContent =
  | { kind: 'matchPreview'; data: GraphicPreview }
  | { kind: 'matchResult'; data: GraphicResult }
  | { kind: 'standings'; data: GraphicStandings }
  | { kind: 'leaderboard'; data: GraphicLeaderboard }
