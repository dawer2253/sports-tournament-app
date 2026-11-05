/*
  PROTOTYP (#324) — do wyrzucenia. Wspólne minimum wariantów: rama formatu
  (360 × 450 / 360 × 640 px CSS, eksport ×4) i odstępy strefy bezpiecznej
  Stories. Układ każdy wariant robi sam.
*/
import * as React from 'react'
import { brandVars } from '../../lib/brand-on-dark'
import { cn } from '../../lib/utils'
import { FORMAT_SIZE, type Format, type GDataset, type GLeaderboard, type GPreview, type GResult, type GStandings, type Kind } from './data'

/** Strefa bezpieczna Stories wg Meta (#321 §5): 14% góry, 35% dołu, 6% boków. */
export function safeInsets(format: Format) {
  const { w, h } = FORMAT_SIZE[format]
  return { top: Math.round(h * 0.14), bottom: Math.round(h * 0.35), side: Math.round(w * 0.06) }
}

export interface LayoutCtx {
  format: Format
  /** 9:16: treść tylko w strefie bezpiecznej (true) albo na całym kadrze (false). */
  safe: boolean
}

/** Odstępy treści od krawędzi kadru dla danego formatu i trybu. */
export function contentPadding({ format, safe }: LayoutCtx, normal = { top: 24, bottom: 20, side: 22 }) {
  if (format === '9:16' && safe) return safeInsets(format)
  if (format === '9:16') return { top: 48, bottom: 40, side: normal.side }
  return normal
}

export const GraphicFrame = React.forwardRef<
  HTMLDivElement,
  { format: Format; primaryColor: string; className?: string; children: React.ReactNode }
>(function GraphicFrame({ format, primaryColor, className, children }, ref) {
  const { w, h } = FORMAT_SIZE[format]
  return (
    <div
      ref={ref}
      data-slot="social-graphic"
      className={cn('public-site relative shrink-0 overflow-hidden bg-background text-foreground', className)}
      style={{ ...brandVars(primaryColor), width: w, height: h }}
    >
      {children}
    </div>
  )
})

export interface VariantProps {
  kind: Kind
  data: GDataset
  ctx: LayoutCtx
}

export type VariantData =
  | { kind: 'matchPreview'; value: GPreview }
  | { kind: 'matchResult'; value: GResult }
  | { kind: 'standings'; value: GStandings }
  | { kind: 'leaderboard'; value: GLeaderboard }

export type Density = 'normal' | 'compact' | 'tight'

/**
 * Dopasowanie listy (tabela, klasyfikacja) do miejsca w kadrze. `ref` idzie na
 * pudełko `flex-1 min-h-0`, które dostaje resztę wysokości. Hook mierzy je
 * i zwraca wysokość wiersza, gęstość (krój, herb) oraz liczbę wierszy, które
 * się mieszczą przy `minRow`; reszta idzie w dopisek „i N kolejnych”
 * o wysokości `noteH`, zamiast wiersza uciętego w pół. `reserved` to stała
 * część pudełka poza wierszami (nagłówek kolumn, odstępy, karta lidera).
 */
export function useFit(
  count: number,
  {
    minRow,
    maxRow = 36,
    reserved = 0,
    noteH = 24,
    note = false,
  }: {
    minRow: number
    maxRow?: number
    reserved?: number
    noteH?: number
    /** Dopisek stoi niezależnie od dopasowania (limit wierszy z #323, ex aequo), więc miejsce na niego jest zawsze. */
    note?: boolean
  },
) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [height, setHeight] = React.useState(0)
  React.useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setHeight(el.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const space = Math.max(0, height - reserved)
  let visible = count
  if (height > 0 && count * minRow > space - (note ? noteH : 0)) visible = Math.max(1, Math.floor((space - noteH) / minRow))
  const rowSpace = space - (visible < count || note ? noteH : 0)
  const rowH = height > 0 ? Math.max(minRow, Math.min(maxRow, rowSpace / Math.max(1, visible))) : maxRow
  const density: Density = rowH >= 30 ? 'normal' : rowH >= 24 ? 'compact' : 'tight'
  return { ref, visible, hidden: count - visible, rowH, density }
}

/** Krój i herb wiersza listy dla gęstości. */
export const DENSITY = {
  normal: { text: 'text-pub-14', num: 'text-pub-16', crest: 'size-5' },
  compact: { text: 'text-pub-13', num: 'text-pub-14', crest: 'size-5' },
  tight: { text: 'text-pub-13', num: 'text-pub-13', crest: 'size-4' },
} as const

export function scorerText(s: { player: string; minute: string; ownGoal?: boolean }) {
  return `${s.player} ${s.minute}${s.ownGoal ? ' (sam.)' : ''}`
}
