import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { MATCH_CLOCK_TICK_MS, type MatchClockSettings, type MatchClockState } from '../lib/match-clock'
import { cn } from '../lib/utils'
import { MatchClockContext, useMatchClock } from './match-clock-context'

/**
 * „Na żywo” zawsze w `--destructive`, niezależnie od koloru turnieju: to stan,
 * a nie akcent, więc wygląda tak samo w każdym turnieju (#287). Kropka
 * pulsuje, poza `prefers-reduced-motion`.
 */
function LiveDot({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('relative flex size-2.5 shrink-0', className)}>
      <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-60 motion-reduce:animate-none" />
      <span className="relative size-full rounded-full bg-destructive" />
    </span>
  )
}

/** Zegar meczu z kontraktu; brak pola to mecz bez zegara (samo „Na żywo”). */
type ClockProp = { clock?: Partial<MatchClockState> | null }

/**
 * Zegar meczów na żywo (#297): ustawienia turnieju dla każdego „Na żywo”
 * pod spodem i jedno „teraz” przeliczane co 30 s, więc minuta idzie bez
 * nowych zapytań i stoi tak samo w wierszu, na tablicy i na kaflu. `now`
 * zatrzymuje zegar (stories).
 */
export function MatchClockProvider({ settings, now, children }: { settings: MatchClockSettings; now?: Date; children: ReactNode }) {
  const [tick, setTick] = useState(() => new Date())
  useEffect(() => {
    if (now) return
    const timer = setInterval(() => setTick(new Date()), MATCH_CLOCK_TICK_MS)
    return () => clearInterval(timer)
  }, [now])
  const current = now ?? tick
  const value = useMemo(() => ({ settings, now: current }), [settings, current])
  return <MatchClockContext value={value}>{children}</MatchClockContext>
}

/** Dopisek zegara przy „Na żywo”: minuta albo stan, krojem liczb; bez dopisku nic. */
export function LiveClock({ clock, className }: ClockProp & { className?: string }) {
  const text = useMatchClock(clock)
  if (text === null) return null
  return (
    <span data-slot="live-clock" className={cn('pub-num whitespace-nowrap text-foreground', className)}>
      {text}
    </span>
  )
}

/**
 * Znacznik „Na żywo”: kropka i napis, krojem zakładek, a za nim zegar meczu.
 * `compact` (kafel Drabinki, gdzie obok stoi pozycja meczu): przy zegarze
 * napis „Na żywo” zostaje tylko dla czytnika, a widać kropkę i zegar, żeby
 * pozycja („Mecz o 3. miejsce”) nie traciła liter w wąskiej kolumnie.
 */
export function LiveTag({ clock, compact = false, className }: ClockProp & { compact?: boolean; className?: string }) {
  const short = useMatchClock(clock) !== null && compact
  return (
    <span data-slot="live-tag" className={cn('inline-flex items-center gap-2 pub-tab text-pub-16 whitespace-nowrap text-destructive', short && 'gap-1', className)}>
      <LiveDot />
      {short ? <span className="sr-only">Na żywo</span> : 'Na żywo'}
      <LiveClock clock={clock} />
    </span>
  )
}

/**
 * Plakietka „Na żywo” do wiersza meczu: mniejsza od znacznika i bez łamania,
 * żeby zmieściła się w wąskiej kolumnie terminu (4,5 rem na telefonie).
 * Zegar stoi pod nią (`LiveClock` w wierszu), bo „90+4′” obok się nie mieści.
 */
export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      data-slot="live-badge"
      className={cn(
        'inline-flex items-center gap-1 self-start rounded-sm bg-destructive/15 px-1.5 py-1 pub-tab text-pub-14 leading-none whitespace-nowrap text-destructive',
        className,
      )}
    >
      <LiveDot className="size-2" />
      Na żywo
    </span>
  )
}
