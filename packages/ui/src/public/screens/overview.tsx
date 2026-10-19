/**
 * Ekran Przegląd strony publicznej (#296, wariant C „Kolejka” z #287):
 * pas bieżącego etapu na górze, w miejscu tabeli to, co pokazuje stan
 * turnieju (tabela, tabele grup albo drabinka), obok następna kolejka albo
 * najbliższe mecze i lider klasyfikacji, po końcu pas „Mistrz”. Przed
 * terminarzem sama prezentacja drużyn (`TeamsShowcase`).
 *
 * Dane w propsach (#289 pkt 8). Każda sekcja dostaje stan swojego źródła
 * (`Loadable`): pokazuje się, gdy ono dotrze, a jego błąd nie zdejmuje
 * pozostałych.
 */
import * as React from 'react'
import type { Leaderboard } from '../../components/data/leaderboard-data'
import { LEADERBOARD_EMPTY } from '../../components/data/leaderboard-data'
import type { MatchInRound, RoundWithMatches } from '../../components/data/round-groups'
import { bracketFinal, bracketWinnerSide, teamOn } from '../../lib/bracket'
import { formatKickoff, formatShortDay, matchDays } from '../../lib/kickoff'
import { Anchor } from '../anchor'
import { ErrorBoard } from '../board'
import { BracketTree, type PublicBracketMatch } from '../bracket'
import { TextLink } from '../button'
import { SectionHead } from '../heads'
import type { OverviewStage } from '../overview-stage'
import type { PublicNavKey } from '../public-nav'
import { Loading, SkeletonBlock, SkeletonHead } from '../skeleton'
import { matchPairLabel, StageBand } from '../stage-band'
import { ChampionBand, GroupTable, StandingsTable, type GroupTableData } from '../standings-table'
import type { StandingsTableRow } from '../standings-table-row'
import { StatLeaders } from '../stats'

/** Stan źródła jednej sekcji: wczytywanie, błąd z ponowieniem albo dane. */
export type Loadable<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string; onRetry: () => void }
  | { status: 'ready'; data: T }

/**
 * Stan turnieju z jego faz („Format” w `CONTEXT.md`): liga, puchar, grupy
 * przed drabinką i grupy po jej wygenerowaniu (playoff).
 */
export type OverviewMode = 'league' | 'knockout' | 'groups' | 'playoff'

/** Mecz pasa i bocznej kolumny: wiersz meczu z kolejką. */
export type OverviewMatch = MatchInRound

/** Etap w pasie z tym, co stoi obok: następna kolejka albo najbliższe mecze. */
export interface OverviewSchedule<M extends OverviewMatch = OverviewMatch> {
  stage: OverviewStage<M>
  /** Liga i grupy: następna kolejka Terminarza; puchar i playoff: mecze następnej rundy. */
  next: RoundWithMatches<M> | null
  /** Liga: wszystkie kolejki („z 14 kolejek”). */
  roundsTotal?: number
  /** Liga przed startem: termin pierwszego meczu pod nagłówkiem tabeli. */
  startsAt?: string | null
}

/** Tabela ligi z odpowiedzi `/standings`. */
export interface OverviewLeagueTable {
  rows: readonly StandingsTableRow[]
  scoreLabel: string
  allowsDraw: boolean
}

export interface OverviewScreenProps<M extends OverviewMatch = OverviewMatch, B extends PublicBracketMatch = PublicBracketMatch> {
  mode: OverviewMode
  /** `PublicTournament.status === 'finished'`: pas „Mistrz”, bez następnej kolejki. */
  finished: boolean
  /** Pas etapu i boczna kolumna z tego samego źródła (listy meczów). */
  schedule: Loadable<OverviewSchedule<M>>
  /** Liga: tabela z formą. */
  table?: Loadable<OverviewLeagueTable>
  /** Grupy przed drabinką: tabele wszystkich grup w kolejności `Group.order`. */
  groups?: Loadable<readonly GroupTableData[]>
  /** Puchar i playoff: komplet meczów fazy pucharowej. */
  bracket?: Loadable<readonly B[]>
  /** Klasyfikacja domyślnej statystyki. */
  leaderboard: Loadable<Leaderboard>
  /** Strefa terminów; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Adres strony meczu (tablica, wiersz, kafel drabinki). */
  matchHref?: (match: { id: number }) => string
  onMatchNavigate?: (match: { id: number }) => void
  /** Adres zakładki dla odnośników sekcji. */
  navHref?: (key: PublicNavKey) => string | undefined
  onNavigate?: (key: PublicNavKey) => void
}

/** Odnośnik do zakładki w kształcie propsów `Anchor`. */
type TabLink = (key: PublicNavKey) => { href?: string; onNavigate?: () => void }

/** Sekcja z jednego źródła: szkielet przy pierwszym wczytaniu, błąd z ponowieniem albo treść. */
function Section<T>({
  state,
  label,
  rows = 4,
  children,
}: {
  state: Loadable<T>
  /** Nazwa treści w dopełniaczu, np. „tabeli”. */
  label: string
  rows?: number
  children: (data: T) => React.ReactNode
}) {
  if (state.status === 'loading') {
    return (
      <Loading label={`Wczytywanie ${label}`} className="gap-2">
        {Array.from({ length: rows }, (_, index) => (
          <SkeletonBlock key={index} className="h-12 w-full" />
        ))}
      </Loading>
    )
  }
  if (state.status === 'error') {
    return <ErrorBoard title={`Nie udało się wczytać ${label}`} message={state.message} onRetry={state.onRetry} className="px-5 py-6 sm:px-6 sm:py-8" />
  }
  return <>{children(state.data)}</>
}

/** Zwycięzca finału zakończonego (także po karnych) z herbem; `null` przed nim. */
function cupChampion(matches: readonly PublicBracketMatch[]) {
  const final = bracketFinal(matches)
  return final ? teamOn(final, bracketWinnerSide(final)) : null
}

/** Mecz w bocznej kolumnie: godzina (z dniem, gdy kolejka trwa kilka dni) i para. */
function NextMatchLine<M extends OverviewMatch>({
  match,
  showDay,
  timeZone,
  href,
  onNavigate,
}: {
  match: M
  showDay: boolean
  timeZone?: string
  href?: string
  onNavigate?: () => void
}) {
  const label = match.bracket?.label ?? match.group
  return (
    <Anchor
      href={href}
      onNavigate={onNavigate}
      data-slot="next-match"
      aria-label={matchPairLabel(match)}
      className="grid min-h-12 grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3 border-b border-hairline py-2 transition-colors hover:bg-card/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-line"
    >
      <span className="flex flex-col leading-tight">
        {match.kickoffAt === null ? (
          <span className="text-xs text-muted-foreground">{formatKickoff(null)}</span>
        ) : (
          <>
            <span className="pub-num text-lg">{formatKickoff(match.kickoffAt, { showDate: false, timeZone })}</span>
            {showDay && <span className="text-xs text-muted-foreground">{formatShortDay(match.kickoffAt, timeZone)}</span>}
          </>
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-medium wrap-break-word">{matchPairLabel(match)}</span>
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
      </span>
    </Anchor>
  )
}

/** Następna kolejka (liga, grupy) albo najbliższe mecze (puchar, playoff). */
function NextMatches<M extends OverviewMatch>({
  round,
  knockout,
  timeZone,
  matchHref,
  onMatchNavigate,
  tab,
}: {
  round: RoundWithMatches<M>
  knockout: boolean
  timeZone?: string
  matchHref?: (match: { id: number }) => string
  onMatchNavigate?: (match: { id: number }) => void
  tab: TabLink
}) {
  const id = React.useId()
  const showDay = matchDays(round.matches.map((match) => match.kickoffAt), timeZone).length > 1
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <SectionHead
        id={id}
        title={knockout ? 'Najbliższe mecze' : round.summary.name}
        link={{ label: 'Terminarz', ...tab('fixtures') }}
        sub={knockout ? `${round.summary.name}, ${round.summary.dates}` : round.summary.dates}
      />
      <div>
        {round.matches.map((match) => (
          <NextMatchLine
            key={match.id}
            match={match}
            showDay={showDay}
            timeZone={timeZone}
            href={matchHref?.(match)}
            onNavigate={onMatchNavigate && (() => onMatchNavigate(match))}
          />
        ))}
      </div>
    </section>
  )
}

/** Lider domyślnej statystyki z odnośnikiem do Statystyk. */
function Leader({ state, tab }: { state: Loadable<Leaderboard>; tab: TabLink }) {
  const id = React.useId()
  const title = state.status === 'ready' ? state.data.label : 'Klasyfikacja'
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <SectionHead id={id} title={title} link={{ label: 'Statystyki', ...tab('stats') }} />
      <Section state={state} label="klasyfikacji" rows={2}>
        {(leaderboard) =>
          leaderboard.rows.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">{LEADERBOARD_EMPTY}.</p>
          ) : (
            <StatLeaders leaderboard={leaderboard} compact />
          )
        }
      </Section>
    </section>
  )
}

/**
 * Przegląd z terminarzem. Pas etapu na pełną szerokość, pod nim dwie
 * kolumny od `lg` (niżej jedna pod drugą): w głównej tabela ligi z formą
 * (przed startem z terminem pierwszego meczu), tabele grup w dwóch kolumnach
 * albo drabinka, a po końcu nad nimi pas „Mistrz”; w bocznej następna
 * kolejka albo najbliższe mecze i lider klasyfikacji.
 */
export function OverviewScreen<M extends OverviewMatch, B extends PublicBracketMatch>({
  mode,
  finished,
  schedule,
  table,
  groups,
  bracket,
  leaderboard,
  timeZone,
  matchHref,
  onMatchNavigate,
  navHref,
  onNavigate,
}: OverviewScreenProps<M, B>) {
  const mainId = React.useId()
  const knockout = mode === 'knockout' || mode === 'playoff'
  const tab: TabLink = (key) => ({ href: navHref?.(key), onNavigate: onNavigate && (() => onNavigate(key)) })
  const startsAt = schedule.status === 'ready' && mode === 'league' ? schedule.data.startsAt : null
  const next = schedule.status === 'ready' && !finished ? schedule.data.next : null

  const main = {
    league: { title: 'Tabela', link: 'Pełna tabela', key: 'standings' as const },
    groups: { title: 'Tabele grup', link: 'Pełne tabele', key: 'standings' as const },
    knockout: { title: 'Drabinka', link: 'Cała drabinka', key: 'bracket' as const },
    playoff: { title: 'Drabinka', link: 'Cała drabinka', key: 'bracket' as const },
  }[mode]

  return (
    <div data-slot="overview" className="flex flex-col gap-14">
      {schedule.status === 'ready' ? (
        <StageBand
          round={schedule.data.stage.round}
          position={schedule.data.stage.position}
          unit={knockout ? 'knockout' : 'round'}
          roundsTotal={mode === 'league' ? schedule.data.roundsTotal : undefined}
          timeZone={timeZone}
          matchHref={matchHref}
          onMatchNavigate={onMatchNavigate}
        />
      ) : (
        <Section state={schedule} label="meczów">
          {() => null}
        </Section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <section aria-labelledby={mainId} className="flex min-w-0 flex-col gap-4">
          <SectionHead
            id={mainId}
            title={main.title}
            link={{ label: main.link, ...tab(main.key) }}
            sub={startsAt ? `Startuje ${formatKickoff(startsAt, { timeZone })}` : undefined}
          />
          {mode === 'league' && table && (
            <Section state={table} label="tabeli" rows={8}>
              {(data) => {
                const champion = finished ? data.rows.find((row) => row.position === 1) : undefined
                return (
                  <div className="flex flex-col gap-6">
                    {champion && <ChampionBand row={champion} scoreLabel={data.scoreLabel} />}
                    <StandingsTable rows={data.rows} scoreLabel={data.scoreLabel} allowsDraw={data.allowsDraw} label="Tabela" />
                  </div>
                )
              }}
            </Section>
          )}
          {mode === 'groups' && groups && (
            <Section state={groups} label="tabel grup" rows={8}>
              {(data) => (
                <div className="grid gap-12 lg:grid-cols-2 lg:gap-14">
                  {data.map((group, index) => (
                    <GroupTable key={group.groupId ?? `bez-id-${index}`} table={group} index={index} />
                  ))}
                </div>
              )}
            </Section>
          )}
          {knockout && bracket && (
            <Section state={bracket} label="drabinki" rows={6}>
              {(matches) => {
                const champion = finished ? cupChampion(matches) : null
                return (
                  <div className="flex flex-col gap-6">
                    {champion && <ChampionBand team={champion} />}
                    <BracketTree<B> matches={matches} timeZone={timeZone} matchHref={matchHref} onMatchNavigate={onMatchNavigate} />
                  </div>
                )
              }}
            </Section>
          )}
          {mode === 'playoff' && (
            <TextLink {...tab('standings')} className="self-start">
              Tabele grup
            </TextLink>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-12">
          {next && (
            <NextMatches round={next} knockout={knockout} timeZone={timeZone} matchHref={matchHref} onMatchNavigate={onMatchNavigate} tab={tab} />
          )}
          <Leader state={leaderboard} tab={tab} />
        </aside>
      </div>
    </div>
  )
}

/**
 * Wczytywanie Przeglądu: szkielet w kształcie ekranu (#288) — nagłówek
 * pasa, rząd czterech tablic, a pod nimi tabela i boczna kolumna — zamiast
 * ogólnego prostokąta.
 */
export function OverviewLoading() {
  return (
    <Loading label="Wczytywanie przeglądu" className="gap-14">
      <div className="flex flex-col gap-5">
        <SkeletonHead />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBlock key={index} className="h-36 w-full" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
        <div className="flex flex-col gap-2">
          <SkeletonBlock className="mb-2 h-8 w-48 max-w-full" />
          {Array.from({ length: 8 }, (_, index) => (
            <SkeletonBlock key={index} className="h-14 w-full" />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <SkeletonBlock className="mb-2 h-8 w-40 max-w-full" />
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonBlock key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </Loading>
  )
}
