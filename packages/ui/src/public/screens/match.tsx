/**
 * Strona meczu (#295, projekt A „Tablica” z #288): powrót, tablica i relacja,
 * w tej kolejności także na telefonie. Dane w propsach (#289 pkt 8): story
 * podaje demo, a strona w `apps/public` pobiera mecz, wybiera stan
 * (`MatchLoading`, `LoadError`, `MatchNotFound`) i podaje adresy.
 */
import type { MatchPageData } from '../../components/data/match-page-data'
import { BackTo } from '../button'
import { MatchBoard } from '../match-board'
import { MatchRelation } from '../match-relation'
import { TAB_LABELS } from '../public-nav'
import { Loading, SkeletonBlock } from '../skeleton'

/** Zakładka, do której wraca strona meczu. */
export type MatchBackTab = 'fixtures' | 'results'

/**
 * Powrót według stanu meczu (#210): zaplanowany do Terminarza, trwający
 * i zakończony do Wyników — a nie historią przeglądarki, bo kibic
 * z zewnętrznego linku nie ma dokąd wrócić.
 */
function matchBackTab(status: MatchPageData['status']): MatchBackTab {
  return status === 'scheduled' ? 'fixtures' : 'results'
}

export interface MatchScreenProps {
  match: MatchPageData
  /** Adres zakładki powrotu. */
  backHref?: (tab: MatchBackTab) => string
  /** Przejęcie kliknięcia w powrót, np. przez router. */
  onNavigate?: (tab: MatchBackTab) => void
  /** Strefa terminu; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
}

export function MatchScreen({ match, backHref, onNavigate, timeZone }: MatchScreenProps) {
  const back = matchBackTab(match.status)
  return (
    <div className="-mt-4 flex flex-col gap-6">
      <BackTo href={backHref?.(back)} onNavigate={onNavigate && (() => onNavigate(back))}>
        {TAB_LABELS[back]}
      </BackTo>
      <MatchBoard match={match} timeZone={timeZone} />
      <MatchRelation
        status={match.status}
        homeTeamId={match.homeTeam?.id ?? null}
        events={match.events}
        periods={match.periods}
        className="mx-auto w-full max-w-3xl"
      />
    </div>
  )
}

/** Wczytywanie strony meczu: szkielet w kształcie ekranu (powrót, tablica, relacja). */
export function MatchLoading() {
  return (
    <Loading label="Wczytywanie meczu" className="-mt-4 gap-6">
      <SkeletonBlock className="h-11 w-24" />
      <span data-slot="match-skeleton-board" className="flex flex-col items-center gap-6 rounded-md bg-card px-4 py-8 ring-1 ring-border ring-inset sm:px-10 sm:py-10">
        <SkeletonBlock className="h-4 w-64 max-w-full" />
        <span className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-8">
          <SkeletonBlock className="size-12 justify-self-center rounded-full sm:size-24" />
          <SkeletonBlock className="h-16 w-32 sm:h-32 sm:w-64" />
          <SkeletonBlock className="size-12 justify-self-center rounded-full sm:size-24" />
        </span>
      </span>
      <span className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        <SkeletonBlock className="mb-2 h-8 w-48 max-w-full" />
        {Array.from({ length: 5 }, (_, index) => (
          <SkeletonBlock key={index} className="h-14 w-full" />
        ))}
      </span>
    </Loading>
  )
}
