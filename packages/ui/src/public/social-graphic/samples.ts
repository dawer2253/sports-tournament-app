/*
  Dane demo grafik do stories, przepisane z prototypu #324 (który liczył je
  ręcznie z `DemoTournamentSeeder.php` według reguł z #322 i #323). Liczby
  klasyfikacji piłki, koszykówki i siatkówki idą za przykładami panelowego
  `GET /tournaments/{tournament}/leaderboard`. „Skrajne” to zestaw na
  obciążenie układu (długie nazwy, 16 drużyn, karne, brak obiektu, ex aequo),
  nie seed.
*/
import type {
  GraphicLeaderboard,
  GraphicPreview,
  GraphicResult,
  GraphicStandings,
  GraphicTeam,
  GraphicTournament,
  SocialGraphicContent,
} from './data'

/** Strefa terminów w stories: zrzut nie zależy od maszyny. */
export const SAMPLE_TIME_ZONE = 'Europe/Warsaw'

/** Herb wgrany przez organizatora, żeby było widać plik obok herbu zastępczego. */
export const UPLOADED_CREST =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#f5f5f5"/><circle cx="32" cy="32" r="24" fill="#c0392b"/><path d="M20 40 32 16l12 24z" fill="#f5f5f5"/></svg>',
  )

/** Adres, który się nie wczytuje: herb zastępczy zajmuje jego miejsce. */
export const BROKEN_IMAGE = '/nie-ma-takiego-pliku.png'

const team = (name: string, logoUrl: string | null = null): GraphicTeam => ({ name, logoUrl })

export interface GraphicSample {
  tournament: GraphicTournament
  preview: GraphicPreview | null
  result: GraphicResult
  standings: GraphicStandings
  leaderboard: GraphicLeaderboard
}

/** Rodzaje próbki w kolejności wyboru; zapowiedź bywa nieaktywna. */
export function sampleContents(sample: GraphicSample): SocialGraphicContent[] {
  return [
    ...(sample.preview ? [{ kind: 'matchPreview' as const, data: sample.preview }] : []),
    { kind: 'matchResult', data: sample.result },
    { kind: 'standings', data: sample.standings },
    { kind: 'leaderboard', data: sample.leaderboard },
  ]
}

const wilki = team('Wilki Bemowo', UPLOADED_CREST)
const sokoly = team('Sokoły Ursus')
const orly = team('Orły Bielany')

export const footballSample: GraphicSample = {
  tournament: { name: 'Liga Osiedlowa 2026', logoUrl: null, primaryColor: '#1F7A45' },
  preview: { roundName: 'Kolejka 5', kickoffAt: '2026-10-04T10:00:00+00:00', venue: 'Boisko Bemowo', home: wilki, away: orly },
  result: {
    roundName: 'Kolejka 3',
    home: sokoly,
    away: orly,
    homeScore: 2,
    awayScore: 1,
    sets: null,
    penalties: null,
    scorers: {
      home: [
        { player: 'Adam Zieliński', minute: '15′', ownGoal: false },
        { player: 'Tomasz Lis', minute: '70′', ownGoal: false },
      ],
      away: [{ player: 'Rafał Duda', minute: '44′', ownGoal: false }],
    },
  },
  standings: {
    afterRound: 3,
    scoreLabel: 'Bramki',
    rows: [
      { position: 1, team: wilki, played: 2, scoreFor: 5, scoreAgainst: 1, points: 6 },
      { position: 2, team: sokoly, played: 2, scoreFor: 3, scoreAgainst: 3, points: 3 },
      { position: 3, team: orly, played: 2, scoreFor: 1, scoreAgainst: 5, points: 0 },
    ],
  },
  leaderboard: {
    label: 'Bramki',
    rows: [
      { position: 1, player: 'Marek Nowak', team: wilki, value: 3 },
      { position: 2, player: 'Adam Zieliński', team: sokoly, value: 2 },
      { position: 3, player: 'Jakub Wrona', team: wilki, value: 1 },
      { position: 3, player: 'Tomasz Lis', team: sokoly, value: 1 },
      { position: 3, player: 'Rafał Duda', team: orly, value: 1 },
    ],
  },
}

const zubry = team('Żubry Wola')
const rysie = team('Rysie Mokotów')

/**
 * Seed nie ma nadchodzącego meczu koszykówki z datą (panel ma wtedy
 * zapowiedź nieaktywną), więc zapowiedź jest tu dopisana, żeby story
 * pokazały każdy rodzaj w każdym sporcie.
 */
export const basketballSample: GraphicSample = {
  tournament: { name: 'Liga Koszykówki 2026', logoUrl: null, primaryColor: '#1F7A45' },
  preview: { roundName: 'Kolejka 3', kickoffAt: '2026-10-11T16:30:00+00:00', venue: 'Hala OSiR Wola', home: zubry, away: rysie },
  result: { roundName: 'Kolejka 2', home: rysie, away: zubry, homeScore: 71, awayScore: 78, sets: null, penalties: null, scorers: null },
  standings: {
    afterRound: 2,
    scoreLabel: 'Punkty',
    rows: [
      { position: 1, team: zubry, played: 2, scoreFor: 168, scoreAgainst: 141, points: 4 },
      { position: 2, team: rysie, played: 2, scoreFor: 141, scoreAgainst: 168, points: 2 },
    ],
  },
  leaderboard: {
    label: 'Punkty',
    rows: [
      { position: 1, player: 'Oskar Dąb', team: zubry, value: 57 },
      { position: 1, player: 'Bruno Klon', team: zubry, value: 57 },
      { position: 3, player: 'Kacper Lipa', team: zubry, value: 54 },
      { position: 4, player: 'Wiktor Bóbr', team: rysie, value: 48 },
      { position: 5, player: 'Hubert Łoś', team: rysie, value: 47 },
      { position: 6, player: 'Filip Sarna', team: rysie, value: 46 },
    ],
  },
}

const orleta = team('Orlęta Wawer')
const mewy = team('Mewy Żoliborz')
const czaple = team('Czaple Ursynów')
const jaskolki = team('Jaskółki Targówek')

export const volleyballSample: GraphicSample = {
  tournament: { name: 'Liga Siatkówki 2026', logoUrl: null, primaryColor: '#1F7A45' },
  preview: { roundName: 'Kolejka 3', kickoffAt: '2026-09-19T17:00:00+00:00', venue: 'Hala Targówek', home: jaskolki, away: mewy },
  result: {
    roundName: 'Kolejka 2',
    home: mewy,
    away: czaple,
    homeScore: 3,
    awayScore: 1,
    sets: [
      { home: 25, away: 20 },
      { home: 23, away: 25 },
      { home: 25, away: 22 },
      { home: 25, away: 19 },
    ],
    penalties: null,
    scorers: null,
  },
  standings: {
    afterRound: 2,
    scoreLabel: 'Sety',
    rows: [
      { position: 1, team: orleta, played: 2, scoreFor: 6, scoreAgainst: 2, points: 5 },
      { position: 2, team: czaple, played: 2, scoreFor: 4, scoreAgainst: 4, points: 3 },
      { position: 3, team: mewy, played: 2, scoreFor: 3, scoreAgainst: 4, points: 3 },
      { position: 4, team: jaskolki, played: 2, scoreFor: 3, scoreAgainst: 6, points: 1 },
    ],
  },
  leaderboard: {
    label: 'Punkty',
    rows: [
      { position: 1, player: 'Kamil Lis', team: orleta, value: 2 },
      { position: 2, player: 'Ola Kruk', team: jaskolki, value: 1 },
    ],
  },
}

const LONG_NAMES = [
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

/**
 * Obciążenie układu: długie nazwy drużyn i turnieju, 16 drużyn w tabeli,
 * mecz pucharowy z karnymi, zapowiedź bez obiektu, remis na 5. miejscu
 * klasyfikacji ponad granicę 8 wierszy.
 */
export const extremeSample: GraphicSample = {
  tournament: { name: 'Mistrzostwa Dzielnicy Białołęka 2026', logoUrl: null, primaryColor: '#1F7A45' },
  preview: {
    roundName: 'Ćwierćfinał',
    kickoffAt: '2026-10-17T16:30:00+00:00',
    venue: null,
    home: team('Akademia Piłkarska Białołęka'),
    away: team('Niedźwiedzie Mokotów'),
  },
  result: {
    roundName: 'Półfinał',
    home: team('Akademia Piłkarska Białołęka'),
    away: team('Niedźwiedzie Mokotów', UPLOADED_CREST),
    homeScore: 3,
    awayScore: 3,
    sets: null,
    penalties: { home: 4, away: 3 },
    scorers: {
      home: [
        { player: 'Bartłomiej Grzegorzewski', minute: '4′', ownGoal: false },
        { player: 'Jan Kowalczyk', minute: '28′', ownGoal: false },
        { player: 'Piotr Wiśniewski', minute: '45+2′', ownGoal: false },
      ],
      away: [
        { player: 'Konstanty Przybyszewski', minute: '12′', ownGoal: false },
        { player: 'Jan Kowalczyk', minute: '33′', ownGoal: true },
        { player: 'Adam Nowak', minute: null, ownGoal: false },
      ],
    },
  },
  standings: {
    afterRound: 12,
    scoreLabel: 'Bramki',
    rows: LONG_NAMES.map((name, index) => ({
      position: index + 1,
      team: team(name, index === 2 ? UPLOADED_CREST : null),
      played: 12,
      scoreFor: 40 - index * 2,
      scoreAgainst: 10 + index * 2,
      points: 34 - index * 2,
    })),
  },
  leaderboard: {
    label: 'Bramki',
    rows: [
      { position: 1, player: 'Konstanty Przybyszewski', team: team('Niedźwiedzie Mokotów'), value: 14 },
      { position: 2, player: 'Bartłomiej Grzegorzewski', team: team('Akademia Piłkarska Białołęka'), value: 11 },
      { position: 3, player: 'Marek Nowak', team: wilki, value: 9 },
      { position: 4, player: 'Adam Zieliński', team: sokoly, value: 8 },
      { position: 5, player: 'Rafał Duda', team: orly, value: 7 },
      { position: 5, player: 'Igor Wrzos', team: team('Lwy Ochota'), value: 7 },
      { position: 5, player: 'Paweł Lis', team: team('Żubry Praga'), value: 7 },
      { position: 5, player: 'Kamil Dąb', team: team('Rysie Wola'), value: 7 },
      { position: 5, player: 'Olaf Grab', team: team('Kosy Targówek'), value: 7 },
      { position: 10, player: 'Ernest Buk', team: team('Dziki Wesoła'), value: 6 },
    ],
  },
}
