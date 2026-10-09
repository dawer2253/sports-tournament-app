import { useEffect, type ReactNode } from 'react'

/** Wartości przełącznika „Motyw" z `globalTypes.theme` w `preview.tsx`. */
export type Theme = 'light' | 'dark'

/**
 * Motyw leży na `<html>`, nie na owijającym `div`-ie: okna, menu i popovery
 * Radixa renderują się w portalu w `body`, poza drzewem story, i inaczej
 * zostawałyby jasne w motywie „Ciemny" (#136). Tło płótna nadaje `body`
 * z warstwy `base` w `index.css`. Przy odmontowaniu klasa schodzi, żeby
 * strona `.mdx` bez stories nie dziedziczyła ciemnego `<html>`.
 */
export function ThemeRoot({ theme, children }: { theme: Theme; children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    return () => root.classList.remove('dark')
  }, [theme])
  return children
}
