import type * as React from 'react'
import { cn } from '../lib/utils'
import { Button } from './button'

export interface EmptyBoardProps {
  /** Nagłówek tablicy, np. „Nie ma takiego meczu”. */
  title: string
  /** Jedno zdanie: co się stało i co dalej. */
  children: React.ReactNode
  /** Akcja pod zdaniem, np. odnośnik do zakładki. */
  action?: React.ReactNode
  className?: string
}

/**
 * Stan pusty ekranu: wnęka (`--pub-sunken`) z nagłówkiem tablicy, jednym
 * zdaniem i opcjonalną akcją. Zastępuje `EmptyState` z panelu. Nagłówek jest
 * `h2`, bo `h1` to nazwa turnieju w pasku shella.
 */
export function EmptyBoard({ title, children, action, className }: EmptyBoardProps) {
  return (
    <div data-slot="empty-board" className={cn('flex flex-col items-start gap-3 rounded-md bg-sunken px-6 py-10 sm:px-10 sm:py-14', className)}>
      <h2 className="pub-h2 sm:text-[2.5rem]">{title}</h2>
      <p className="max-w-xl text-muted-foreground">{children}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}

/**
 * Stan błędu: tablica z treścią błędu i „Spróbuj ponownie”, które woła
 * `onRetry`. Bez `onRetry` (ponowienie robi samo odpytywanie) bez przycisku.
 */
export function ErrorBoard({ title, message, onRetry, className }: { title: string; message: string; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className="contents">
      <EmptyBoard title={title} className={className} action={onRetry && <Button onClick={onRetry}>Spróbuj ponownie</Button>}>
        {message}
      </EmptyBoard>
    </div>
  )
}
