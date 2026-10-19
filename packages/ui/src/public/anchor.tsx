import type * as React from 'react'
import { isModifiedClick } from '../lib/utils'

export interface AnchorProps extends React.ComponentProps<'a'> {
  /**
   * Przejęcie kliknięcia, np. nawigacja routera. Klik z klawiszem
   * modyfikującym (nowa karta) zostaje przeglądarce i idzie pod `href`.
   */
  onNavigate?: () => void
}

/**
 * Odnośnik strony publicznej: zwykły `<a href>`, a nawigację podaje
 * aplikacja przez `onNavigate`, jak zakładkom shella. Bez `onNavigate`
 * działa jak zwykły odnośnik (Storybook, adres zewnętrzny).
 */
export function Anchor({ onNavigate, onClick, ...props }: AnchorProps) {
  return (
    <a
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (!onNavigate || event.defaultPrevented || isModifiedClick(event)) return
        event.preventDefault()
        onNavigate()
      }}
    />
  )
}
