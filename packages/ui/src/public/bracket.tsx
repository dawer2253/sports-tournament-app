/**
 * Drabinka strony publicznej (#293, projekt A „Drzewo” z #288): kafel meczu,
 * wolny los, mistrz, przełącznik rund i drzewo w oknie rund. Reguły odczytu
 * drabinki (rundy, etykiety pozycji, źródła pustych slotów, wolne losy)
 * zostają w `lib/bracket.ts`, wspólne z panelem.
 */
import * as React from 'react'
import {
  bracketFinal,
  bracketSlotSource,
  bracketTree,
  bracketWinnerSide,
  currentRoundOrder,
  matchLabel,
  teamOn,
  type BracketMatch,
  type BracketSide,
  type BracketTeam,
  type BracketTreeRound,
  type BracketTreeSlot,
} from '../lib/bracket'
import { formatKickoffParts } from '../lib/kickoff'
import type { MatchClockState } from '../lib/match-clock'
import { cn } from '../lib/utils'
import { Anchor } from './anchor'
import { Crest } from './crest'
import { LiveTag } from './live'

/** Drużyna w slocie meczu drabinki z herbem (`TeamSummary` z kontraktu). */
export type PublicBracketTeam = BracketTeam & { logoUrl: string | null }

/**
 * Mecz drabinki strony publicznej: `BracketMatch` z herbami drużyn. `Match`
 * z kontraktu pasuje do niego wprost (strażnik w `apps/public`), a
 * `BracketMatch` panelu zostaje bez zmian.
 */
export type PublicBracketMatch = Omit<BracketMatch, 'homeTeam' | 'awayTeam'> & Partial<MatchClockState> & {
  homeTeam: PublicBracketTeam | null
  awayTeam: PublicBracketTeam | null
}

/** Wysokość kafla (px); pozycje w drzewie liczą się od niej. */
export const BRACKET_TILE = 92
/** Odstęp między kaflami w pierwszej kolumnie okna. */
const GAP = 14
const UNIT = BRACKET_TILE + GAP
/** Odstęp między kolumnami; łącznik zajmuje go w całości. */
const CONNECTOR = 28
/** Odstęp mistrza nad finałem i meczu o 3. miejsce pod nim. */
const FINAL_GAP = 16
/** Przesunięcie palcem, od którego gest zmienia rundę. */
const SWIPE_MIN = 50

const SIDES = ['home', 'away'] as const

/** Podpis pustego slotu, do którego nie prowadzi żadna krawędź (niespójne dane). */
const UNKNOWN_SLOT = 'Do ustalenia'

// --- Kafel ------------------------------------------------------------------

export interface BracketTileProps {
  match: PublicBracketMatch
  /** Komplet meczów fazy: z niego etykieta pozycji i źródła pustych slotów. */
  matches: readonly PublicBracketMatch[]
  /** Adres strony meczu; bez niego kafel jest tylko do odczytu. */
  href?: string
  /** Przejęcie kliknięcia, np. przez router. Klik z klawiszem modyfikującym zostaje przeglądarce. */
  onNavigate?: () => void
  /** Strefa terminu; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  className?: string
  style?: React.CSSProperties
}

/** Skąd przyjdzie drużyna do pustego slotu: „Zwycięzca: Półfinał 1”. */
function slotText(match: PublicBracketMatch, side: BracketSide, matches: readonly PublicBracketMatch[]): string {
  return teamOn(match, side)?.name ?? bracketSlotSource(match, side, matches) ?? UNKNOWN_SLOT
}

/**
 * Kafel meczu drabinki: nad parą pozycja („Półfinał 1”, „Mecz o 3. miejsce”)
 * i termin albo „Na żywo”, pod nią dwie linie herb, nazwa, karne w nawiasie
 * przy nazwie i wynik w okienku tej samej szerokości w każdym kaflu (mieści
 * trzycyfrowy wynik kosza). Przegrany jest przygaszony, także po remisie
 * rozstrzygniętym karnymi; w meczu trwającym nikt, bo awansuje się dopiero
 * przy `finished` (#216). Pusty slot pokazuje kursywą, skąd przyjdzie
 * drużyna, i to samo niesie nazwa odnośnika.
 */
export function BracketTile({ match, matches, href, onNavigate, timeZone, className, style }: BracketTileProps) {
  const label = matchLabel(match, matches)
  const winner = bracketWinnerSide(match)
  const live = match.status === 'live'
  const kickoff = match.status === 'scheduled' ? formatKickoffParts(match.kickoffAt, timeZone) : null
  const name = `${label}: ${slotText(match, 'home', matches)} – ${slotText(match, 'away', matches)}`

  const content = (
    <>
      <span className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        {live ? (
          <LiveTag clock={match} compact className="shrink-0 text-xs" />
        ) : kickoff ? (
          <span className="shrink-0 pub-num">
            {kickoff.day} {kickoff.time}
          </span>
        ) : null}
      </span>
      {SIDES.map((side) => {
        const team = teamOn(match, side)
        const dim = winner !== null && winner !== side
        const score = side === 'home' ? match.homeScore : match.awayScore
        const penalties = side === 'home' ? match.homePenalties : match.awayPenalties
        return (
          <span
            key={side}
            data-slot="bracket-tile-team"
            data-dim={dim || undefined}
            className={cn('grid h-7 grid-cols-[1.25rem_minmax(0,1fr)_2.25rem] items-center gap-2', dim ? 'text-muted-foreground' : 'font-semibold')}
          >
            {team ? <Crest name={team.name} logoUrl={team.logoUrl} className="size-5" /> : <span />}
            <span className="flex min-w-0 items-center gap-1.5">
              <span data-slot="bracket-tile-name" className={cn('truncate leading-7', team ? 'text-[0.9375rem]' : 'text-[0.8125rem] font-normal text-muted-foreground italic')}>
                {slotText(match, side, matches)}
              </span>
              {penalties !== null && (
                <>
                  <span data-slot="bracket-tile-penalties" className="shrink-0 text-sm font-normal text-muted-foreground">
                    ({penalties})
                  </span>
                  <span className="sr-only"> w karnych</span>
                </>
              )}
            </span>
            <span data-slot="bracket-tile-score" className="grid h-7 place-items-center rounded-sm bg-sunken pub-num text-lg">
              {match.status === 'scheduled' ? '' : score ?? '–'}
            </span>
          </span>
        )
      })}
    </>
  )

  const tile = cn(
    'flex min-w-0 flex-col justify-center gap-1 rounded-md bg-card px-3 ring-1 ring-inset',
    live ? 'ring-destructive/70' : 'ring-border',
    className,
  )
  const tileStyle = { height: BRACKET_TILE, ...style }

  if (href === undefined) {
    return (
      <div data-slot="bracket-tile" data-match-id={match.id} data-round={match.round.order} role="group" aria-label={name} className={tile} style={tileStyle}>
        {content}
      </div>
    )
  }
  return (
    <Anchor
      href={href}
      onNavigate={onNavigate}
      data-slot="bracket-tile"
      data-match-id={match.id}
      data-round={match.round.order}
      aria-label={name}
      className={cn(tile, 'transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line')}
      style={tileStyle}
    >
      {content}
    </Anchor>
  )
}

/**
 * Wolny los (#215): kafel z przerywanym obrysem w miejscu meczu 1. rundy,
 * którego nie ma; drużyna stoi od razu w 2. rundzie.
 */
export function ByeTile({ team, className, style }: { team: PublicBracketTeam; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      data-slot="bracket-bye"
      role="group"
      aria-label={`Wolny los: ${team.name}`}
      className={cn('flex min-w-0 flex-col justify-center gap-1.5 rounded-md border border-dashed border-border px-3', className)}
      style={{ height: BRACKET_TILE, ...style }}
    >
      <span className="text-xs text-muted-foreground">Wolny los</span>
      <span className="flex min-w-0 items-center gap-2 font-medium">
        <Crest name={team.name} logoUrl={team.logoUrl} className="size-5" />
        <span className="truncate leading-7">{team.name}</span>
      </span>
    </div>
  )
}

/**
 * Mistrz nad finałem: wypełnienie kolorem turnieju z obrysem 1 px
 * w `--brand-line` (`pub-brand-fill`), herb zastępczy w `--brand-foreground`.
 * Nazwa łamie się na dwie linie, zanim dostanie wielokropek.
 */
export function ChampionTile({ team, className, style }: { team: PublicBracketTeam; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      role="status"
      aria-label="Mistrz"
      data-slot="bracket-champion"
      className={cn('flex min-w-0 items-center gap-3 rounded-md px-4 py-3 pub-brand-fill', className)}
      style={style}
    >
      <Crest name={team.name} logoUrl={team.logoUrl} onFill className="size-9" />
      <span className="flex min-w-0 flex-col">
        <span className="text-xs opacity-85">Mistrz</span>
        <span data-slot="bracket-champion-name" className="line-clamp-2 pub-title text-[1.375rem] leading-[1.2] wrap-break-word">
          {team.name}
        </span>
      </span>
    </div>
  )
}

/** Mistrz z herbem: zwycięzca finału `finished`, także po karnych. */
function champion<M extends PublicBracketMatch>(matches: readonly M[]): PublicBracketTeam | null {
  const final = bracketFinal(matches)
  return final ? teamOn(final, bracketWinnerSide(final)) : null
}

// --- Drzewo -----------------------------------------------------------------

/** Kolumny okna z szerokości kontenera: 1 na telefonie, 3 poniżej 860 px, dalej 4 (#288). */
function bracketColumns(width: number): number {
  if (width < 600) return 1
  if (width < 860) return 3
  return 4
}

/** Szerokość kontenera z `ResizeObserver`; bez niego (jsdom) zero, czyli jedna kolumna. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null)
  const [width, setWidth] = React.useState(0)
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    setWidth(element.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

export interface BracketTreeProps<M extends PublicBracketMatch> {
  /** Komplet meczów fazy `knockout` (ADR-0004). */
  matches: readonly M[]
  /**
   * `order` pierwszej rundy okna. Bez niego okno zaczyna się od rundy
   * z pierwszym niezakończonym meczem (`currentRoundOrder`) i zawsze dociąga
   * się tak, żeby nie wyjść za finał.
   */
  start?: number
  /** Przesunięcie okna strzałką, pigułką albo gestem; bez niego okno trzyma stan samo. */
  onStartChange?: (order: number) => void
  /** Strefa terminów; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Adres strony meczu; bez niego kafle są tylko do odczytu. */
  matchHref?: (match: M) => string
  /** Przejęcie kliknięcia w kafel, np. przez router. */
  onMatchNavigate?: (match: M) => void
  className?: string
}

type Round<M extends PublicBracketMatch> = BracketTreeRound<M>

/** Środek ekranu względem elementu (px w pionie). */
function middle(element: Element): number {
  const rect = element.getBoundingClientRect()
  return rect.top + rect.height / 2
}

/**
 * Drzewo drabinki w oknie rund (#293, projekt A „Drzewo” z #288). Strona
 * przewija się tylko w dół: kolumny dzielą szerokość kontenera po równo
 * (`bracketColumns`), a dalsze rundy pokazuje okno przesuwane pigułkami,
 * strzałkami i gestem w bok. Na telefonie jedna runda listą.
 *
 * - Mecz stoi w połowie między parą, z której przychodzą drużyny; łączniki
 *   idą pod kątem prostym. Wolny los stoi w miejscu brakującego meczu 1. rundy.
 * - Mistrz stoi nad finałem, mecz o 3. miejsce pod nim.
 * - Pasek rund (pigułki, strzałki i nagłówki kolumn) jest przyklejony do
 *   górnej krawędzi. Pigułki to przyciski w grupie „Rundy” z `aria-current`
 *   dla rund w oknie, nie zakładki, bo okno obejmuje kilka rund naraz.
 * - Gest w bok przesuwa okno o rundę (`touch-action: pan-y`), pion zostaje
 *   przeglądarce. Po przesunięciu na środku ekranu staje następca (albo
 *   poprzednik) kafla, który był tam wcześniej.
 */
export function BracketTree<M extends PublicBracketMatch>({
  matches,
  start,
  onStartChange,
  timeZone,
  matchHref,
  onMatchNavigate,
  className,
}: BracketTreeProps<M>) {
  const [containerRef, width] = useWidth<HTMLDivElement>()
  const treeRef = React.useRef<HTMLDivElement>(null)
  const [ownStart, setOwnStart] = React.useState<number | undefined>(undefined)

  const rounds = React.useMemo(() => bracketTree(matches), [matches])
  const winner = React.useMemo(() => champion(matches), [matches])
  const cols = Math.max(1, Math.min(bracketColumns(width), rounds.length))
  const maxIndex = Math.max(0, rounds.length - cols)
  const requested = start ?? ownStart ?? currentRoundOrder(matches) ?? 1
  const requestedIndex = rounds.findIndex((round) => round.order === requested)
  const startIndex = Math.max(0, Math.min(requestedIndex < 0 ? (requested > 1 ? maxIndex : 0) : requestedIndex, maxIndex))
  const visible = rounds.slice(startIndex, startIndex + cols)

  // Kotwica przewijania: mecz, który po przesunięciu ma stanąć na środku
  // ekranu (następca albo poprzednik kafla, który tam stał), a bez niego
  // ułamek wysokości drzewa na środku ekranu.
  const anchor = React.useRef<{ matchId: number | null; ratio: number } | null>(null)

  function shift(index: number) {
    const clamped = Math.max(0, Math.min(index, maxIndex))
    if (clamped === startIndex) return
    const tree = treeRef.current
    const rect = tree?.getBoundingClientRect()
    if (tree && rect && rect.height > 0) {
      const first = visible[0]!.order
      const tiles = [...tree.querySelectorAll<HTMLElement>(`[data-slot="bracket-tile"][data-round="${first}"]`)]
      const nearest = tiles.toSorted((a, b) => Math.abs(middle(a) - innerHeight / 2) - Math.abs(middle(b) - innerHeight / 2))[0]
      let matchId = nearest ? Number(nearest.dataset.matchId) : null
      // Krawędzie zwycięzcy przez tyle rund, o ile przesuwa się okno.
      for (let step = clamped - startIndex; matchId !== null && step !== 0; step += step > 0 ? -1 : 1) {
        const id: number = matchId
        matchId = step > 0 ? (matches.find((match) => match.id === id)?.winnerToMatchId ?? null) : (matches.find((match) => match.winnerToMatchId === id)?.id ?? null)
      }
      anchor.current = { matchId, ratio: Math.max(0, Math.min(1, (innerHeight / 2 - rect.top) / rect.height)) }
    }
    const order = rounds[clamped]!.order
    if (onStartChange) onStartChange(order)
    else setOwnStart(order)
  }

  React.useLayoutEffect(() => {
    const saved = anchor.current
    anchor.current = null
    const tree = treeRef.current
    if (!saved || !tree) return
    const target = saved.matchId === null ? null : tree.querySelector(`[data-slot="bracket-tile"][data-match-id="${saved.matchId}"]`)
    if (target) {
      window.scrollBy({ top: middle(target) - innerHeight / 2 })
      return
    }
    const rect = tree.getBoundingClientRect()
    if (rect.height > 0) window.scrollBy({ top: rect.top + saved.ratio * rect.height - innerHeight / 2 })
  }, [startIndex])

  const touch = React.useRef<{ x: number; y: number } | null>(null)

  if (rounds.length === 0) return null

  const grid: React.CSSProperties = { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, columnGap: CONNECTOR }
  const finalOrder = rounds.at(-1)!.order
  const tile = (match: M, style?: React.CSSProperties, extra?: string) => (
    <BracketTile
      match={match}
      matches={matches}
      href={matchHref?.(match)}
      onNavigate={onMatchNavigate && (() => onMatchNavigate(match))}
      timeZone={timeZone}
      className={extra}
      style={style}
    />
  )

  return (
    <div ref={containerRef} data-slot="bracket-tree" className={cn('flex min-w-0 flex-col', className)}>
      <div data-slot="bracket-rounds-bar" className="sticky top-0 z-10 flex flex-col gap-4 bg-background/95 pt-2 pb-3 backdrop-blur">
        {rounds.length > cols && (
          <RoundSwitcher rounds={rounds} startIndex={startIndex} cols={cols} onShift={shift} />
        )}
        <div className="grid" style={grid}>
          {visible.map((round) => (
            <RoundHead key={round.id} round={round} />
          ))}
        </div>
      </div>

      <div
        ref={treeRef}
        data-slot="bracket-tree-body"
        className="mt-3"
        style={{ touchAction: 'pan-y' }}
        onTouchStart={(event) => {
          const point = event.touches[0]
          touch.current = point ? { x: point.clientX, y: point.clientY } : null
        }}
        onTouchEnd={(event) => {
          const from = touch.current
          const point = event.changedTouches[0]
          touch.current = null
          if (!from || !point) return
          const dx = point.clientX - from.x
          const dy = point.clientY - from.y
          if (Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > 1.5 * Math.abs(dy)) shift(startIndex + (dx < 0 ? 1 : -1))
        }}
      >
        {cols === 1 ? (
          <SingleRound round={visible[0]!} final={visible[0]!.order === finalOrder} champion={winner} tile={tile} />
        ) : (
          <Columns rounds={visible} finalOrder={finalOrder} champion={winner} grid={grid} tile={tile} />
        )}
      </div>
    </div>
  )
}

/**
 * Przełącznik rund na całą szerokość: strzałki po bokach, pigułki dzielą
 * resztę po równo. Pigułka rundy z meczem trwającym ma kropkę i tekst dla
 * czytnika „, trwa mecz”.
 */
function RoundSwitcher<M extends PublicBracketMatch>({
  rounds,
  startIndex,
  cols,
  onShift,
}: {
  rounds: Round<M>[]
  startIndex: number
  cols: number
  onShift: (index: number) => void
}) {
  const arrow =
    'grid size-11 shrink-0 place-items-center rounded-md pub-tab text-xl ring-1 ring-border ring-inset hover:bg-muted disabled:opacity-40 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line'
  return (
    <div data-slot="bracket-switcher" className="flex items-center gap-2">
      <button type="button" aria-label="Wcześniejsza runda" disabled={startIndex === 0} onClick={() => onShift(startIndex - 1)} className={arrow}>
        <span aria-hidden>‹</span>
      </button>
      <div role="group" aria-label="Rundy" className="grid min-w-0 flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr))` }}>
        {rounds.map((round, index) => {
          const inWindow = index >= startIndex && index < startIndex + cols
          return (
            <button
              key={round.id}
              type="button"
              data-slot="bracket-pill"
              aria-current={inWindow ? 'true' : undefined}
              onClick={() => onShift(index)}
              className={cn(
                'relative min-h-11 min-w-0 rounded-md px-1 pub-tab text-base transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line',
                inWindow ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span aria-hidden className="block truncate">
                {round.shortName}
              </span>
              <span className="sr-only">
                {round.name}
                {round.live && ', trwa mecz'}
              </span>
              {round.live && (
                <span aria-hidden data-slot="bracket-live-dot" className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-destructive motion-safe:animate-pulse" />
              )}
            </button>
          )
        })}
      </div>
      <button type="button" aria-label="Następna runda" disabled={startIndex + cols >= rounds.length} onClick={() => onShift(startIndex + 1)} className={arrow}>
        <span aria-hidden>›</span>
      </button>
    </div>
  )
}

/** Nagłówek kolumny: nazwa rundy i postęp („2 z 4 rozegrane”) albo „Na żywo”. */
function RoundHead<M extends PublicBracketMatch>({ round }: { round: Round<M> }) {
  return (
    <div data-slot="bracket-round-head" className="flex min-w-0 flex-col gap-0.5 border-b-2 border-rule pb-2">
      <span data-slot="bracket-round-name" className="truncate pub-tab text-lg">
        {round.name}
      </span>
      <span className="text-xs text-muted-foreground">
        {round.live ? <LiveTag className="text-xs" /> : `${round.finished} z ${round.total} rozegrane`}
      </span>
    </div>
  )
}

type TileRender<M extends PublicBracketMatch> = (match: M, style?: React.CSSProperties, className?: string) => React.ReactNode

function slotTeam<M extends PublicBracketMatch>(slot: BracketTreeSlot<M>): PublicBracketTeam | null {
  // Herb wolnego losu bierze się z meczu 2. rundy, w którym drużyna stoi.
  return slot.kind === 'bye' ? teamOn(slot.bye.target, slot.bye.side) : null
}

/**
 * Jedna runda na telefonie: bez łączników drzewo nic nie mówi, więc kafle
 * stoją listą; w rundzie finału mistrz nad finałem i 3. miejsce pod nim.
 */
function SingleRound<M extends PublicBracketMatch>({
  round,
  final,
  champion,
  tile,
}: {
  round: Round<M>
  final: boolean
  champion: PublicBracketTeam | null
  tile: TileRender<M>
}) {
  return (
    <div className="flex flex-col gap-3">
      {final && champion && <ChampionTile team={champion} className="mb-2" />}
      {round.slots.map((slot, index) => {
        if (slot.kind === 'match') return <React.Fragment key={`m${slot.match.id}`}>{tile(slot.match)}</React.Fragment>
        const team = slotTeam(slot)
        return team ? <ByeTile key={`b${index}`} team={team} /> : null
      })}
      {round.third && tile(round.third, undefined, 'mt-3')}
    </div>
  )
}

/** Wysokość drzewa: od pierwszej kolumny okna, z miejscem na mistrza i 3. miejsce przy finale. */
function treeHeight(firstSlots: number) {
  return Math.max(firstSlots * UNIT, 3 * UNIT + 80)
}

/**
 * Kolumny drzewa: każda ma `slots` miejsc na równej wysokości, kafel na
 * środku miejsca. Łącznik idzie od środków dwóch kafli poprzedniej kolumny
 * (¼ i ¾ miejsca) do środka kafla.
 */
function Columns<M extends PublicBracketMatch>({
  rounds,
  finalOrder,
  champion,
  grid,
  tile,
}: {
  rounds: Round<M>[]
  finalOrder: number
  champion: PublicBracketTeam | null
  grid: React.CSSProperties
  tile: TileRender<M>
}) {
  const height = treeHeight(rounds[0]!.slots.length)
  return (
    <div className="grid" style={grid}>
      {rounds.map((round, column) => {
        const slotHeight = height / round.slots.length
        return (
          <div key={round.id} data-slot="bracket-column" className="relative min-w-0" style={{ height }}>
            {round.slots.map((slot, index) => {
              if (slot.kind === 'empty') return null
              const top = index * slotHeight + slotHeight / 2 - BRACKET_TILE / 2
              const team = slotTeam(slot)
              return (
                <React.Fragment key={index}>
                  {slot.kind === 'match'
                    ? tile(slot.match, { top }, 'absolute inset-x-0')
                    : team && <ByeTile team={team} className="absolute inset-x-0" style={{ top }} />}
                  {column > 0 && (
                    <>
                      <span
                        aria-hidden
                        data-slot="bracket-connector"
                        className="absolute border-y border-r border-muted-foreground/35"
                        style={{ left: -CONNECTOR, width: CONNECTOR / 2, top: index * slotHeight + slotHeight / 4, height: slotHeight / 2 }}
                      />
                      <span
                        aria-hidden
                        className="absolute border-t border-muted-foreground/35"
                        style={{ left: -CONNECTOR / 2, width: CONNECTOR / 2, top: index * slotHeight + slotHeight / 2 }}
                      />
                    </>
                  )}
                </React.Fragment>
              )
            })}
            {round.order === finalOrder && (
              <>
                {champion && (
                  <ChampionTile team={champion} className="absolute inset-x-0" style={{ bottom: height / 2 + BRACKET_TILE / 2 + FINAL_GAP }} />
                )}
                {round.third && tile(round.third, { top: height / 2 + BRACKET_TILE / 2 + FINAL_GAP }, 'absolute inset-x-0')}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
