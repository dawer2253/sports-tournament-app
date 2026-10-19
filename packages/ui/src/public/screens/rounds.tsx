/**
 * Terminarz i Wyniki strony publicznej (#288 wariant A, #292): nagłówek
 * ekranu z liczbą meczów, lista kolejek (`RoundSections`) i trzy puste
 * stany. Dane w propsach (#289 pkt 8): story podaje demo, a strona
 * w `apps/public` pobiera `/fixtures` i `/results` i grupuje je po kolejce.
 *
 * Ekran dostaje obie listy, bo Terminarz liczy postęp kolejki z całej
 * kolejki (także z meczów, które są już w Wynikach), a obie zakładki
 * rozróżniają po nich puste stany.
 */
import type { MatchRowData } from '../../components/data/match-row-data'
import type { RoundWithMatches } from '../../components/data/round-groups'
import { plural } from '../../lib/plural'
import { EmptyBoard } from '../board'
import { TextLink } from '../button'
import { Fact, PageHead } from '../heads'
import type { MatchListMode } from '../match-row'
import type { PublicNavKey } from '../public-nav'
import { RoundSections } from '../round-sections'
import { Loading, SkeletonBlock, SkeletonHead } from '../skeleton'

export interface MatchListScreenProps {
  /** `/fixtures` po kolejce, rosnąco. */
  fixtures: RoundWithMatches[]
  /** `/results` po kolejce, od najnowszej. */
  results: RoundWithMatches[]
  /** Strefa terminów; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Adres strony meczu. */
  matchHref?: (match: MatchRowData) => string
  onMatchNavigate?: (match: MatchRowData) => void
  /** Adres zakładki do odnośników pustych stanów, jak `Shell.navHref`. */
  navHref?: (key: PublicNavKey) => string | undefined
  onNavigate?: (key: PublicNavKey) => void
}

const FACT: Record<MatchListMode, readonly [string, string, string]> = {
  fixtures: ['mecz przed nami', 'mecze przed nami', 'meczów przed nami'],
  results: ['mecz zakończony', 'mecze zakończone', 'meczów zakończonych'],
}

const TITLE: Record<MatchListMode, string> = { fixtures: 'Terminarz', results: 'Wyniki' }

/**
 * Kolejki Terminarza z postępem całej kolejki: rozegrane i wszystkie mecze
 * liczone razem z Wynikami, a nie z meczów, które zostały w Terminarzu.
 */
function withRoundProgress(fixtures: RoundWithMatches[], results: RoundWithMatches[]): RoundWithMatches[] {
  const played = new Map(results.map((round) => [round.summary.id, round.summary]))
  return fixtures.map((round) => {
    const done = played.get(round.summary.id)
    if (!done) return round
    return {
      ...round,
      summary: { ...round.summary, finished: round.summary.finished + done.finished, total: round.summary.total + done.total },
    }
  })
}

function MatchListScreen({ mode, fixtures, results, timeZone, matchHref, onMatchNavigate, navHref, onNavigate }: MatchListScreenProps & { mode: MatchListMode }) {
  const rounds = mode === 'fixtures' ? withRoundProgress(fixtures, results) : results
  const count = rounds.reduce((sum, round) => sum + round.matches.length, 0)
  const link = (key: PublicNavKey, text: string) => (
    <TextLink href={navHref?.(key)} onNavigate={onNavigate && (() => onNavigate(key))}>
      {text}
    </TextLink>
  )

  return (
    <>
      <PageHead title={TITLE[mode]} meta={count > 0 && <Fact value={count}>{plural(count, FACT[mode])}</Fact>} />
      {rounds.length > 0 ? (
        <RoundSections rounds={rounds} mode={mode} timeZone={timeZone} matchHref={matchHref} onMatchNavigate={onMatchNavigate} />
      ) : fixtures.length === 0 && results.length === 0 ? (
        <EmptyBoard title="Terminarz jeszcze nie jest ułożony" action={link('home', 'Zobacz drużyny na Przeglądzie')}>
          Mecze pojawią się tutaj, gdy organizator ułoży terminarz.
        </EmptyBoard>
      ) : mode === 'fixtures' ? (
        <EmptyBoard title="Wszystkie mecze rozegrane" action={link('results', 'Zobacz wyniki')}>
          W terminarzu nie został żaden mecz. Wszystkie wyniki są w Wynikach.
        </EmptyBoard>
      ) : (
        <EmptyBoard title="Jeszcze nie ma wyników" action={link('fixtures', 'Zobacz terminarz')}>
          Pierwsze wyniki pojawią się tutaj po pierwszym zakończonym meczu.
        </EmptyBoard>
      )}
    </>
  )
}

/** Terminarz: kolejki rosnąco, z godziną i postępem kolejki. */
export function FixturesScreen(props: MatchListScreenProps) {
  return <MatchListScreen mode="fixtures" {...props} />
}

/** Wyniki: kolejki od najnowszej, z krótkim dniem w wierszu, bez postępu. */
export function ResultsScreen(props: MatchListScreenProps) {
  return <MatchListScreen mode="results" {...props} />
}

/**
 * Wczytywanie Terminarza i Wyników: szkielet w kształcie ekranu (#288),
 * nagłówek, belka kolejki i wiersze meczów. `label` w dopełniaczu,
 * np. „terminarza”.
 */
export function MatchListLoading({ label }: { label: string }) {
  return (
    <Loading label={`Wczytywanie ${label}`}>
      <SkeletonHead />
      {[4, 3].map((rows, index) => (
        <div key={index} className="flex flex-col gap-1">
          <SkeletonBlock className="mb-2 h-9 w-56 max-w-full" />
          {Array.from({ length: rows }, (_, row) => (
            <SkeletonBlock key={row} className="h-16 w-full" />
          ))}
        </div>
      ))}
    </Loading>
  )
}
