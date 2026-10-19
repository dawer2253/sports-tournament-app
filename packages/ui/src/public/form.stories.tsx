import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { MIN_TEXT_CONTRAST, contrastRatio } from '../lib/contrast'
import { cssHex } from '../test/theme'
import { Form } from './form'
import { ownBrand } from '../test/brand'
import { EachSample } from './story-samples'

const meta = {
  title: 'Strona publiczna/Komponenty/Forma',
  component: Form,
  parameters: { layout: 'padded' },
  args: { results: ['win', 'win', 'draw', 'loss', 'win'] },
} satisfies Meta<typeof Form>

export default meta
type Story = StoryObj<typeof meta>

/** Czytnik ekranu dostaje pełne słowa, a litery są ukryte przed nim. */
export const Domyslna: Story = {
  name: 'Domyślna',
  play: async ({ canvasElement }) => {
    const form = canvasElement.querySelector<HTMLElement>('[data-slot="form"]')!
    await expect(within(form).getByText('Forma: zwycięstwo, zwycięstwo, remis, porażka, zwycięstwo')).toHaveClass('sr-only')
    for (const letter of form.querySelectorAll('[data-result]')) await expect(letter).toHaveAttribute('aria-hidden', 'true')
    await expect(form).not.toHaveAttribute('aria-label')
  },
}

/** „W” na `--brand-line` z tekstem `--brand-line-foreground`: kontrast ≥ 4,5:1 dla każdej próbki. */
export const Probki: Story = {
  name: 'Próbki koloru turnieju',
  parameters: ownBrand,
  render: (args) => <EachSample>{() => <Form {...args} />}</EachSample>,
  play: async ({ canvasElement }) => {
    const wins = [...canvasElement.querySelectorAll<HTMLElement>('[data-result="win"]')]
    await expect(wins.length).toBe(12)
    for (const win of wins) {
      const style = getComputedStyle(win)
      const ratio = contrastRatio(cssHex(style.color), cssHex(style.backgroundColor))
      const sample = win.closest<HTMLElement>('[data-sample]')!.dataset.sample
      await expect({ sample, ok: ratio >= MIN_TEXT_CONTRAST }).toEqual({ sample, ok: true })
    }
  },
}
