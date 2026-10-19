import { cn } from '../lib/utils'

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

/** Znacznik „Na żywo”: kropka i napis, krojem zakładek. */
export function LiveTag({ className }: { className?: string }) {
  return (
    <span data-slot="live-tag" className={cn('inline-flex items-center gap-2 pub-tab text-base whitespace-nowrap text-destructive', className)}>
      <LiveDot />
      Na żywo
    </span>
  )
}

/**
 * Plakietka „Na żywo” do wiersza meczu: mniejsza od znacznika i bez łamania,
 * żeby zmieściła się w wąskiej kolumnie terminu (4,5 rem na telefonie).
 */
export function LiveBadge({ className }: { className?: string }) {
  return (
    <span
      data-slot="live-badge"
      className={cn(
        'inline-flex items-center gap-1 self-start rounded-sm bg-destructive/15 px-1.5 py-1 pub-tab text-sm leading-none whitespace-nowrap text-destructive',
        className,
      )}
    >
      <LiveDot className="size-2" />
      Na żywo
    </span>
  )
}
