import { expect } from 'storybook/test'

/**
 * Kolor tokenu tak, jak liczy go przeglądarka. Próbny element bierze tło
 * z `var(--token)`, więc wynik ma ten sam zapis co tło komponentu z klasy
 * `bg-<token>` i da się je porównać wprost.
 */
function tokenColor(token: string) {
  const probe = document.createElement('div')
  probe.style.backgroundColor = `var(--${token})`
  document.body.append(probe)
  const color = getComputedStyle(probe).backgroundColor
  probe.remove()
  return color
}

/**
 * Sprawdza, że zaznaczona kontrolka Radixa (`data-state="checked"`) ma tło
 * `--primary`, a niezaznaczona inne. Bez wariantu `data-checked` z
 * `shadcn/tailwind.css` zaznaczona zostaje przezroczysta i wygląda na pustą
 * (#172).
 */
export async function expectCheckedFill(checked: HTMLElement, unchecked: HTMLElement) {
  await expect(checked).toHaveAttribute('data-state', 'checked')
  await expect(unchecked).toHaveAttribute('data-state', 'unchecked')

  // Kontrolki mają `transition-*`, a ciemny motyw trafia na `<html>` już po
  // zamontowaniu story: bez tego odczyt łapałby kolor w połowie przejścia.
  checked.style.transition = 'none'
  unchecked.style.transition = 'none'
  const checkedFill = getComputedStyle(checked).backgroundColor
  const uncheckedFill = getComputedStyle(unchecked).backgroundColor
  checked.style.transition = ''
  unchecked.style.transition = ''

  await expect(checkedFill).not.toBe('rgba(0, 0, 0, 0)')
  await expect(checkedFill).not.toBe(uncheckedFill)
  await expect(checkedFill).toBe(tokenColor('primary'))
}
