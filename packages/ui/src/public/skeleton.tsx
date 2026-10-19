import type * as React from 'react'
import { cn } from '../lib/utils'

/**
 * Szkielet wczytywania: bloki w `--pub-sunken`, które pulsują poza
 * `prefers-reduced-motion`. Każdy ekran składa z nich swój kształt
 * (nagłówek, wiersze) w `Loading`, zamiast pokazywać jeden prostokąt.
 */
export function SkeletonBlock({ className }: { className?: string }) {
  return <span aria-hidden data-slot="skeleton-block" className={cn('block rounded-md bg-sunken motion-safe:animate-pulse', className)} />
}

/** Szkielet nagłówka ekranu: podpis i tytuł tablicy. */
export function SkeletonHead() {
  return (
    <div className="flex flex-col gap-3">
      <SkeletonBlock className="h-4 w-24" />
      <SkeletonBlock className="h-14 w-72 max-w-full sm:h-16" />
    </div>
  )
}

/** Szkielet listy: belka sekcji i `rows` wierszy. */
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      <SkeletonBlock className="mb-2 h-8 w-48 max-w-full" />
      {Array.from({ length: rows }, (_, index) => (
        <SkeletonBlock key={index} className="h-14 w-full" />
      ))}
    </div>
  )
}

/**
 * Wczytywanie: `role="status"` z etykietą (np. „Wczytywanie terminarza”).
 * Bez `children` rysuje kształt domyślny: nagłówek ekranu i wiersze.
 */
export function Loading({ label, children, className }: { label: string; children?: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-label={label} className={cn('flex flex-col gap-10', className)}>
      {children ?? (
        <>
          <SkeletonHead />
          <SkeletonRows />
        </>
      )}
    </div>
  )
}
