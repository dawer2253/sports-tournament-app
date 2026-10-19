/** Mecz fazy w tym zakresie, w jakim liczy go nagłówek Tabeli. */
export interface ProgressMatch {
  round: { id: number }
  status: 'scheduled' | 'live' | 'finished'
  kickoffAt: string | null
}

/** Postęp terminarza fazy do faktów w nagłówku Tabeli. */
export interface ScheduleProgress {
  /** Kolejki, w których wszystkie mecze są `finished`. */
  roundsPlayed: number
  /** Wszystkie kolejki terminarza fazy, także jeszcze niegrane. */
  roundsTotal: number
  /**
   * Najwcześniejszy termin meczu fazy, gdy żaden mecz jeszcze się nie
   * zaczął (ani `live`, ani `finished`); inaczej `null`, także w terminarzu
   * bez dat.
   */
  startsAt: string | null
}

/**
 * Postęp terminarza z kompletu meczów fazy (`/matches?stageId=`). Kolejka
 * liczy się jako rozegrana dopiero, gdy skończył się jej ostatni mecz:
 * kolejka z meczem trwającym albo przełożonym jest jeszcze w grze. `null`,
 * gdy faza nie ma meczów (stan „Bez terminarza”).
 */
export function scheduleProgress(matches: readonly ProgressMatch[]): ScheduleProgress | null {
  if (matches.length === 0) return null

  const rounds = new Map<number, boolean>()
  for (const match of matches) rounds.set(match.round.id, (rounds.get(match.round.id) ?? true) && match.status === 'finished')

  const started = matches.some((match) => match.status !== 'scheduled')
  const kickoffs = matches.map((match) => match.kickoffAt).filter((iso): iso is string => iso !== null)

  return {
    roundsPlayed: [...rounds.values()].filter(Boolean).length,
    roundsTotal: rounds.size,
    // Napisy `kickoffAt` mają w API jeden offset, więc sortują się jak momenty.
    startsAt: started || kickoffs.length === 0 ? null : kickoffs.toSorted()[0]!,
  }
}
