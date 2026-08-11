import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Wspólny „pas fotograficzny" ekranów public: zdjęcie w tle + nakładka marki,
// żeby biały tekst zawsze miał kontrast, a zieleń „pitch" pozostała dominantą.
// Jedno źródło prawdy — ekrany nie składają własnych warstw z img + gradientem.
const overlayVariants = cva('absolute inset-0 -z-10', {
  variants: {
    overlay: {
      /** Tekst na zdjęciu (nagłówki, nawigacja) — zieleń mocno kryje. */
      strong: 'bg-brand/85',
      /** Duża plama z pojedynczą liczbą lub ikoną — zdjęcie prześwituje. */
      soft: 'bg-brand/70',
    },
  },
  defaultVariants: { overlay: 'strong' },
})

export interface PhotoPanelProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof overlayVariants> {
  src: string
  /** Kadrowanie zdjęcia (CSS object-position), np. 'center 70%'. */
  focus?: string
}

export function PhotoPanel({
  src,
  focus = 'center',
  overlay,
  className,
  children,
  ...props
}: PhotoPanelProps) {
  return (
    <div className={cn('relative isolate overflow-hidden text-brand-foreground', className)} {...props}>
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-20 size-full object-cover"
        style={{ objectPosition: focus }}
      />
      <div aria-hidden className={cn(overlayVariants({ overlay }))} />
      {children}
    </div>
  )
}
