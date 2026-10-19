import { describe, expect, it } from 'vitest'
import { groupByRound, type MatchInRound } from '../components/data/round-groups'
import { overviewBracketStage, overviewRounds, showcaseTeams } from './overview-stage'

type Status = MatchInRound['status']

/** Mecz kolejki `round` o stanie `status`, z terminem `kickoffAt`. */
function match(id: number, round: number, status: Status = 'scheduled', kickoffAt: string | null = `2026-09-0${round}T10:00:00+00:00`): MatchInRound {
  const played = status !== 'scheduled'
  return {
    id,
    round: { id: round, name: `Kolejka ${round}`, order: round },
    homeTeam: { id: id * 2 - 1, name: `Gospodarz ${id}`, logoUrl: null },
    awayTeam: { id: id * 2, name: `Gość ${id}`, logoUrl: null },
    homeScore: played ? 1 : null,
    awayScore: played ? 0 : null,
    status,
    kickoffAt,
    venue: null,
  }
}

const fixtures = (matches: MatchInRound[]) => groupByRound(matches)
const results = (matches: MatchInRound[]) => groupByRound(matches, { direction: 'desc' })
const ids = (matches: readonly { id: number }[]) => matches.map((item) => item.id)

describe('overviewRounds', () => {
  it('etap to kolejka Terminarza z meczami z obu list, a „2 z 4 rozegrane” liczy obie', () => {
    const stage = overviewRounds(
      fixtures([match(3, 2, 'live'), match(4, 2), match(5, 3)]),
      results([match(1, 2, 'finished', '2026-09-01T09:00:00+00:00'), match(2, 2, 'finished', '2026-09-01T08:00:00+00:00'), match(0, 1, 'finished')]),
    )

    expect(stage.stage?.round.summary).toMatchObject({ id: 2, name: 'Kolejka 2', finished: 2, total: 4 })
    // Po terminie, mecz trwający i zaplanowany po zakończonych.
    expect(ids(stage.stage!.round.matches)).toEqual([2, 1, 3, 4])
    expect(stage.stage?.position).toBe('current')
    expect(stage.next?.summary.id).toBe(3)
    expect(stage.roundsTotal).toBe(3)
    expect(stage.startsAt).toBeNull()
  })

  it('kolejka Terminarza, nie ta z najwcześniejszym terminem w Wynikach', () => {
    // Przełożony mecz kolejki 1 rozegrano po kolejce 3: Wyniki otwierają się na nim, Terminarz na kolejce 4.
    const stage = overviewRounds(fixtures([match(9, 4)]), results([match(1, 1, 'finished', '2026-09-20T10:00:00+00:00'), match(5, 3, 'finished')]))

    expect(stage.stage?.round.summary.id).toBe(4)
  })

  it('przed startem: pierwsza kolejka i termin pierwszego meczu', () => {
    const stage = overviewRounds(fixtures([match(2, 1, 'scheduled', '2026-09-05T12:00:00+00:00'), match(1, 1, 'scheduled', '2026-09-05T10:00:00+00:00'), match(3, 2, 'scheduled', '2026-09-12T10:00:00+00:00')]), [])

    expect(stage.stage?.round.summary.id).toBe(1)
    expect(stage.stage?.position).toBe('first')
    expect(stage.startsAt).toBe('2026-09-05T10:00:00+00:00')
  })

  it('mecz trwający w 1. kolejce to już nie „przed startem”', () => {
    const stage = overviewRounds(fixtures([match(1, 1, 'live'), match(2, 1)]), [])

    expect(stage.stage?.position).toBe('current')
    expect(stage.startsAt).toBeNull()
  })

  it('po końcu: Terminarz pusty, więc kolejka, na której otwierają się Wyniki, i bez następnej', () => {
    const stage = overviewRounds([], results([match(1, 1, 'finished'), match(2, 2, 'finished'), match(3, 3, 'finished')]))

    expect(stage.stage?.round.summary.id).toBe(3)
    expect(stage.stage?.position).toBe('last')
    expect(stage.next).toBeNull()
  })

  it('bez meczów nie ma etapu (stan „Bez terminarza”)', () => {
    expect(overviewRounds([], []).stage).toBeNull()
  })
})

/** Mecz drabinki na czterech: półfinały (runda 1) i finał (runda 2). */
function knockout(id: number, order: number, status: Status, extra: Partial<MatchInRound> = {}): MatchInRound {
  return { ...match(id, order, status), round: { id: 10 + order, name: order === 1 ? 'Półfinał' : 'Finał', order }, ...extra }
}

describe('overviewBracketStage', () => {
  it('etap to runda z pierwszym meczem niezakończonym, z kompletem jej meczów, a obok mecze następnej rundy', () => {
    const { stage, next } = overviewBracketStage([knockout(1, 1, 'finished'), knockout(2, 1, 'live'), knockout(3, 2, 'scheduled', { homeTeam: null, awayTeam: null })])

    expect(stage?.round.summary).toMatchObject({ name: 'Półfinał', finished: 1, total: 2 })
    expect(stage?.position).toBe('current')
    expect(next && ids(next.matches)).toEqual([3])
  })

  it('przed startem pierwsza runda, po finale ostatnia i bez następnych meczów', () => {
    expect(overviewBracketStage([knockout(1, 1, 'scheduled'), knockout(2, 1, 'scheduled'), knockout(3, 2, 'scheduled')]).stage?.position).toBe('first')

    const done = overviewBracketStage([knockout(1, 1, 'finished'), knockout(2, 1, 'finished'), knockout(3, 2, 'finished')])
    expect(done.stage?.round.summary.name).toBe('Finał')
    expect(done.stage?.position).toBe('last')
    expect(done.next).toBeNull()
  })

  it('drabinka bez meczów nie ma etapu', () => {
    expect(overviewBracketStage([]).stage).toBeNull()
  })
})

describe('showcaseTeams', () => {
  it('układa drużyny alfabetycznie po polsku: Ł po L, przed O', () => {
    const teams = ['Orły', 'Łosie', 'Lwy'].map((name, index) => ({ id: index, name, logoUrl: null }))

    expect(showcaseTeams(teams).map((team) => team.name)).toEqual(['Lwy', 'Łosie', 'Orły'])
  })
})
