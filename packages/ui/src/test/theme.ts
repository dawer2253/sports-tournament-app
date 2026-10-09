import { expect } from 'storybook/test'

/**
 * Sprawdza, że element z portalu Radixa bierze ciemny motyw. Portal leży
 * w `body`, poza drzewem story, więc działa to tylko wtedy, gdy dekorator
 * motywu kładzie `.dark` na `<html>` (#136). Klasa zdejmowana jest na chwilę,
 * żeby porównać tło z jasnym: samo `classList.contains` nie pokazałoby, że
 * portal faktycznie z niej korzysta.
 */
export async function expectDarkPortal(selector: string) {
  const root = document.documentElement
  const element = document.querySelector<HTMLElement>(selector)
  await expect(element).toBeInTheDocument()
  await expect(root).toHaveClass('dark')
  if (!element) return

  // Okna mają `transition-all`: bez tego odczyt po zdjęciu klasy łapałby
  // wartość startową przejścia, czyli nadal ciemną.
  element.style.transition = 'none'
  const dark = getComputedStyle(element).backgroundColor
  root.classList.remove('dark')
  const light = getComputedStyle(element).backgroundColor
  root.classList.add('dark')
  element.style.transition = ''

  await expect(dark).not.toBe(light)
}
