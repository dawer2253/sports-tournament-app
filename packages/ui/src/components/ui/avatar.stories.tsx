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
    // `rounded-full` liczy się do ogromnej wartości. Granicą jest połowa boku
    // domyślnego rozmiaru (`size-8`, 32 px): od niej kafelek jest kołem.
    const radius = await expectOneRadius(canvasElement)
    await expect(parseFloat(radius)).toBeGreaterThanOrEqual(16)
  },
}

/** Kafelek z inicjałami w shellu panelu. */
export const Kwadratowy: Story = {
  args: { shape: 'square' },
  play: async ({ canvasElement }) => {
    const radius = await expectOneRadius(canvasElement)
    // Poniżej połowy boku, czyli rogi zaokrąglone, ale nie koło.
    await expect(parseFloat(radius)).toBeLessThan(16)
  },
}
