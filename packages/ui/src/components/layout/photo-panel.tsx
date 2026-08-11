import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Wspólny „pas fotograficzny" ekranów public: zdjęcie w tle + nakładka marki,
// żeby biały tekst zawsze miał kontrast, a zieleń „pitch" pozostała dominantą.
// Jedno źródło prawdy — ekrany nie składają własnych warstw z img + gradientem.
const overlayVariants = cva('absolute inset-0 -z-10', {
  variants: {
    overlay: {
      /**
       * Zdjęcie z wyraźnym jasnym motywem (piłka, zawodnik) pod tekstem —
       * zieleń musi mocno kryć, inaczej litery siadają na jasnej plamie.
       */
      strong: 'bg-brand/85',
      /**
       * Sama murawa pod tekstem. Trawa ma zbliżoną jasność do zieleni marki,
       * więc słabsza nakładka nie rusza kontrastu liter, a dopiero przy niej
       * widać, że to zdjęcie, a nie płaskie tło.
       */
      texture: 'bg-brand/75',
    },
  },
  defaultVariants: { overlay: 'texture' },
})

export interface PhotoPanelProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof overlayVariants> {
  src: string
  /**
   * Kadrowanie zdjęcia (CSS object-position). Domyślnie dolna część kadru:
   * w niskim pasie (~60 px) każdy obiekt na zdjęciu jest wyższy niż sam pas,
   * więc kadr przez niego daje bezsensowny plaster. Sama murawa czyta się
   * jako faktura przy dowolnej wysokości.
   */
  focus?: string
}

export function PhotoPanel({
  src,
  focus = '50% 82%',
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
