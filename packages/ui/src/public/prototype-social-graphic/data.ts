/*
  PROTOTYP (#324) — do wyrzucenia. Dane czterech grafik (`SocialGraphic`)
  przepisane ręcznie z `backend/database/seeders/DemoTournamentSeeder.php`
  według reguł z #322 i #323. Tabela i wyniki policzone z RESULTS /
  VOLLEYBALL_MATCHES; klasyfikacja piłki z EVENTS (tylko mecze zakończone).
  Liczby klasyfikacji koszykówki i siatkówki są PRZYBLIŻONE: seed rozkłada
  rzuty wzorem, a siatkówka ma trzy zdarzenia, więc wpisałam wiarygodne
  wartości, nie wynik `StatLeaderboard::of`.
  „Skrajne” to zestaw na obciążenie układu (długie nazwy, 16 drużyn, karne,
  6 strzelców na stronę, brak obiektu, ex aequo), nie seed.
*/

export type Sport = 'football' | 'basketball' | 'volleyball'

export interface GTeam {
  name: string
  logoUrl: string | null
}

export interface GScorer {
  player: string
  minute: string
  ownGoal?: boolean
}

export interface GPreview {
  roundName: string
  kickoff: string // gotowy tekst w Europe/Warsaw
  venue: string | null
  home: GTeam
  away: GTeam
}

export interface GResult {
  roundName: string
  kickoff: string
  home: GTeam
  away: GTeam
  homeScore: number
  awayScore: number
  sets?: [number, number][]
  penalties?: [number, number]
  scorers?: { home: GScorer[]; away: GScorer[] }
}

export interface GStandingRow {
  position: number
  team: GTeam
  played: number
  balance: string // bilans zdobyczy, w siatkówce setów
  points: number
}

export interface GStandings {
  afterRound: number
  balanceLabel: string
  rows: GStandingRow[]
  /** Tabela obejmuje już mecze następnej kolejki (ostrzeżenie w podglądzie, nie na grafice). */
  aheadWarning?: string
}

export interface GLeader {
  position: number
  player: string
  team: GTeam
  value: number
}

export interface GLeaderboard {
  statLabel: string
  rows: GLeader[]
  more?: number
}

export interface GDataset {
  key: string
  label: string
  sport: Sport
  tournament: { name: string; logoUrl: string | null; primaryColor: string }
  preview: GPreview | { disabled: string }
  result: GResult | { disabled: string }
  standings: GStandings | { disabled: string }
  leaderboard: GLeaderboard | { disabled: string }
}

/** Herb wgrany przez organizatora (żeby było widać plik obok herbu zastępczego). */
const uploadedCrest =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#f5f5f5"/><circle cx="32" cy="32" r="24" fill="#c0392b"/><path d="M20 40 32 16l12 24z" fill="#f5f5f5"/></svg>',
  )

const t = (name: string, logoUrl: string | null = null): GTeam => ({ name, logoUrl })

const wilki = t('Wilki Bemowo', uploadedCrest)
const sokoly = t('Sokoły Ursus')
const orly = t('Orły Bielany')

export const football: GDataset = {
  key: 'pilka',
  label: 'Piłka',
  sport: 'football',
  tournament: { name: 'Liga Osiedlowa 2026', logoUrl: null, primaryColor: '#1F7A45' },
  preview: {
    roundName: 'Kolejka 5',
    kickoff: 'niedz., 4 paź · 12:00',
    venue: 'Boisko Bemowo',
    home: wilki,
    away: orly,
  },
  result: {
    roundName: 'Kolejka 3',
    kickoff: 'niedz., 20 wrz',
    home: sokoly,
    away: orly,
    homeScore: 2,
    awayScore: 1,
    scorers: {
      home: [
        { player: 'Adam Zieliński', minute: '15′' },
        { player: 'Tomasz Lis', minute: '70′' },
      ],
      away: [{ player: 'Rafał Duda', minute: '44′' }],
    },
  },
  standings: {
    afterRound: 3,
    balanceLabel: 'Bramki',
    rows: [
      { position: 1, team: wilki, played: 2, balance: '5:1', points: 6 },
      { position: 2, team: sokoly, played: 2, balance: '3:3', points: 3 },
      { position: 3, team: orly, played: 2, balance: '1:5', points: 0 },
    ],
  },
  leaderboard: {
    statLabel: 'Bramki',
    rows: [
      { position: 1, player: 'Marek Nowak', team: wilki, value: 3 },
      { position: 2, player: 'Adam Zieliński', team: sokoly, value: 2 },
      { position: 3, player: 'Jakub Wrona', team: wilki, value: 1 },
      { position: 3, player: 'Tomasz Lis', team: sokoly, value: 1 },
      { position: 3, player: 'Rafał Duda', team: orly, value: 1 },
    ],
  },
}

const zubry = t('Żubry Wola')
const rysie = t('Rysie Mokotów')

export const basketball: GDataset = {
  key: 'kosz',
  label: 'Koszykówka',
  sport: 'basketball',
  tournament: { name: 'Liga Koszykówki 2026', logoUrl: null, primaryColor: '#1F7A45' },
  preview: { disabled: 'Brak nadchodzących meczów z datą i godziną.' },
  result: {
    roundName: 'Kolejka 2',
    kickoff: 'niedz., 13 wrz',
    home: rysie,
    away: zubry,
    homeScore: 71,
    awayScore: 78,
  },
  standings: {
    afterRound: 2,
    balanceLabel: 'Punkty',
    rows: [
      { position: 1, team: zubry, played: 2, balance: '168:141', points: 4 },
      { position: 2, team: rysie, played: 2, balance: '141:168', points: 2 },
    ],
  },
  leaderboard: {
    statLabel: 'Punkty',
    rows: [
      { position: 1, player: 'Kacper Lipa', team: zubry, value: 61 },
      { position: 2, player: 'Oskar Dąb', team: zubry, value: 54 },
      { position: 3, player: 'Filip Sarna', team: rysie, value: 52 },
      { position: 4, player: 'Hubert Łoś', team: rysie, value: 47 },
      { position: 5, player: 'Bruno Klon', team: zubry, value: 33 },
    ],
  },
}

const orleta = t('Orlęta Wawer')
const mewy = t('Mewy Żoliborz')
const czaple = t('Czaple Ursynów')
const jaskolki = t('Jaskółki Targówek')

export const volleyball: GDataset = {
  key: 'siatka',
  label: 'Siatkówka',
  sport: 'volleyball',
  tournament: { name: 'Liga Siatkówki 2026', logoUrl: null, primaryColor: '#1F7A45' },
  preview: {
    roundName: 'Kolejka 3',
    kickoff: 'sob., 19 wrz · 19:00',
    venue: 'Hala Targówek',
    home: jaskolki,
    away: mewy,
  },
  result: {
    roundName: 'Kolejka 2',
    kickoff: 'sob., 12 wrz',
    home: mewy,
    away: czaple,
    homeScore: 3,
    awayScore: 1,
    sets: [
      [25, 20],
      [23, 25],
      [25, 22],
      [25, 19],
    ],
  },
  standings: {
    afterRound: 2,
    balanceLabel: 'Sety',
    rows: [
      { position: 1, team: orleta, played: 2, balance: '6:2', points: 5 },
      { position: 2, team: czaple, played: 2, balance: '4:4', points: 3 },
      { position: 3, team: mewy, played: 2, balance: '3:4', points: 3 },
      { position: 4, team: jaskolki, played: 2, balance: '3:6', points: 1 },
    ],
  },
  leaderboard: {
    statLabel: 'Punkty',
    rows: [
      { position: 1, player: 'Kamil Lis', team: orleta, value: 34 },
      { position: 2, player: 'Ola Kruk', team: jaskolki, value: 29 },
      { position: 3, player: 'Zofia Mazur', team: mewy, value: 27 },
      { position: 4, player: 'Natalia Bąk', team: czaple, value: 24 },
      { position: 5, player: 'Maja Wilk', team: orleta, value: 21 },
    ],
  },
}

const longNames = [
  'Niedźwiedzie Mokotów',
  'Jastrzębie Wawer',
  'Wilki Bemowo',
  'Akademia Piłkarska Białołęka',
  'Sokoły Ursus',
  'Lwy Ochota',
  'Żubry Praga',
  'Orły Bielany',
  'Rysie Wola',
  'Kosy Targówek',
  'Dziki Wesoła',
  'Bobry Wilanów',
  'Łosie Rembertów',
  'Mustangi Włochy',
  'Foki Żoliborz',
  'Kruki Śródmieście',
]

export const extreme: GDataset = {
  key: 'skrajne',
  label: 'Skrajne',
  sport: 'football',
  tournament: { name: 'Mistrzostwa Dzielnicy Białołęka 2026', logoUrl: null, primaryColor: '#1F7A45' },
  preview: {
    roundName: 'Ćwierćfinał',
    kickoff: 'sob., 17 paź · 18:30',
    venue: null,
    home: t('Akademia Piłkarska Białołęka'),
    away: t('Niedźwiedzie Mokotów'),
  },
  result: {
    roundName: 'Półfinał',
    kickoff: 'niedz., 11 paź',
    home: t('Akademia Piłkarska Białołęka'),
    away: t('Niedźwiedzie Mokotów', uploadedCrest),
    homeScore: 3,
    awayScore: 3,
    penalties: [4, 3],
    scorers: {
      home: [
        { player: 'Bartłomiej Grzegorzewski', minute: '4′' },
        { player: 'Jan Kowalczyk', minute: '28′' },
        { player: 'Piotr Wiśniewski', minute: '45+2′' },
      ],
      away: [
        { player: 'Konstanty Przybyszewski', minute: '12′' },
        { player: 'Jan Kowalczyk', minute: '33′', ownGoal: true },
        { player: 'Adam Nowak', minute: '90+4′' },
      ],
    },
  },
  standings: {
    afterRound: 12,
    balanceLabel: 'Bramki',
    aheadWarning: 'Tabela obejmuje już 2 mecze kolejki 13.',
    rows: longNames.map((name, index) => ({
      position: index + 1,
      team: t(name, index === 2 ? uploadedCrest : null),
      played: 12,
      balance: `${40 - index * 2}:${10 + index * 2}`,
      points: 34 - index * 2,
    })),
  },
  leaderboard: {
    statLabel: 'Bramki',
    rows: [
      { position: 1, player: 'Konstanty Przybyszewski', team: t('Niedźwiedzie Mokotów'), value: 14 },
      { position: 2, player: 'Bartłomiej Grzegorzewski', team: t('Akademia Piłkarska Białołęka'), value: 11 },
      { position: 3, player: 'Marek Nowak', team: wilki, value: 9 },
      { position: 4, player: 'Adam Zieliński', team: sokoly, value: 8 },
      { position: 5, player: 'Rafał Duda', team: orly, value: 7 },
      { position: 5, player: 'Igor Wrzos', team: t('Lwy Ochota'), value: 7 },
      { position: 5, player: 'Paweł Lis', team: t('Żubry Praga'), value: 7 },
      { position: 5, player: 'Kamil Dąb', team: t('Rysie Wola'), value: 7 },
    ],
    more: 2,
  },
}

export const DATASETS = [football, basketball, volleyball, extreme] as const

export type Kind = 'matchPreview' | 'matchResult' | 'standings' | 'leaderboard'
export const KINDS: { kind: Kind; label: string }[] = [
  { kind: 'matchPreview', label: 'Zapowiedź meczu' },
  { kind: 'matchResult', label: 'Wynik meczu' },
  { kind: 'standings', label: 'Tabela' },
  { kind: 'leaderboard', label: 'Klasyfikacja' },
]

export type Format = '4:5' | '9:16'
/** Szablon rysuje się w 360 × 450 / 360 × 640 px CSS, eksport ×4 → 1440 × 1800 / 1440 × 2560 (Meta, #321 §5). */
export const FORMAT_SIZE: Record<Format, { w: number; h: number }> = {
  '4:5': { w: 360, h: 450 },
  '9:16': { w: 360, h: 640 },
}
export const EXPORT_SCALE = 4

/** Limity wierszy tabeli z #323. */
export const STANDINGS_LIMIT: Record<Format, number> = { '4:5': 10, '9:16': 16 }

export function isDisabled<T>(value: T | { disabled: string }): value is { disabled: string } {
  return typeof value === 'object' && value !== null && 'disabled' in value
}
