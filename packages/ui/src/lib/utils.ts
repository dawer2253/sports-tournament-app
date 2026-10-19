import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * Skala typografii strony publicznej (`--text-pub-*` w `src/public/theme.css`).
 * Bez tego wpisu tailwind-merge brałby `text-pub-40` za kolor i w `cn()`
 * zjadałby nim `text-brand-line` albo `text-muted-foreground`.
 */
export const PUBLIC_TEXT_SCALE = ["pub-13", "pub-14", "pub-16", "pub-20", "pub-28", "pub-40", "pub-64", "pub-120"] as const

const twMerge = extendTailwindMerge({ extend: { theme: { text: [...PUBLIC_TEXT_SCALE] } } })

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Czy klik w odnośnik ma zostać przeglądarce: inny przycisk albo klawisz
 * modyfikujący (nowa karta, okno). Odnośnik przejmowany przez router
 * (`onNavigate`) nie woła wtedy `preventDefault()`.
 */
export function isModifiedClick(event: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}
