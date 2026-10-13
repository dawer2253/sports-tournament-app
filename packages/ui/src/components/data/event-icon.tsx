import { cn } from '../../lib/utils'

/** Piłka: koło z pięciokątem, w kolorze tekstu. Lucide nie ma piłki nożnej. */
function Ball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cn('size-4', className)}>
      <circle cx="8" cy="8" r="6.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.6 11.2 6.9 10 10.6H6L4.8 6.9Z" fill="currentColor" />
    </svg>
  )
}

const BOX = 'inline-grid shrink-0 place-items-center'

/** Przyrost za rzut w koszu, po kodzie typu. */
const THROWS: Record<string, string> = { free_throw: '+1', two_pointer: '+2', three_pointer: '+3' }

/**
 * Ikona zdarzenia meczu po kodzie typu (#210). Czysta prezentacja: kod spoza
 * listy dostaje neutralną kropkę, a nie błąd, bo sport może dostać nowy typ
 * zdarzenia szybciej niż ta lista. Znaczenie niesie etykieta obok, więc
 * ikona jest ukryta przed czytnikiem ekranu.
 *
 * Kolory kartek to dane (kartka jest żółta albo czerwona), a nie chroma,
 * więc biorą tokeny danych (`--chart-4`) i stanu (`--destructive`).
 */
export function EventIcon({ type, className }: { type: string; className?: string }) {
  if (type === 'goal') return <Ball className={className} />
  // Samobój: ta sama piłka w czerwonym kółku, żeby nie mylił się z bramką.
  if (type === 'own_goal') {
    return (
      <span aria-hidden data-icon="own-goal" className={cn(BOX, 'size-5 rounded-full ring-2 ring-destructive', className)}>
        <Ball className="size-3.5" />
      </span>
    )
  }
  if (type === 'yellow_card') return <span aria-hidden data-icon="card" className={cn(BOX, 'h-3.5 w-2.5 rounded-[2px] bg-chart-4', className)} />
  if (type === 'red_card') return <span aria-hidden data-icon="card" className={cn(BOX, 'h-3.5 w-2.5 rounded-[2px] bg-destructive', className)} />
  if (type === 'foul') {
    return (
      <span aria-hidden className={cn(BOX, 'size-5 rounded-full border text-[10px] font-semibold text-muted-foreground', className)}>
        F
      </span>
    )
  }
  const points = THROWS[type]
  if (points) {
    return (
      <span aria-hidden className={cn(BOX, 'size-5 rounded-full bg-foreground text-[10px] font-bold text-background', className)}>
        {points}
      </span>
    )
  }
  return <span aria-hidden data-icon="unknown" className={cn(BOX, 'size-2 rounded-full bg-muted-foreground', className)} />
}
