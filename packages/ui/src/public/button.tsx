import type * as React from 'react'
import { cn } from '../lib/utils'
import { Anchor, type AnchorProps } from './anchor'

const BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-card px-5 pub-tab text-base text-foreground ring-1 ring-inset ring-border transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line'

/**
 * Przycisk strony publicznej: obrys na karcie, krój zakładek, cel dotyku
 * ≥ 44 px i `focus-visible` w `--brand-line`. Z `href` jest odnośnikiem
 * (nawigację podaje `onNavigate`), bez niego zwykłym `<button>`.
 */
export function Button(props: (React.ComponentProps<'button'> & { href?: undefined }) | AnchorProps) {
  if (props.href !== undefined) {
    const { className, ...rest } = props as AnchorProps
    return <Anchor data-slot="button" className={cn(BUTTON, className)} {...rest} />
  }
  const { className, type = 'button', ...rest } = props as React.ComponentProps<'button'>
  return <button data-slot="button" type={type} className={cn(BUTTON, className)} {...rest} />
}

/** Odnośnik w treści: kolor turnieju w progu tekstu (`--brand-text`, ≥ 4,5:1 z kartą). */
export function TextLink({ className, ...props }: AnchorProps) {
  return (
    <Anchor
      data-slot="text-link"
      className={cn(
        'font-medium text-brand-text underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-line',
        className,
      )}
      {...props}
    />
  )
}

/** Powrót, np. ze strony meczu: strzałka i nazwa zakładki („← Wyniki”). */
export function BackTo({ className, children, ...props }: AnchorProps) {
  return (
    <Anchor
      data-slot="back-to"
      className={cn('inline-flex min-h-11 items-center gap-2 self-start pub-tab text-base text-muted-foreground hover:text-foreground', className)}
      {...props}
    >
      <span aria-hidden>←</span>
      {children}
    </Anchor>
  )
}
