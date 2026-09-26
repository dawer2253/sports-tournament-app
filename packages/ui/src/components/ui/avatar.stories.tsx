import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'
import { Avatar, AvatarFallback } from './avatar'

const meta = {
  title: 'UI/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  args: { shape: 'circle' },
  render: (args) => (
    <Avatar {...args}>
      <AvatarFallback>KS</AvatarFallback>
    </Avatar>
  ),
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

// Połowa boku domyślnego rozmiaru (`size-8`, 32 px). Od tego promienia kafelek
// jest kołem, poniżej ma tylko zaokrąglone rogi.
const HALF_OF_DEFAULT_SIZE = 16

/**
 * Korzeń, obwódka (`::after`) i fallback muszą mieć jeden promień. Inaczej na
 * kwadratowym kafelku widać okrągłą obwódkę (#59).
 */
async function expectOneRadius(canvasElement: HTMLElement) {
  const root = canvasElement.querySelector<HTMLElement>('[data-slot="avatar"]')!
  const fallback = root.querySelector<HTMLElement>('[data-slot="avatar-fallback"]')!
  const radius = getComputedStyle(root).borderTopLeftRadius

  await expect(getComputedStyle(root, '::after').borderTopLeftRadius).toBe(radius)
  await expect(getComputedStyle(fallback).borderTopLeftRadius).toBe(radius)
  return radius
}

export const Okragly: Story = {
  play: async ({ canvasElement }) => {
    // `rounded-full` liczy się do ogromnej wartości, stąd porównanie z progiem.
    const radius = await expectOneRadius(canvasElement)
    await expect(parseFloat(radius)).toBeGreaterThanOrEqual(HALF_OF_DEFAULT_SIZE)
  },
}

/** Kafelek z inicjałami w shellu panelu. */
export const Kwadratowy: Story = {
  args: { shape: 'square' },
  play: async ({ canvasElement }) => {
    const radius = await expectOneRadius(canvasElement)
    await expect(parseFloat(radius)).toBeLessThan(HALF_OF_DEFAULT_SIZE)
  },
}

/** Promień nadpisany przez `className` też przechodzi na obwódkę i fallback. */
export const PromienZClassName: Story = {
  args: { shape: 'square', className: 'rounded-none' },
  play: async ({ canvasElement }) => {
    const radius = await expectOneRadius(canvasElement)
    await expect(radius).toBe('0px')
  },
}
