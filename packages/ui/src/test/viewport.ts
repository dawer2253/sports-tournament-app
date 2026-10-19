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

/** Telefon o szerokości 390 px: zasada „bez przewijania w bok” z #209 i DoD #290. */
export const phone390 = {
  parameters: {
    viewport: {
      options: {
        phone390: { name: 'Telefon 390', styles: { width: '390px', height: '844px' }, type: 'mobile' },
      },
    },
  },
  globals: { viewport: { value: 'phone390', isRotated: false } },
} as const

/** Tablet o szerokości 768 px: dokładnie próg `md`, od którego zakładki stoją w pasku (#290). */
export const tablet768 = {
  parameters: {
    viewport: {
      options: {
        tablet768: { name: 'Tablet 768', styles: { width: '768px', height: '1024px' }, type: 'tablet' },
      },
    },
  },
  globals: { viewport: { value: 'tablet768', isRotated: false } },
} as const

/** Komputer o szerokości 1280 px, powyżej progu `lg` (#239, #243). */
export const desktop1280 = {
  parameters: {
    viewport: {
      options: {
        desktop1280: { name: 'Komputer 1280', styles: { width: '1280px', height: '800px' }, type: 'desktop' },
      },
    },
  },
  globals: { viewport: { value: 'desktop1280', isRotated: false } },
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
