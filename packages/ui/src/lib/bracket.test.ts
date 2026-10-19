import { describe, expect, it } from 'vitest'
import {
  bracketByes,
  bracketChampion,
  bracketLoserSide,
  bracketPosition,
  bracketRoundSummaries,
  bracketSeeding,
  bracketTeamIds,
  bracketTeamsInPlay,
  bracketTree,
  currentRoundOrder,
  isThirdPlaceMatch,
  matchLabel,
  type BracketMatch,
} from './bracket'
import { demoBracket, type DemoBracketMatch } from './demo-data'

/** Reguły odczytu drabinki (#234, DoD „Vitest (`packages/ui`)”). */

/** Mecz pucharu sześciu drużyn po pozycji `runda.numer`. */
function at(matches: readonly DemoBracketMatch[], order: number, matchNumber: number): DemoBracketMatch {
  return matches.find((match) => match.round.order === order && match.matchNumber === matchNumber)!
}

/** Zakończony mecz z wynikiem i karnymi; awansu nie liczy, bo reguły czytają tylko ten mecz. */
function finished(match: BracketMatch, homeScore: number, awayScore: number, homePenalties: number | null = null, awayPenalties: number | null = null): BracketMatch {
  return { ...match, status: 'finished', homeScore, awayScore, homePenalties, awayPenalties }
}

describe('etykiety pozycji', () => {
  it('przy 6 drużynach: ćwierćfinały 2 i 4, półfinały, mecz o 3. miejsce i finał', () => {
    const matches = demoBracket({ teams: 6 })

    expect(matches.map((match) => matchLabel(match, matches))).toEqual([
      'Ćwierćfinał 2',
      'Ćwierćfinał 4',
      'Półfinał 1',
      'Półfinał 2',
      'Finał',
      'Mecz o 3. miejsce',
    ])
  })

  it('pusty slot podpisuje źródło z krawędzi, także przegranego', () => {
    const matches = demoBracket({ teams: 6 })

    expect(bracketPosition(at(matches, 3, 1).id, matches)).toEqual({
      label: 'Finał',
      homeSource: 'Zwycięzca: Półfinał 1',
      awaySource: 'Zwycięzca: Półfinał 2',
    })
    expect(bracketPosition(at(matches, 3, 2).id, matches)).toEqual({
      label: 'Mecz o 3. miejsce',
      homeSource: 'Przegrany: Półfinał 1',
      awaySource: 'Przegrany: Półfinał 2',
    })
    // Półfinał 1: gospodarz z wolnego losu (bez źródła), gość z ćwierćfinału 2.
    expect(bracketPosition(at(matches, 2, 1).id, matches)).toEqual({
      label: 'Półfinał 1',
      homeSource: undefined,
      awaySource: 'Zwycięzca: Ćwierćfinał 2',
    })
  })
})

describe('wolne losy', () => {
  it.each([
    [6, [1, 2]],
    [5, [1, 2, 3]],
    [12, [1, 2, 3, 4]],
    [100, Array.from({ length: 28 }, (_, index) => index + 1)],
  ])('przy %i drużynach dostają je seedy 1…(2^k − n)', (teams, seeds) => {
    const byes = bracketByes(demoBracket({ teams }))

    expect(byes.map((bye) => bye.team.id).toSorted((a, b) => a - b)).toEqual(seeds)
  })

  it('przy 6 drużynach stoją na pozycjach 1 i 3, w miejscu brakujących ćwierćfinałów', () => {
    const matches = demoBracket({ teams: 6 })
    const byes = bracketByes(matches)

    expect(byes.map(({ team, position, side }) => [team.id, position, side])).toEqual([
      [1, 1, 'home'],
      [2, 3, 'home'],
    ])
    expect(
      bracketTree(matches)[0]!.slots.map((slot) =>
        slot.kind === 'match' ? matchLabel(slot.match, matches) : slot.kind === 'bye' ? `wolny los ${slot.bye.team.id}` : '–',
      ),
    ).toEqual(['wolny los 1', 'Ćwierćfinał 2', 'wolny los 2', 'Ćwierćfinał 4'])
  })
})

describe('rozstawienie odczytane z drabinki', () => {
  // Generator kładzie seed `s` na pozycji z `bracketSeedPositions`, a wolny
  // los od razu w 2. rundzie; odczyt musi odwrócić oba przypadki (#239).
  it.each([2, 3, 4, 5, 6, 7, 8, 11, 16, 23, 100])('przy %i drużynach wraca kolejność, z której drabinka powstała', (teams) => {
    expect(bracketSeeding(demoBracket({ teams })).map((team) => team.id)).toEqual(Array.from({ length: teams }, (_, index) => index + 1))
  })

  it('wyniki, awans i mecz o 3. miejsce nie zmieniają odczytu', () => {
    const names = ['Niedźwiedzie Mokotów', 'Jastrzębie Białołęka', 'Orły Bielany', 'Sokoły Ursus', 'Bobry Bemowo', 'Wilki Wola']
    for (const progress of [{ round: 2, finished: 1 }, 'done'] as const) {
      expect(bracketSeeding(demoBracket({ teams: 6, names, progress })).map((team) => team.name)).toEqual(names)
    }
  })

  it('pusta faza nie ma rozstawienia', () => {
    expect(bracketSeeding([])).toEqual([])
  })
})

describe('mistrz i mecz o 3. miejsce', () => {
  const matches = demoBracket({ teams: 4, progress: { round: 2, finished: 1 } })
  const third = at(matches, 2, 2)
  const final = at(matches, 2, 1)
  const withFinal = (match: BracketMatch) => matches.map((candidate) => (candidate.id === match.id ? match : candidate))

  it('mecz o 3. miejsce to mecz z krawędziami przegranego i w drzewie stoi pod finałem', () => {
    const tree = bracketTree(matches)

    expect(isThirdPlaceMatch(third, matches)).toBe(true)
    expect(isThirdPlaceMatch(final, matches)).toBe(false)
    expect(tree.at(-1)!.slots).toHaveLength(1)
    expect(tree.at(-1)!.third?.id).toBe(third.id)
  })

  it('mistrza nie ma przed końcem finału, także gdy mecz o 3. miejsce jest rozegrany', () => {
    expect(third.status).toBe('finished')
    expect(bracketChampion(matches)).toBeNull()
    expect(bracketChampion(withFinal({ ...finished(final, 2, 1), status: 'live' }))).toBeNull()
  })

  it('po finale finished mistrzem jest jego zwycięzca, także po karnych', () => {
    // Mistrz to drużyna drabinki (`BracketTeam`): id i nazwa, bez herbu z wiersza meczu.
    expect(bracketChampion(withFinal(finished(final, 2, 1)))).toEqual({ id: final.homeTeam!.id, name: final.homeTeam!.name })
    expect(bracketChampion(withFinal(finished(final, 1, 1, 3, 4)))).toEqual({ id: final.awayTeam!.id, name: final.awayTeam!.name })
  })

  it('zwycięzca meczu o 3. miejsce nie jest mistrzem', () => {
    const decided = matches.map((match) => (match.id === third.id ? finished(third, 5, 0) : match))

    expect(bracketChampion(decided)).toBeNull()
  })
})

describe('rundy', () => {
  it('krótkie nazwy przy 128 drużynach idą od 1/64 do Finał', () => {
    expect(bracketRoundSummaries(demoBracket({ teams: 128 })).map((round) => round.shortName)).toEqual([
      '1/64',
      '1/32',
      '1/16',
      '1/8',
      '1/4',
      '1/2',
      'Finał',
    ])
  })

  it('bieżąca runda to pierwsza z meczem innym niż finished', () => {
    expect(currentRoundOrder(demoBracket({ teams: 16 }))).toBe(1)
    expect(currentRoundOrder(demoBracket({ teams: 16, progress: { round: 2, finished: 3, live: 1 } }))).toBe(2)
    // Rozegrany mecz o 3. miejsce przy nierozegranym finale: dalej runda finału.
    expect(currentRoundOrder(demoBracket({ teams: 16, progress: { round: 4, finished: 1 } }))).toBe(4)
  })

  it('po finale bieżąca jest ostatnia runda', () => {
    expect(currentRoundOrder(demoBracket({ teams: 16, progress: 'done' }))).toBe(4)
    expect(currentRoundOrder([])).toBeNull()
  })

  it('w rundzie finału liczy się też mecz o 3. miejsce, a trwający mecz zapala rundę', () => {
    const rounds = bracketRoundSummaries(demoBracket({ teams: 8, progress: { round: 3, finished: 1, live: 1 } }))

    expect(rounds.map(({ finished, total, live }) => [finished, total, live])).toEqual([
      [4, 4, false],
      [2, 2, false],
      [1, 2, true],
    ])
  })
})

describe('drużyny w grze', () => {
  it('128 drużyn, 1/8 finału z 3 z 8 meczów rozegranymi: 13 w grze', () => {
    const matches = demoBracket({ teams: 128, progress: { round: 4, finished: 3 } })

    expect(bracketTeamsInPlay(matches)).toEqual({ inPlay: 13, total: 128 })
  })

  it('mecz o 3. miejsce nikogo nie odejmuje, a po finale w grze zostaje mistrz', () => {
    expect(bracketTeamsInPlay(demoBracket({ teams: 8, progress: { round: 3, finished: 1 } }))).toEqual({ inPlay: 2, total: 8 })
    expect(bracketTeamsInPlay(demoBracket({ teams: 8, progress: 'done' }))).toEqual({ inPlay: 1, total: 8 })
  })

  it('wolny los liczy się do drużyn fazy, choć nie gra w 1. rundzie', () => {
    expect(bracketTeamsInPlay(demoBracket({ teams: 6 }))).toEqual({ inPlay: 6, total: 6 })
  })
})

describe('bracketTeamIds', () => {
  it('bierze drużyny z wszystkich meczów, także z wolnym losem w 2. rundzie, bez pustych slotów', () => {
    const team = (id: number) => ({ id })
    const matches = [
      { homeTeam: team(2), awayTeam: team(3) },
      { homeTeam: team(1), awayTeam: null },
      { homeTeam: null, awayTeam: null },
    ]

    expect([...bracketTeamIds(matches)].toSorted()).toEqual([1, 2, 3])
  })
})

describe('bracketLoserSide', () => {
  const finished = { status: 'finished', homePenalties: null, awayPenalties: null } as const

  it('przegrany z wyniku, a przy remisie z karnych', () => {
    expect(bracketLoserSide({ ...finished, homeScore: 0, awayScore: 2 })).toBe('home')
    expect(bracketLoserSide({ ...finished, homeScore: 1, awayScore: 1, homePenalties: 5, awayPenalties: 4 })).toBe('away')
  })

  it('bez przegranego w meczu trwającym, w remisie bez karnych i bez wyniku', () => {
    expect(bracketLoserSide({ ...finished, status: 'live', homeScore: 0, awayScore: 2 })).toBeNull()
    expect(bracketLoserSide({ ...finished, homeScore: 1, awayScore: 1 })).toBeNull()
    expect(bracketLoserSide({ status: 'finished', homeScore: null, awayScore: null })).toBeNull()
  })
})
