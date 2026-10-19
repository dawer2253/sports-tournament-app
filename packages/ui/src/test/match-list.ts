import { expect } from 'storybook/test'
import { textFitProblems } from './viewport'

/**
 * Pomiary wiersza meczu strony publicznej (#292) dla funkcji `play`: tylko
 * w przeglądarce, nie w jsdom.
 */

function rows(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>('[data-slot="match-row"]')]
}

/** Okienka wyniku każdego wiersza: lewa krawędź względem wiersza i szerokość, gospodarz i gość. */
function windows(root: HTMLElement) {
  return rows(root).map((row) => {
    const left = row.getBoundingClientRect().left
    return [...row.querySelectorAll<HTMLElement>('[data-slot="score-cell"]')].map((cell) => {
      const box = cell.getBoundingClientRect()
      return { left: Math.round(box.left - left), width: Math.round(box.width) }
    })
  })
}

/**
 * Okienka wyniku stoją w tym samym miejscu i mają tę samą szerokość w każdym
 * wierszu, z karnymi i bez, w meczu zaplanowanym i w pustym slocie, a wynik
 * trzycyfrowy mieści się w okienku.
 */
export async function expectScoreWindowsAligned(root: HTMLElement) {
  await document.fonts.ready
  const all = windows(root)
  await expect(all.length).toBeGreaterThan(1)
  for (const row of all) await expect(row).toEqual(all[0])
  for (const cell of root.querySelectorAll<HTMLElement>('[data-slot="score-cell"]')) {
    await expect(cell.scrollWidth).toBeLessThanOrEqual(cell.clientWidth)
  }
}

/**
 * Plakietka „Na żywo” ma wysokość jednej linii i zostawia w kolumnie terminu
 * miejsce na minutę z #297 („Na żywo 67'”, ok. 1,5 rem).
 */
export async function expectLiveBadgeFits(root: HTMLElement) {
  await document.fonts.ready
  const badges = [...root.querySelectorAll<HTMLElement>('[data-slot="live-badge"]')]
  await expect(badges.length).toBeGreaterThan(0)
  for (const badge of badges) {
    const box = badge.getBoundingClientRect()
    const lineHeight = parseFloat(getComputedStyle(badge).fontSize) * 1.6
    await expect(box.height).toBeLessThanOrEqual(lineHeight)
    const column = badge.closest<HTMLElement>('[data-slot="match-when"]')!.getBoundingClientRect()
    await expect(column.right - box.right).toBeGreaterThanOrEqual(24)
  }
}

/** Nazwy drużyn i podpisy pustych slotów bez wielokropka, uciętych wydłużeń i łamania słów. */
export function nameProblems(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLElement>('[data-slot="match-team"]')].flatMap(textFitProblems)
}

/** Strona nie przewija się w bok. */
export async function expectNoSideScroll() {
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
}
