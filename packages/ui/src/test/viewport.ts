import { expect } from 'storybook/test'

/**
 * Telefon o szerokości 375 px, z DoD #196, #234 i #239. Storybook nie ma
 * takiego widoku wśród domyślnych (`mobile1` to 320, `mobile2` 414).
 */
export const phone375 = {
  parameters: {
    viewport: {
      options: {
        phone375: { name: 'Telefon 375', styles: { width: '375px', height: '812px' }, type: 'mobile' },
      },
    },
  },
  globals: { viewport: { value: 'phone375', isRotated: false } },
} as const

/**
 * Słowa tekstu, które przeglądarka złamała w środku (`overflow-wrap`), bo
 * nie mieściły się w linii: zakres takiego słowa ma prostokąt w każdej linii.
 */
function brokenWords(element: HTMLElement): string[] {
  const broken: string[] = []
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent ?? ''
    for (const word of text.matchAll(/\S+/g)) {
      const range = document.createRange()
      range.setStart(node, word.index)
      range.setEnd(node, word.index + word[0].length)
      const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)))
      if (lines.size > 1) broken.push(word[0])
    }
  }
  return broken
}

/**
 * Co nie mieści się w pudełku tekstu: wielokropek (`truncate`,
 * `line-clamp`) i ucięte dolne wydłużenia liter („y”, „ę”, „j”) to treść
 * większa niż pudełko z `overflow: hidden`, a słowo złamane w środku to
 * nazwa, która miała za mało miejsca na linię (#218, #239). Bez `expect`,
 * żeby pętle po szerokościach nie zapychały panelu Interactions.
 */
export function textFitProblems(element: HTMLElement): string[] {
  const text = element.textContent ?? ''
  const problems: string[] = []
  if (element.scrollWidth > element.clientWidth) problems.push(`„${text}” wystaje w bok (${element.scrollWidth} > ${element.clientWidth})`)
  if (element.scrollHeight > element.clientHeight) problems.push(`„${text}” wystaje w dół (${element.scrollHeight} > ${element.clientHeight})`)
  for (const word of brokenWords(element)) problems.push(`„${text}” łamie słowo „${word}” (${element.clientWidth} px)`)
  return problems
}

/** Każdy tekst mieści się w swoim pudełku; błąd wymienia wszystkie, które nie. */
export async function expectTextFits(elements: readonly HTMLElement[]) {
  await expect(elements.length).toBeGreaterThan(0)
  await expect(elements.flatMap(textFitProblems)).toEqual([])
}
