import type * as React from 'react'
import { BRAND_COLOR_SAMPLES, brandVars } from '../lib/brand-on-dark'

/**
 * Pomocnik stories: ten sam klocek na każdej z czterech próbek koloru
 * turnieju naraz, każda na własnym korzeniu `.public-site`. Story, które go
 * używa, wyłącza przełącznik „Kolor turnieju” (`parameters.brandColor.disable`),
 * bo jego nadpisanie przykryłoby próbki.
 */
export function EachSample({ children }: { children: (sample: { label: string; hex: string }) => React.ReactNode }) {
  return (
    <div className="grid gap-4 p-4">
      {Object.values(BRAND_COLOR_SAMPLES).map((sample) => (
        <div key={sample.hex} data-sample={sample.hex} className="public-site rounded-md bg-card p-4" style={brandVars(sample.hex)}>
          {children(sample)}
        </div>
      ))}
    </div>
  )
}
