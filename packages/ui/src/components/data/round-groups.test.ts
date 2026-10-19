import { describe, expect, it } from 'vitest'
import type { MatchStatus } from './match-row-data'
import { ROUNDS_PER_PAGE, roundsPage, type RoundWithMatches } from './round-groups'

/** Kolejki o podanych id, każda z jednym meczem w stanie z `live` albo zaplanowanym. */
function rounds(ids: number[], live: number[] = []): RoundWithMatches[] {
  return ids.map((id) => {
    const status: MatchStatus = live.includes(id) ? 'live' : 'scheduled'
    return {
      summary: { id, name: `Kolejka ${id}`, dates: '', finished: 0, total: 1 },
      matches: [
        {
          id,
          homeTeam: { id: 1, name: 'A', logoUrl: null },
          awayTeam: { id: 2, name: 'B', logoUrl: null },
          homeScore: null,
          awayScore: null,
          status,
          kickoffAt: null,
          venue: null,
        },
      ],
    }
  })
}

describe('roundsPage', () => {
  it('na start pokazuje trzy kolejki, a „Pokaż więcej” sięga do szóstej', () => {
    const page = roundsPage(rounds([1, 2, 3, 4, 5, 6, 7]), null)

    expect(ROUNDS_PER_PAGE).toBe(3)
    expect(page).toEqual({ shown: 3, lastShown: 3, more: 6 })
  })

  it('pierwsza porcja sięga do ostatniej kolejki z meczem trwającym włącznie', () => {
    expect(roundsPage(rounds([1, 2, 3, 4, 5, 6, 7, 8, 9], [2, 5]), null)).toEqual({ shown: 5, lastShown: 5, more: 8 })
  })

  it('zapamiętana kolejka trzyma porcję, także gdy nad nią doszła nowa', () => {
    // Wyniki od najnowszej: kibic doczytał do kolejki 2, a na górze stanęła kolejka 8.
    expect(roundsPage(rounds([8, 7, 6, 5, 4, 3, 2, 1]), 2)).toEqual({ shown: 7, lastShown: 2, more: 1 })
  })

  it('porcja nie kurczy się, gdy mecz trwający w dalszej kolejce się zakończy', () => {
    expect(roundsPage(rounds([1, 2, 3, 4, 5, 6]), 5)).toEqual({ shown: 5, lastShown: 5, more: 6 })
  })

  it('gdy zapamiętanej kolejki nie ma w danych, wraca do domyślnej porcji', () => {
    expect(roundsPage(rounds([1, 2, 3, 4, 5, 7]), 6)).toEqual({ shown: 3, lastShown: 3, more: 7 })
  })

  it('przy komplecie na ekranie nie ma czego doczytywać', () => {
    expect(roundsPage(rounds([1, 2]), null)).toEqual({ shown: 2, lastShown: 2, more: null })
    expect(roundsPage([], null)).toEqual({ shown: 0, lastShown: null, more: null })
  })
})
