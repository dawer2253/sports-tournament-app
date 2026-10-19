import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor } from 'storybook/test'
import { cssHex } from '../test/theme'
import { Crest } from './crest'
import { TournamentLogo } from './tournament-logo'

const meta = {
  title: 'Strona publiczna/Komponenty/Herb',
  component: Crest,
  parameters: { layout: 'padded' },
  args: { name: 'Wilki Bemowo', className: 'size-16' },
} satisfies Meta<typeof Crest>

export default meta
type Story = StoryObj<typeof meta>

/** Adres, który się nie ładuje: tak wygląda każdy wgrany plik pod mockiem kontraktu. */
const BROKEN = '/nie-ma-takiego-pliku.png'

/** Kolor CSS-owej zmiennej z korzenia `.public-site` jako `#rrggbb`. */
function brandVar(element: Element, name: string) {
  const probe = document.createElement('span')
  probe.style.color = `var(${name})`
  element.closest('.public-site')!.append(probe)
  const color = cssHex(getComputedStyle(probe).color)
  probe.remove()
  return color
}

const part = (canvas: HTMLElement, slot: string) => canvas.querySelector<SVGElement>(`[data-slot="${slot}"]`)!

/** Herb zastępczy: obrys w `--brand-line`, skrót w `--brand-text`. */
export const Zastepczy: Story = {
  name: 'Zastępczy',
  play: async ({ canvasElement }) => {
    const shield = part(canvasElement, 'crest-shield')
    const abbr = part(canvasElement, 'crest-abbr')
    await expect(abbr).toHaveTextContent('WB')
    await expect(cssHex(getComputedStyle(shield).stroke)).toBe(brandVar(shield, '--brand-line'))
    await expect(cssHex(getComputedStyle(abbr).fill)).toBe(brandVar(abbr, '--brand-text'))
  },
}

/** Na wypełnieniu kolorem turnieju (pas „Mistrz”): obrys i skrót w `--brand-foreground`. */
export const NaWypelnieniu: Story = {
  name: 'Na wypełnieniu',
  args: { onFill: true },
  render: (args) => (
    <div className="pub-brand-fill inline-flex rounded-md p-4">
      <Crest {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const shield = part(canvasElement, 'crest-shield')
    const abbr = part(canvasElement, 'crest-abbr')
    const foreground = brandVar(shield, '--brand-foreground')
    await expect(cssHex(getComputedStyle(shield).stroke)).toBe(foreground)
    await expect(cssHex(getComputedStyle(abbr).fill)).toBe(foreground)
    await expect(foreground).not.toBe(brandVar(shield, '--brand-line'))
  },
}

/** Wgrany plik, który się nie ładuje, oddaje miejsce herbowi zastępczemu, bez pękniętego obrazka. */
export const WgranyNieLaduje: Story = {
  name: 'Wgrany, nie ładuje się',
  args: { logoUrl: BROKEN },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-slot="crest-fallback"]')).toBeInTheDocument())
    await expect(canvasElement.querySelector('img')).not.toBeInTheDocument()
  },
}

/** Logo turnieju: plik, który się nie ładuje, oddaje miejsce logo domyślnemu. */
export const LogoTurnieju: Story = {
  name: 'Logo turnieju, nie ładuje się',
  render: () => <TournamentLogo logoUrl={BROKEN} className="size-16" />,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('[data-slot="tournament-logo-default"]')).toBeInTheDocument())
    await expect(canvasElement.querySelector('img')).not.toBeInTheDocument()
  },
}

/** Logo domyślne: puchar na wypełnieniu kolorem turnieju z obrysem `--brand-line`. */
export const LogoDomyslne: Story = {
  name: 'Logo domyślne',
  render: () => <TournamentLogo logoUrl={null} className="size-16" />,
}
