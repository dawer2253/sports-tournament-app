import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'
import {
  bracketChampion,
  bracketTree,
  currentRoundOrder,
  matchLabel,
  type BracketMatch,
  type BracketTreeRound,
} from '../../lib/bracket'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { BRACKET_TILE_HEIGHT, BracketByeTile, BracketChampionTile, BracketMatchTile } from './bracket-match-tile'

/** Odstęp między kaflami w pierwszej kolumnie okna. */
const GAP = 10
/** Krok miejsca w pierwszej kolumnie okna: kafel z odstępem. */
const UNIT = BRACKET_TILE_HEIGHT + GAP
/** Odstęp między kolumnami; łącznik zajmuje go w całości, wąs za oknem — połowę. */
const CONNECTOR = 22
/** Odstęp między finałem, mistrzem i meczem o 3. miejsce pod nim. */
const UNDER_FINAL_GAP = 14
/** Podpis „Mecz o 3. miejsce” nad jego kaflem. */
const THIRD_LABEL_HEIGHT = 18
/** Przesunięcie palcem, od którego gest zmienia rundę. */
const SWIPE_MIN = 50

/** Kolumny okna z szerokości kontenera (#218, ustalenie 1). */
function bracketColumns(width: number): number {
  if (width < 600) return 2
  if (width < 860) return 3
  return 4
}

/**
 * Środek miejsca `p` w kolumnie `j` okna: mecz stoi w połowie między parą,
 * z której przychodzą drużyny, więc kolejna kolumna ma dwa razy rzadszy krok.
 */
function center(j: number, p: number): number {
  return p * 2 ** j * UNIT + ((2 ** j - 1) * UNIT) / 2 + BRACKET_TILE_HEIGHT / 2
}

/** Szerokość kontenera z `ResizeObserver`; bez niego (jsdom) zero, czyli dwie kolumny. */
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

export interface BracketTreeProps<M extends BracketMatch> {
  /** Komplet meczów fazy `knockout` (ADR-0004). */
  matches: readonly M[]
  /**
   * `order` pierwszej rundy okna. Bez niego okno zaczyna się od rundy
   * z pierwszym niezakończonym meczem (`currentRoundOrder`). Okno zawsze
   * dociąga się tak, żeby nie wyjść za finał.
   */
  start?: number
  /** Przesunięcie okna strzałką, pigułką albo gestem; bez niego okno trzyma stan samo. */
  onStartChange?: (order: number) => void
  /** Sport z remisem: pole wyniku kafla ma miejsce na karne. */
  penaltySlot: boolean
  /** Strefa terminów; bez niej strefa przeglądarki (ADR-0008). */
  timeZone?: string
  /** Adres strony meczu (#210); bez niego kafle są tylko do odczytu. */
  matchHref?: (match: M) => string
  /** Przejęcie kliknięcia w kafel, np. przez router. */
  onMatchNavigate?: (match: M) => void
  className?: string
}

/**
 * Drzewo drabinki strony publicznej (#218, wariant B, ustalenie 1). Strona
 * przewija się tylko w dół: kolumny dzielą szerokość kontenera po równo
 * (2 poniżej 600 px, 3 poniżej 860 px, dalej 4), a dalsze rundy pokazuje
 * okno przesuwane pigułkami, strzałkami i gestem w bok.
 *
 * - Mecz stoi w połowie między parą, z której przychodzą drużyny, a pozycja
 *   wynika z `matchNumber`. Łączniki idą pod kątem prostym, a za ostatnią
 *   kolumną okna stoją wąsy, gdy dalej jest runda.
 * - Pasek rund jest przyklejony nad drzewem: pigułki wszystkich rund (w oknie
 *   na kolorze turnieju, `aria-current`), strzałki i nagłówki kolumn.
 *   Pigułki to przyciski, nie zakładki, bo okno obejmuje kilka rund naraz.
 * - Gest w bok przesuwa okno o rundę (`touch-action: pan-y`), pion zostaje
 *   przeglądarce. Po przesunięciu ten sam fragment drabinki zostaje na
 *   środku ekranu, choć kolumna jest krótsza albo dłuższa.
 * - Pod finałem stoją mistrz i mecz o 3. miejsce, a wolny los to przerywany
 *   kafel w miejscu brakującego meczu 1. rundy.
 */
export function BracketTree<M extends BracketMatch>({
  matches,
  start,
  onStartChange,
  penaltySlot,
  timeZone,
  matchHref,
  onMatchNavigate,
  className,
}: BracketTreeProps<M>) {
  const [containerRef, width] = useWidth<HTMLDivElement>()
  const treeRef = React.useRef<HTMLDivElement>(null)
  const [ownStart, setOwnStart] = React.useState<number | undefined>(undefined)

  const rounds = React.useMemo(() => bracketTree(matches), [matches])
  const champion = React.useMemo(() => bracketChampion(matches), [matches])
  const cols = Math.min(bracketColumns(width), rounds.length)
  const maxIndex = rounds.length - cols
  const requested = start ?? ownStart ?? currentRoundOrder(matches) ?? 1
  const requestedIndex = rounds.findIndex((round) => round.order === requested)
  const startIndex = Math.max(0, Math.min(requestedIndex < 0 ? (requested > 1 ? maxIndex : 0) : requestedIndex, maxIndex))
  const visible = rounds.slice(startIndex, startIndex + cols)
  const hasNext = startIndex + cols < rounds.length

  // Kotwica przewijania: ułamek wysokości drzewa na środku ekranu przed
  // przesunięciem. Po nim ten sam ułamek wraca na środek, więc następca
  // kafla, który tam stał, zostaje pod oczami.
  const anchor = React.useRef<number | null>(null)

  function shift(index: number) {
    const clamped = Math.max(0, Math.min(index, maxIndex))
    if (clamped === startIndex) return
    const rect = treeRef.current?.getBoundingClientRect()
    if (rect && rect.height > 0) anchor.current = Math.max(0, Math.min(1, (window.innerHeight / 2 - rect.top) / rect.height))
    const order = rounds[clamped]!.order
    if (onStartChange) onStartChange(order)
    else setOwnStart(order)
  }

  React.useLayoutEffect(() => {
    const ratio = anchor.current
    anchor.current = null
    const rect = treeRef.current?.getBoundingClientRect()
    if (ratio === null || !rect || rect.height === 0) return
    window.scrollBy({ top: rect.top + ratio * rect.height - window.innerHeight / 2 })
  }, [startIndex])

  const touch = React.useRef<{ x: number; y: number } | null>(null)

  if (rounds.length === 0) return null

  const columns: React.CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    columnGap: CONNECTOR,
    paddingRight: hasNext ? CONNECTOR / 2 : 0,
  }

  return (
    <div ref={containerRef} data-slot="bracket-tree" className={cn('min-w-0', className)}>
      <div data-slot="bracket-rounds-bar" className="sticky top-0 z-10 border-b bg-background/95 pt-2 pb-2 backdrop-blur">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Wcześniejsza runda" disabled={startIndex === 0} onClick={() => shift(startIndex - 1)}>
            <ChevronLeft />
          </Button>
          <div
            role="group"
            aria-label="Rundy"
            className="grid min-w-0 flex-1 gap-1"
            style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr))` }}
          >
            {rounds.map((round, index) => {
              const inWindow = index >= startIndex && index < startIndex + cols
              return (
                <button
                  key={round.id}
                  type="button"
                  aria-current={inWindow ? 'true' : undefined}
                  onClick={() => shift(index)}
                  className={cn(
                    'relative h-8 min-w-0 rounded-md px-0.5 text-xs font-medium tabular-nums transition-colors',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    inWindow ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70',
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
                    <span
                      aria-hidden
                      data-slot="bracket-live-dot"
                      className="absolute top-1 right-1 size-1.5 animate-pulse rounded-full bg-destructive"
                    />
                  )}
                </button>
              )
            })}
          </div>
          <Button variant="ghost" size="icon" aria-label="Następna runda" disabled={!hasNext} onClick={() => shift(startIndex + 1)}>
            <ChevronRight />
          </Button>
        </div>
        {/* Nagłówki kolumn na tej samej siatce co drzewo, więc stoją nad swoimi kolumnami. */}
        <div className="mt-2 grid" style={columns}>
          {visible.map((round) => (
            <div key={round.id} data-slot="bracket-column-heading" className="min-w-0">
              <p className="truncate text-sm font-semibold">{round.name}</p>
              <p className="truncate text-[11px] text-muted-foreground tabular-nums">
                {round.finished}/{round.total} rozegranych
              </p>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={treeRef}
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
        <TreeColumns
          rounds={visible}
          hasNext={hasNext}
          columns={columns}
          champion={champion}
          matches={matches}
          penaltySlot={penaltySlot}
          timeZone={timeZone}
          matchHref={matchHref}
          onMatchNavigate={onMatchNavigate}
        />
      </div>
    </div>
  )
}

function TreeColumns<M extends BracketMatch>({
  rounds,
  hasNext,
  columns,
  champion,
  matches,
  penaltySlot,
  timeZone,
  matchHref,
  onMatchNavigate,
}: {
  rounds: BracketTreeRound<M>[]
  hasNext: boolean
  columns: React.CSSProperties
  champion: ReturnType<typeof bracketChampion>
} & Pick<BracketTreeProps<M>, 'matches' | 'penaltySlot' | 'timeZone' | 'matchHref' | 'onMatchNavigate'>) {
  const first = rounds[0]!.slots.length
  const last = rounds.length - 1
  // Pod finałem, od góry: mistrz i mecz o 3. miejsce z podpisem.
  // Za ostatnią kolumną okna nie ma rundy, więc to finał.
  const finalRound = hasNext ? null : rounds[last]!
  const championTop = center(last, 0) + BRACKET_TILE_HEIGHT / 2 + UNDER_FINAL_GAP
  const thirdTop = championTop + (champion ? BRACKET_TILE_HEIGHT + UNDER_FINAL_GAP : 0)
  const underFinal = !finalRound ? 0 : finalRound.third ? thirdTop + THIRD_LABEL_HEIGHT + BRACKET_TILE_HEIGHT : thirdTop
  const height = Math.max(first * UNIT - GAP, underFinal)

  const tile = (match: M, style?: React.CSSProperties) => (
    <BracketMatchTile
      match={match}
      label={matchLabel(match, matches)}
      penaltySlot={penaltySlot}
      timeZone={timeZone}
      href={matchHref?.(match)}
      onNavigate={onMatchNavigate && (() => onMatchNavigate(match))}
      className="absolute inset-x-0"
      style={style}
    />
  )

  const content = rounds.map((round, j) => {
    // Kolumna `j` pokazuje miejsca, które schodzą się z pierwszej kolumny okna.
    const count = Math.max(1, first / 2 ** j)
    const slots = round.slots.slice(0, count)
    const drawsOut = j < rounds.length - 1 || hasNext
    const children: React.ReactNode[] = []

    slots.forEach((slot, p) => {
      const top = center(j, p) - BRACKET_TILE_HEIGHT / 2
      if (slot.kind === 'match') children.push(<React.Fragment key={`m${slot.match.id}`}>{tile(slot.match, { top })}</React.Fragment>)
      if (slot.kind === 'bye') children.push(<BracketByeTile key={`b${p}`} team={slot.bye.team} className="absolute inset-x-0" style={{ top }} />)
    })

    if (drawsOut && slots.length >= 2) {
      for (let q = 0; q < slots.length / 2; q++) {
        const y1 = center(j, 2 * q)
        const y2 = center(j, 2 * q + 1)
        children.push(
          <div
            key={`c${q}`}
            aria-hidden
            data-slot="bracket-connector"
            className="absolute left-full rounded-r-md border-y border-r border-muted-foreground/40"
            style={{ top: y1, height: y2 - y1, width: CONNECTOR / 2 }}
          />,
        )
        if (j < rounds.length - 1) {
          children.push(
            <div
              key={`h${q}`}
              aria-hidden
              className="absolute border-t border-muted-foreground/40"
              style={{ left: `calc(100% + ${CONNECTOR / 2}px)`, top: (y1 + y2) / 2, width: CONNECTOR / 2 }}
            />,
          )
        }
      }
    }

    if (round === finalRound) {
      if (champion) {
        children.push(<BracketChampionTile key="champion" team={champion} className="absolute inset-x-0" style={{ top: championTop }} />)
      }
      if (round.third) {
        children.push(
          <p
            key="third-label"
            className="absolute inset-x-0 truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
            style={{ top: thirdTop, lineHeight: `${THIRD_LABEL_HEIGHT}px` }}
          >
            Mecz o 3. miejsce
          </p>,
        )
        children.push(<React.Fragment key="third">{tile(round.third, { top: thirdTop + THIRD_LABEL_HEIGHT })}</React.Fragment>)
      }
    }

    return (
      <div key={round.id} data-slot="bracket-column" className="relative min-w-0">
        {children}
      </div>
    )
  })

  return (
    <div className="grid" style={{ ...columns, height }}>
      {content}
    </div>
  )
}
