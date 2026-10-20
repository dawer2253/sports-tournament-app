import { describe, expect, it } from 'vitest'
import { matchClock, periodLabel, setLabel, periodLabelGenitive, type MatchClockSettings, type MatchClockState } from './match-clock'

const KICKOFF = Date.parse('2026-09-27T10:00:00Z')
const minute = 60_000

/** Chwila `minutes` pełnych minut (plus kilka sekund) po `start`. */
const after = (start: number, minutes: number, seconds = 20) => new Date(start + minutes * minute + seconds * 1000)

const football: MatchClockSettings = { periods: { count: 2, minutes: 45 }, matchDuration: 60, runningClock: true }
const short: MatchClockSettings = { periods: { count: 2, minutes: 30 }, matchDuration: 70, runningClock: true }
const basketball: MatchClockSettings = { periods: { count: 4, minutes: 10 }, matchDuration: 40, runningClock: false }
const undivided: MatchClockSettings = { periods: { count: 1, minutes: null }, matchDuration: 60, runningClock: true }

function running(livePeriod: number, start: number): MatchClockState {
  return { livePeriod, periodStartedAt: new Date(start).toISOString(), onBreak: false }
}

describe('etykieta części', () => {
  it('ma mianownik i dopełniacz według liczby części, nie sportu', () => {
    expect([2, 3, 4, 5].map((count) => periodLabel(2, count))).toEqual(['2. połowa', '2. tercja', '2. kwarta', '2. część'])
    expect([2, 3, 4, 5].map((count) => periodLabelGenitive(2, count))).toEqual(['2. połowy', '2. tercji', '2. kwarty', '2. części'])
  })
})

describe('zegar meczu', () => {
  it('2. połowa startuje od 46′ niezależnie od tego, kiedy skończyła się 1.', () => {
    // 1. połowa skończona po 45+3′ albo przy 43′: wynik zależy tylko od części i jej startu.
    const afterLongHalf = KICKOFF + 48 * minute + 15 * minute
    const afterShortHalf = KICKOFF + 43 * minute + 15 * minute
    expect(matchClock(running(2, afterLongHalf), football, after(afterLongHalf, 0))).toBe('46′')
    expect(matchClock(running(2, afterShortHalf), football, after(afterShortHalf, 0))).toBe('46′')
  })

  it('liczy minutę jako pełne minuty od startu części plus minutę startu', () => {
    expect(matchClock(running(1, KICKOFF), football, after(KICKOFF, 0, 0))).toBe('1′')
    expect(matchClock(running(1, KICKOFF), football, after(KICKOFF, 0, 59))).toBe('1′')
    expect(matchClock(running(1, KICKOFF), football, after(KICKOFF, 1, 0))).toBe('2′')
    expect(matchClock(running(2, KICKOFF), football, after(KICKOFF, 21))).toBe('67′')
  })

  it('po regulaminowym czasie części pokazuje doliczony', () => {
    expect(matchClock(running(1, KICKOFF), football, after(KICKOFF, 44))).toBe('45′')
    expect(matchClock(running(1, KICKOFF), football, after(KICKOFF, 45))).toBe('45+1′')
    expect(matchClock(running(1, KICKOFF), football, after(KICKOFF, 47))).toBe('45+3′')
    expect(matchClock(running(2, KICKOFF), football, after(KICKOFF, 48))).toBe('90+4′')
  })

  it('bierze długość części z turnieju: 2 × 30 startuje 2. połowę od 31′ i dolicza do 30, nigdy do 45', () => {
    expect(matchClock(running(2, KICKOFF), short, after(KICKOFF, 0))).toBe('31′')
    expect(matchClock(running(1, KICKOFF), short, after(KICKOFF, 30))).toBe('30+1′')
    expect(matchClock(running(1, KICKOFF), short, after(KICKOFF, 40))).toBe('30+11′')
    expect(matchClock(running(2, KICKOFF), short, after(KICKOFF, 31))).toBe('60+2′')
  })

  it('zapomniany mecz: po 30 minutach ponad koniec części zostaje samo „Na żywo”, w każdej części', () => {
    expect(matchClock(running(2, KICKOFF), football, after(KICKOFF, 74))).toBe('90+30′')
    expect(matchClock(running(2, KICKOFF), football, after(KICKOFF, 75))).toBeNull()
    expect(matchClock(running(1, KICKOFF), football, after(KICKOFF, 74))).toBe('45+30′')
    expect(matchClock(running(1, KICKOFF), football, after(KICKOFF, 75))).toBeNull()
    expect(matchClock(running(2, KICKOFF), short, after(KICKOFF, 59))).toBe('60+30′')
    expect(matchClock(running(2, KICKOFF), short, after(KICKOFF, 60))).toBeNull()
    expect(matchClock(running(1, KICKOFF), football, after(KICKOFF, 600))).toBeNull()
  })

  it('turniej bez podziału liczy od startu do długości meczu, potem doliczony, a po 30 ponad nią samo „Na żywo”', () => {
    expect(matchClock(running(1, KICKOFF), undivided, after(KICKOFF, 50))).toBe('51′')
    expect(matchClock(running(1, KICKOFF), undivided, after(KICKOFF, 75))).toBe('60+16′')
    expect(matchClock(running(1, KICKOFF), undivided, after(KICKOFF, 89))).toBe('60+30′')
    expect(matchClock(running(1, KICKOFF), undivided, after(KICKOFF, 90))).toBeNull()
  })

  it('w przerwie pokazuje „Przerwa”, także w koszykówce', () => {
    const onBreak: MatchClockState = { livePeriod: 1, periodStartedAt: null, onBreak: true }
    expect(matchClock(onBreak, football, after(KICKOFF, 50))).toBe('Przerwa')
    expect(matchClock({ ...onBreak, livePeriod: 2 }, basketball, after(KICKOFF, 50))).toBe('Przerwa')
  })

  it('w sporcie bez biegnącego zegara pokazuje część zamiast minuty', () => {
    expect(matchClock(running(3, KICKOFF), basketball, after(KICKOFF, 4))).toBe('3. kwarta')
    expect(matchClock(running(3, KICKOFF), basketball, after(KICKOFF, 400))).toBe('3. kwarta')
  })

  it('część po ostatniej to „Dogrywka” bez minuty', () => {
    expect(matchClock(running(3, KICKOFF), football, after(KICKOFF, 7))).toBe('Dogrywka')
    expect(matchClock(running(5, KICKOFF), basketball, after(KICKOFF, 2))).toBe('Dogrywka')
    expect(matchClock(running(2, KICKOFF), undivided, after(KICKOFF, 2))).toBe('Dogrywka')
  })

  it('po powrocie z zakończonego pokazuje samo „Na żywo”: ani przerwy, ani minuty', () => {
    const reopened: MatchClockState = { livePeriod: 2, periodStartedAt: null, onBreak: false }
    expect(matchClock(reopened, football, after(KICKOFF, 5))).toBeNull()
    expect(matchClock(reopened, basketball, after(KICKOFF, 5))).toBeNull()
  })

  it('zegar przeglądarki w tyle za serwerem daje minutę startu części, nigdy mniejszą ani ujemną', () => {
    expect(matchClock(running(2, KICKOFF), football, new Date(KICKOFF - 3 * minute))).toBe('46′')
    expect(matchClock(running(1, KICKOFF), football, new Date(KICKOFF - 90 * minute))).toBe('1′')
  })

  it('mecz bez części (dane sprzed zegara) albo z błędną datą pokazuje samo „Na żywo”', () => {
    expect(matchClock({ livePeriod: null, periodStartedAt: null, onBreak: false }, football, after(KICKOFF, 5))).toBeNull()
    expect(matchClock({ livePeriod: 1, periodStartedAt: 'nie data', onBreak: false }, football, after(KICKOFF, 5))).toBeNull()
  })
})

describe('numer seta w sporcie z setami (#302)', () => {
  const volleyball: MatchClockSettings = {
    periods: { count: 1, minutes: null },
    matchDuration: 90,
    runningClock: false,
    setFormat: { setsToWin: 3, setPoints: 25, decidingSetPoints: 15, minLead: 2 },
  }
  const live = (sets: { home: number; away: number }[] | null): MatchClockState => ({
    livePeriod: 1,
    periodStartedAt: new Date(KICKOFF).toISOString(),
    onBreak: false,
    sets,
  })
  const now = after(KICKOFF, 5)

  it('ma etykietę w mianowniku', () => {
    expect(setLabel(3)).toBe('3. set')
  })

  it('bez wpisanych setów to 1. set', () => {
    expect(matchClock(live(null), volleyball, now)).toBe('1. set')
    expect(matchClock(live([]), volleyball, now)).toBe('1. set')
  })

  it('niedokończony set to bieżący numer', () => {
    expect(matchClock(live([{ home: 25, away: 21 }, { home: 18, away: 25 }, { home: 14, away: 12 }]), volleyball, now)).toBe('3. set')
  })

  it('rozstrzygnięty set przy 1:1 daje następny', () => {
    expect(matchClock(live([{ home: 25, away: 21 }, { home: 18, away: 25 }]), volleyball, now)).toBe('3. set')
  })

  it('gra na przewagi trwa w tym samym secie, a 5. set liczy się do progu 15', () => {
    expect(matchClock(live([{ home: 25, away: 24 }]), volleyball, now)).toBe('1. set')
    const two = [{ home: 25, away: 20 }, { home: 22, away: 25 }, { home: 25, away: 23 }, { home: 20, away: 25 }]
    expect(matchClock(live(two), volleyball, now)).toBe('5. set')
    expect(matchClock(live([...two, { home: 14, away: 13 }]), volleyball, now)).toBe('5. set')
  })

  it('przesądzony wynik meczu to samo „Na żywo”, bez nieistniejącego 4. seta', () => {
    const won = [{ home: 25, away: 20 }, { home: 25, away: 20 }, { home: 25, away: 20 }]
    expect(matchClock(live(won), volleyball, now)).toBeNull()
  })

  it('bez zegara meczu (brak części) nie ma numeru seta, a koszykówka zostaje przy kwartach', () => {
    expect(matchClock({ ...live([]), livePeriod: null }, volleyball, now)).toBeNull()
    expect(matchClock({ ...running(3, KICKOFF), sets: null }, basketball, now)).toBe('3. kwarta')
  })
})
