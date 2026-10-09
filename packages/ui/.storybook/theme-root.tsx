import { useEffect, type ReactNode } from 'react'

/**
 * Motyw leży na `<html>`, nie na owijającym `div`-ie: okna, menu i popovery
 * Radixa renderują się w portalu w `body`, poza drzewem story, i inaczej
 * zostawałyby jasne w motywie „Ciemny" (#136). Tło płótna nadaje `body`
 * z warstwy `base` w `index.css`.
 */
export function ThemeRoot({ theme, children }: { theme: string; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  return children
}
