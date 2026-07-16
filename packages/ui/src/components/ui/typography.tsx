import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Jedno źródło prawdy dla nagłówków. Reguła "H1 = wersaliki" żyje TUTAJ,
// więc żaden ekran nie może jej złamać przypadkiem.
const headingVariants = cva('tracking-tight text-foreground', {
  variants: {
    level: {
      page: 'text-2xl font-bold uppercase',        // tytuł strony (H1) — ZAWSZE wersaliki
      section: 'text-lg font-semibold',            // nagłówek sekcji (H2)
      card: 'text-base font-semibold tracking-normal', // tytuł karty (H3)
    },
  },
  defaultVariants: { level: 'page' },
})

const TAG = { page: 'h1', section: 'h2', card: 'h3' } as const

export interface HeadingProps
  extends React.HTMLAttributes<HTMLHeadingElement>,
    VariantProps<typeof headingVariants> {
  /** Nadpisuje znacznik HTML bez zmiany stylu (np. wizualny H1 jako <h2> semantycznie). */
  as?: 'h1' | 'h2' | 'h3'
}

export function Heading({ className, level = 'page', as, ...props }: HeadingProps) {
  const Tag = as ?? TAG[level ?? 'page']
  return <Tag data-slot="heading" className={cn(headingVariants({ level }), className)} {...props} />
}

export { headingVariants }
