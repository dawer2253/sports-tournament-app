/**
 * PROTOTYP S7 (#287) — pływający przełącznik wariantów. Zmienia argsy story
 * (`useArgs`), więc stan siedzi w adresie i przeżywa przeładowanie.
 * Strzałki ← → przełączają wariant. Celowo nie wygląda jak strona.
 */
import * as React from 'react'
import { cn } from '../../lib/utils'
import { ACCENT_SAMPLES, type AccentKey } from './accent'
import type { TournamentState } from './demo'

export const VARIANTS = {
  A: 'Tablica',
  B: 'Stadion',
  C: 'Kolejka, wybrany',
} as const

export type VariantKey = keyof typeof VARIANTS

export const STATES: Record<TournamentState, string> = {
  'bez-terminarza': 'Bez terminarza',
  'przed-startem': 'Przed startem',
  'w-trakcie': 'W trakcie',
  zakonczony: 'Zakończony',
}

export type PrototypeArgs = {
  variant: VariantKey
  state: TournamentState
  accent: AccentKey
  photo: boolean
}

const keys = Object.keys(VARIANTS) as VariantKey[]

function Pill({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition-colors', active ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-200')}
    >
      {children}
    </button>
  )
}

export function Switcher({ args, update }: { args: PrototypeArgs; update: (next: Partial<PrototypeArgs>) => void }) {
  const index = keys.indexOf(args.variant)
  const cycle = React.useCallback(
    (step: number) => update({ variant: keys[(index + step + keys.length) % keys.length] }),
    [index, update],
  )

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return
      if (event.key === 'ArrowLeft') cycle(-1)
      if (event.key === 'ArrowRight') cycle(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycle])

  return (
    <div
      data-prototype-switcher
      className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl bg-zinc-50 px-3 py-2 font-sans text-zinc-900 shadow-2xl ring-1 ring-zinc-300"
    >
      <span className="flex items-center gap-1">
        <button type="button" aria-label="Poprzedni wariant" onClick={() => cycle(-1)} className="grid size-7 place-items-center rounded-full hover:bg-zinc-200">←</button>
        <span className="min-w-28 text-center text-sm font-semibold">{args.variant} ({VARIANTS[args.variant]})</span>
        <button type="button" aria-label="Następny wariant" onClick={() => cycle(1)} className="grid size-7 place-items-center rounded-full hover:bg-zinc-200">→</button>
      </span>
      <span className="flex items-center gap-0.5">
        {(Object.keys(STATES) as TournamentState[]).map((state) => (
          <Pill key={state} active={args.state === state} onClick={() => update({ state })}>{STATES[state]}</Pill>
        ))}
      </span>
      <span className="flex items-center gap-1.5">
        {(Object.keys(ACCENT_SAMPLES) as AccentKey[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-label={ACCENT_SAMPLES[key].label}
            title={ACCENT_SAMPLES[key].label}
            aria-pressed={args.accent === key}
            onClick={() => update({ accent: key })}
            className={cn('size-5 rounded-full ring-offset-2 ring-offset-zinc-50', args.accent === key ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-300')}
            // Próbka koloru turnieju: dane, nie token.
            style={{ backgroundColor: ACCENT_SAMPLES[key].hex }}
          />
        ))}
      </span>
      {args.variant === 'B' && (
        <Pill active={args.photo} onClick={() => update({ photo: !args.photo })} title="Sport ze zdjęciem albo bez">
          {args.photo ? 'Ze zdjęciem' : 'Bez zdjęcia'}
        </Pill>
      )}
    </div>
  )
}
