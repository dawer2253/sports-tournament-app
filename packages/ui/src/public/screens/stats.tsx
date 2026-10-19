/**
 * Ekran Statystyki strony publicznej (#294): zakładki statystyk, lider,
 * cała klasyfikacja i boczna kolumna z liderami pozostałych statystyk.
 * Dane w propsach (#289 pkt 8): strona w `apps/public` pobiera klasyfikację
 * każdej statystyki osobnym zapytaniem, obsługuje wczytywanie i błąd głównej
 * i trzyma wybór w adresie (`?stat=`).
 */
import { LEADERBOARD_EMPTY, type Leaderboard, type StatOption } from '../../components/data/leaderboard-data'
import { EmptyBoard } from '../board'
import { PageHead } from '../heads'
import { Loading, SkeletonBlock, SkeletonHead } from '../skeleton'
import { OTHER_STAT_ROWS, OtherStatLeaders, StatLeaders, StatRanking, StatTabs, type StatBoard } from '../stats'

const EYEBROW = 'Klasyfikacja zawodników'
const TITLE = 'Statystyki'

export interface StatsScreenProps {
  /** `PublicTournament.stats`; ekran z pustą listą rysuje `NoStats`. */
  stats: StatOption[]
  /** Kod wybranej statystyki. */
  value: string
  /** Klasyfikacja wybranej statystyki (wczytana; wczytywanie i błąd obsługuje strona). */
  leaderboard: Leaderboard
  /** Klasyfikacje pozostałych statystyk do bocznej kolumny, po kodzie. */
  boards: Record<string, StatBoard>
  /** Adres statystyki: pierwsza bez `?stat=`, więc jedna klasyfikacja ma jeden adres. */
  statHref?: (code: string) => string
  /** Wybór statystyki zakładką albo „Cała klasyfikacja”: zgłasza kod. */
  onValueChange: (code: string) => void
}

export function StatsScreen({ stats, value, leaderboard, boards, statHref, onValueChange }: StatsScreenProps) {
  return (
    <>
      <PageHead eyebrow={EYEBROW} title={TITLE} />
      <StatTabs stats={stats} value={value} onValueChange={onValueChange}>
        {leaderboard.rows.length === 0 ? (
          // Przed pierwszym meczem zakończonym pusta jest każda klasyfikacja, więc bez bocznej kolumny.
          <EmptyBoard title={LEADERBOARD_EMPTY}>Liczą się zdarzenia z meczów zakończonych, ze wszystkich faz turnieju.</EmptyBoard>
        ) : (
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-14">
            <div className="flex min-w-0 flex-col gap-8">
              <StatLeaders leaderboard={leaderboard} />
              <StatRanking leaderboard={leaderboard} />
              <p className="text-pub-13 text-muted-foreground">
                Klasyfikacja obejmuje mecze zakończone ze wszystkich faz turnieju. Zawodnicy z równą wartością dzielą miejsce.
              </p>
            </div>
            <OtherStatLeaders stats={stats} value={value} boards={boards} statHref={statHref} onValueChange={onValueChange} />
          </div>
        )}
      </StatTabs>
    </>
  )
}

/** Turniej bez statystyk (sport bez `availableStats`). */
export function NoStats() {
  return (
    <>
      <PageHead eyebrow={EYEBROW} title={TITLE} />
      <EmptyBoard title="Ten turniej nie ma statystyk">Sport tego turnieju nie liczy statystyk zawodników.</EmptyBoard>
    </>
  )
}

/** Wczytywanie: szkielet w kształcie ekranu (nagłówek, zakładki, lider, klasyfikacja, boczna kolumna). */
export function StatsLoading() {
  return (
    <Loading label="Wczytywanie statystyk">
      <SkeletonHead />
      <div className="flex gap-7">
        {[0, 1, 2].map((index) => (
          <SkeletonBlock key={index} className="h-8 w-24" />
        ))}
      </div>
      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-14">
        <div className="flex flex-col gap-8">
          <SkeletonBlock className="h-40 w-full" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <SkeletonBlock key={index} className="h-14 w-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <SkeletonBlock className="mb-2 h-8 w-40" />
          {Array.from({ length: OTHER_STAT_ROWS }, (_, index) => (
            <SkeletonBlock key={index} className="h-11 w-full" />
          ))}
        </div>
      </div>
    </Loading>
  )
}
