import { expect, waitFor, within } from 'storybook/test'

/** Tablice pasa etapu w kolejności z DOM-u. */
export function stageBoards(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-slot="stage-board"]')]
}

/** Stan nad parą tablicy meczu o stanie `status` („Koniec”, „Na żywo”, godzina). */
export function boardStateText(root: HTMLElement, status: 'scheduled' | 'live' | 'finished'): string | undefined {
  const board = stageBoards(root).find((element) => element.dataset.status === status)
  return board?.firstElementChild?.firstElementChild?.textContent ?? undefined
}

/** Fakty nagłówka pasa etapu, bez wiodących spacji. */
export function stageFacts(root: HTMLElement): (string | undefined)[] {
  return [...root.querySelectorAll('[data-slot="stage-band"] [data-slot="fact"]')].map((element) => element.textContent?.trim())
}

/** Strona nie przewija się w bok: `scrollWidth` korzenia nie większe niż `clientWidth`. */
export async function expectRootWithoutSideScroll() {
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
}

/** Na telefonie tablice pasa stoją jedna pod drugą. */
export async function expectBoardsStacked(root: HTMLElement) {
  const [first, second] = stageBoards(root)
  await expect(second!.getBoundingClientRect().top).toBeGreaterThan(first!.getBoundingClientRect().bottom - 1)
}

/** Szkielet stoi przy pierwszym wczytaniu i znika po danych. */
export async function expectSkeletonThenData(root: HTMLElement, dataHeading: string) {
  const canvas = within(root)
  await expect(canvas.getByRole('status', { name: 'Wczytywanie przeglądu' })).toBeInTheDocument()
  await waitFor(() => expect(canvas.queryByRole('status', { name: 'Wczytywanie przeglądu' })).not.toBeInTheDocument(), { timeout: 3000 })
  await expect(canvas.getByRole('heading', { level: 2, name: dataHeading })).toBeInTheDocument()
}
