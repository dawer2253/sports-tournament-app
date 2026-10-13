import { expect } from 'storybook/test'
import { contrastRatio } from '../lib/contrast'

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

/** Kolor CSS (także `oklch` i z kanałem alfa) jako `[r, g, b, a]` w sRGB, przez canvas przeglądarki. */
function rgba(color: string): [number, number, number, number] {
  const context = document.createElement('canvas').getContext('2d')!
  context.fillStyle = color
  context.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
  return [r!, g!, b!, a! / 255]
}

const hex = ([r, g, b]: number[]) => `#${[r, g, b].map((channel) => Math.round(channel!).toString(16).padStart(2, '0')).join('')}`

/**
 * Kontrast tekstu elementu z tłem, które naprawdę pod nim leży: tła
 * półprzezroczyste (`bg-destructive/20`) nakłada się od pierwszego kryjącego
 * przodka w górę, tak jak robi to przeglądarka.
 */
export function textContrast(element: HTMLElement): number {
  const layers: string[] = []
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const background = getComputedStyle(node).backgroundColor
    const [, , , alpha] = rgba(background)
    if (alpha > 0) layers.push(background)
    if (alpha === 1) break
  }
  const context = document.createElement('canvas').getContext('2d')!
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, 1, 1)
  for (const layer of layers.reverse()) {
    context.fillStyle = layer
    context.fillRect(0, 0, 1, 1)
  }
  const background = hex([...context.getImageData(0, 0, 1, 1).data])
  return contrastRatio(hex(rgba(getComputedStyle(element).color)), background)
}
