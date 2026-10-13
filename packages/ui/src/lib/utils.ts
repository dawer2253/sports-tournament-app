import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
