import type * as React from 'react'
import { cn } from '../lib/utils'
import { TextLink } from './button'
import type { AnchorProps } from './anchor'

/**
 * Nagłówek ekranu: mały podpis nad tytułem tablicy (Barlow Condensed 800,
 * wersaliki) i fakty po prawej, bez kropek między nimi. Tytuł jest `h2`,
 * bo `h1` to nazwa turnieju w pasku shella.
 */
export function PageHead({ eyebrow, title, meta, id }: { eyebrow?: React.ReactNode; title: React.ReactNode; meta?: React.ReactNode; id?: string }) {
  return (
    <div data-slot="page-head" className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
      <div className="flex min-w-0 flex-col gap-1">
        {eyebrow && <span className="text-pub-14 text-muted-foreground">{eyebrow}</span>}
        <h2 id={id} className="pub-title wrap-break-word sm:text-pub-64">
          {title}
        </h2>
      </div>
      {meta && <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-muted-foreground">{meta}</div>}
    </div>
  )
}

/** Fakt w nagłówku ekranu: liczba tablicą, reszta zwykłym tekstem („14 kolejek”). */
export function Fact({ value, children }: { value?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span data-slot="fact">
      {value !== undefined && <span className="pub-num text-pub-20 text-foreground">{value}</span>} {children}
    </span>
  )
}

/**
 * Belka sekcji: tytuł zdaniem na grubej linii `--pub-rule` i odnośnik do
 * pełnego widoku. Tytuł jest `h3` (pod `h2` nagłówka ekranu).
 */
export function SectionHead({
  id,
  title,
  link,
  sub,
}: {
  id?: string
  title: string
  /** Odnośnik do pełnego widoku, np. „Pełna tabela”. */
  link?: AnchorProps & { label: string }
  sub?: React.ReactNode
}) {
  return (
    <div data-slot="section-head" className="flex flex-col gap-1.5">
      <div className={cn('flex items-baseline justify-between gap-4 border-b-2 border-rule pb-2')}>
        <h3 id={id} className="pub-h2">
          {title}
        </h3>
        {link && <SectionLink {...link} />}
      </div>
      {sub && <div className="text-pub-14 text-muted-foreground">{sub}</div>}
    </div>
  )
}

function SectionLink({ label, className, ...props }: AnchorProps & { label: string }) {
  return (
    <TextLink className={cn('shrink-0 text-pub-14', className)} {...props}>
      {label}
    </TextLink>
  )
}
