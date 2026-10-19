import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { MIN_TEXT_CONTRAST, contrastRatio } from '../lib/contrast'
import { cssHex } from '../test/theme'
import { BackTo, Button, TextLink } from './button'
import { SectionHead } from './heads'
import { ownBrand } from '../test/brand'
import { EachSample } from './story-samples'

const meta = {
  title: 'Strona publiczna/Komponenty/Przycisk i odnośnik',
  component: Button,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

/** Przycisk: cel dotyku ≥ 44 px, `focus-visible` w `--brand-line`, klik woła `onClick`. */
export const Przycisk: Story = {
  args: { children: 'Spróbuj ponownie', onClick: fn() },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Spróbuj ponownie' })
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    // `focusVisible` wymusza `:focus-visible` jak przy klawiaturze; zdarzenia
    // `userEvent` są syntetyczne i przeglądarka nie zawsze go włącza.
    button.focus({ focusVisible: true } as FocusOptions)
    await expect(button.matches(':focus-visible')).toBe(true)
    const probe = document.createElement('span')
    probe.className = 'text-brand-line'
    button.append(probe)
    const line = cssHex(getComputedStyle(probe).color)
    probe.remove()
    // `transition-colors` przechodzi też po kolorze obrysu: czekamy na koniec.
    await waitFor(() => expect(cssHex(getComputedStyle(button).outlineColor)).toBe(line))
    await userEvent.click(button)
    await expect(args.onClick).toHaveBeenCalled()
  },
}

/** Z `href` przycisk jest odnośnikiem, a `onNavigate` przejmuje klik (router). */
export const PrzyciskOdnosnik: Story = {
  name: 'Przycisk jako odnośnik',
  args: { href: '/t/liga-osiedlowa/terminarz', onNavigate: fn(), children: 'Terminarz' },
  play: async ({ canvasElement, args }) => {
    const link = within(canvasElement).getByRole('link', { name: 'Terminarz' })
    await expect(link).toHaveAttribute('href', '/t/liga-osiedlowa/terminarz')
    await userEvent.click(link)
    await expect((args as { onNavigate: () => void }).onNavigate).toHaveBeenCalled()
  },
}

/**
 * Odnośnik w treści i belka sekcji w `--brand-text`: z kartą ≥ 4,5:1 dla
 * każdej z czterech próbek koloru turnieju.
 */
export const OdnosnikIBelka: Story = {
  name: 'Odnośnik i belka sekcji',
  parameters: ownBrand,
  render: () => (
    <EachSample>
      {(sample) => (
        <div className="flex flex-col gap-4">
          <SectionHead title="Najbliższe mecze" link={{ label: 'Pełny terminarz', href: '#' }} />
          <p>
            {sample.label}: <TextLink href="#">Wróć do terminarza</TextLink>
          </p>
          <BackTo href="#">Wyniki</BackTo>
        </div>
      )}
    </EachSample>
  ),
  play: async ({ canvasElement }) => {
    const links = [...canvasElement.querySelectorAll<HTMLElement>('[data-slot="text-link"]')]
    await expect(links).toHaveLength(8)
    for (const link of links) {
      const card = cssHex(getComputedStyle(link.closest<HTMLElement>('[data-sample]')!).backgroundColor)
      const ratio = contrastRatio(cssHex(getComputedStyle(link).color), card)
      const sample = link.closest<HTMLElement>('[data-sample]')!.dataset.sample
      await expect({ sample, text: link.textContent, ok: ratio >= MIN_TEXT_CONTRAST }).toEqual(expect.objectContaining({ ok: true }))
    }
  },
}
