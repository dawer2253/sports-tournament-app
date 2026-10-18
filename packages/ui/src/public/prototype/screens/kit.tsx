/**
 * PROTOTYP S7 (#288) — klocki pozostałych ekranów w języku wariantu C
 * „Kolejka” z #287: shell z aktywną zakładką, nagłówek ekranu, stan pusty,
 * przycisk i pływający przełącznik stories. Bez importów z `components/ui`.
 */
import * as React from 'react'
import type { PublicNavKey } from '../../../components/layout/public-nav'
import type { PublicShellTournament } from '../../../components/layout/public-shell-tournament'
import { cn } from '../../../lib/utils'
import { ACCENT_SAMPLES, type AccentKey } from '../accent'
import { DeadLink, Footer, PublicRoot, TAB_LABELS, Tabs, TournamentMark } from '../parts'

/**
 * Pasek shella: logo i nazwa, obok zakładki. Na telefonie zakładki się nie
 * mieściły i były ucinane, więc poniżej `md` chowają się pod przyciskiem menu
 * i rozwijają listą pod paskiem (#288, po przeglądzie).
 */
export function ShellHeader({ tournament, tabs, active }: { tournament: PublicShellTournament; tabs: readonly PublicNavKey[]; active?: PublicNavKey }) {
  const [open, setOpen] = React.useState(false)
  const menuId = React.useId()

  React.useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className="border-b border-hairline bg-sunken">
      <div className="mx-auto flex max-w-6xl flex-col gap-x-10 px-4 sm:px-6 md:pt-4 lg:flex-row lg:items-end lg:justify-between lg:pt-0">
        <div className="flex min-h-16 items-center justify-between gap-3 md:min-h-0">
          <DeadLink className="flex min-w-0 items-center gap-3 lg:py-4">
            <TournamentMark tournament={tournament} className="size-10" />
            <span className="pub-title truncate leading-[1.2] text-2xl">{tournament.name}</span>
          </DeadLink>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen(!open)}
            className="grid size-11 shrink-0 place-items-center rounded-md text-foreground ring-1 ring-inset ring-border hover:bg-muted md:hidden"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
        {/* Bez `active` (strona meczu, 404) nic nie jest podświetlone; `Tabs` z #287 domyślnie podświetla Przegląd. */}
        <Tabs tabs={tabs} active={active ?? ('' as PublicNavKey)} className="hidden md:flex" itemClassName="lg:pb-4 lg:pt-5" />
        {open && (
          <nav id={menuId} aria-label="Sekcje turnieju" className="-mx-4 flex flex-col border-t border-hairline pb-2 md:hidden">
            {tabs.map((key) => (
              <DeadLink
                key={key}
                aria-current={key === active ? 'page' : undefined}
                onClick={(event) => { event.preventDefault(); setOpen(false) }}
                className={cn(
                  'flex min-h-12 items-center border-l-[3px] px-4 pub-tab text-xl',
                  key === active ? 'border-brand-line bg-card text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                {TAB_LABELS[key]}
              </DeadLink>
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}

/** Shell wariantu C: jeden pasek (logo, nazwa, zakładki), pod nim treść ekranu. */
export function Shell({
  tournament,
  tabs,
  active,
  accent,
  children,
}: {
  tournament: PublicShellTournament
  tabs: readonly PublicNavKey[]
  active?: PublicNavKey
  accent: string
  children: React.ReactNode
}) {
  return (
    <PublicRoot accent={accent}>
      <ShellHeader tournament={tournament} tabs={tabs} active={active} />
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-24 pt-8 sm:px-6 sm:pt-10">{children}</main>
      <Footer tournament={tournament} />
    </PublicRoot>
  )
}

/**
 * Nagłówek ekranu jak nagłówek pasa kolejki z Przeglądu: mały podpis nad
 * wielkim tytułem tablicy, fakty po prawej (bez kropek między nimi).
 */
export function PageHead({ eyebrow, title, meta, id }: { eyebrow?: React.ReactNode; title: React.ReactNode; meta?: React.ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && <span className="text-sm text-muted-foreground">{eyebrow}</span>}
        <h1 id={id} className="pub-title text-[2.5rem] sm:text-[4rem]">{title}</h1>
      </div>
      {meta && <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-muted-foreground">{meta}</div>}
    </div>
  )
}

/** Fakt w nagłówku: liczba tablicą, reszta zwykłym tekstem. */
export function Fact({ value, children }: { value?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span>
      {value !== undefined && <span className="pub-num text-lg text-foreground">{value}</span>} {children}
    </span>
  )
}

/**
 * Stan pusty ekranu: wnęka (`--pub-sunken`) z nagłówkiem tablicy i jednym
 * zdaniem, opcjonalnie z odnośnikiem dalej. Zastępuje `EmptyState` z panelu.
 */
export function EmptyBoard({ title, children, action, className }: { title: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-start gap-3 rounded-md bg-sunken px-6 py-10 sm:px-10 sm:py-14', className)}>
      <h2 className="pub-h2 text-[1.75rem] sm:text-[2.5rem]">{title}</h2>
      <p className="max-w-xl text-muted-foreground">{children}</p>
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}

/**
 * Przycisk strony publicznej: obrys i karta, krój zakładek. Wypełnienie
 * kolorem turnieju zostaje dla #289 (granat i bordo ledwo odcinają się od tła).
 */
export function PubButton({ className, children, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-card px-5 pub-tab text-base ring-1 ring-inset ring-border transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/** Odnośnik w treści: kolor turnieju w progu tekstu (`--brand-text`). */
export function TextLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return <DeadLink className={cn('font-medium text-brand-text underline-offset-4 hover:underline', className)}>{children}</DeadLink>
}

/** Powrót na stronie meczu: strzałka i nazwa zakładki. */
export function BackTo({ children }: { children: React.ReactNode }) {
  return (
    <DeadLink className="inline-flex min-h-11 items-center gap-2 self-start pub-tab text-base text-muted-foreground hover:text-foreground">
      <span aria-hidden>←</span>
      {children}
    </DeadLink>
  )
}

// --- Przełącznik stories ---------------------------------------------------------

export type Control = { key: string; options: Record<string, string> }

/**
 * Pływający pasek prototypu, uogólniony z `switcher.tsx` z #287: warianty
 * (←/→ i strzałki), dowolne grupy opcji i kolor turnieju. Stan siedzi
 * w argsach story, więc w adresie.
 */
export function ScreenSwitcher<A extends Record<string, unknown>>({
  args,
  update,
  variants,
  controls,
}: {
  args: A & { accent: AccentKey; variant?: string }
  update: (next: Partial<A & { accent: AccentKey; variant?: string }>) => void
  variants?: Record<string, string>
  controls: Control[]
}) {
  const keys = variants ? Object.keys(variants) : []
  const index = keys.indexOf(args.variant ?? '')
  const cycle = React.useCallback(
    (step: number) => keys.length > 0 && update({ variant: keys[(index + step + keys.length) % keys.length] } as never),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, keys.join(), update],
  )

  React.useEffect(() => {
    if (!variants) return
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return
      if (event.key === 'ArrowLeft') cycle(-1)
      if (event.key === 'ArrowRight') cycle(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycle, variants])

  return (
    <div
      data-prototype-switcher
      className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl bg-zinc-50 px-3 py-2 font-sans text-zinc-900 shadow-2xl ring-1 ring-zinc-300"
    >
      {variants && (
        <span className="flex items-center gap-1">
          <button type="button" aria-label="Poprzedni wariant" onClick={() => cycle(-1)} className="grid size-7 place-items-center rounded-full hover:bg-zinc-200">←</button>
          <span className="min-w-28 text-center text-sm font-semibold">{args.variant} ({variants[args.variant!]})</span>
          <button type="button" aria-label="Następny wariant" onClick={() => cycle(1)} className="grid size-7 place-items-center rounded-full hover:bg-zinc-200">→</button>
        </span>
      )}
      {controls.map((control) => (
        <span key={control.key} className="flex items-center gap-0.5">
          {Object.entries(control.options).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={String(args[control.key]) === value}
              onClick={() => update({ [control.key]: value } as never)}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                String(args[control.key]) === value ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-200',
              )}
            >
              {label}
            </button>
          ))}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        {(Object.keys(ACCENT_SAMPLES) as AccentKey[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-label={ACCENT_SAMPLES[key].label}
            title={ACCENT_SAMPLES[key].label}
            aria-pressed={args.accent === key}
            onClick={() => update({ accent: key } as never)}
            className={cn('size-5 rounded-full ring-offset-2 ring-offset-zinc-50', args.accent === key ? 'ring-2 ring-zinc-900' : 'ring-1 ring-zinc-300')}
            // Próbka koloru turnieju: dane, nie token.
            style={{ backgroundColor: ACCENT_SAMPLES[key].hex }}
          />
        ))}
      </span>
    </div>
  )
}
