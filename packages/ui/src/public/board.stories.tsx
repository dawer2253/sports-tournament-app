import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { DARK_SURFACES } from '../lib/brand-on-dark'
import { contrastRatio } from '../lib/contrast'
import { cssHex } from '../test/theme'
import { EmptyBoard, ErrorBoard } from './board'
import { TextLink } from './button'
import { Loading, SkeletonBlock } from './skeleton'

const meta = {
  title: 'Strona publiczna/Komponenty/Stan pusty',
  component: EmptyBoard,
  parameters: { layout: 'padded' },
  args: {
    title: 'Terminarz jeszcze nie stoi',
    children: 'Mecze pojawią się tutaj, gdy organizator ułoży terminarz.',
  },
} satisfies Meta<typeof EmptyBoard>

export default meta
type Story = StoryObj<typeof meta>

export const Pusty: Story = {}

export const ZAkcja: Story = {
  name: 'Z akcją',
  args: { action: <TextLink href="#">Przejdź do tabeli</TextLink> },
}

/** Błąd: treść błędu i „Spróbuj ponownie”, które woła `onRetry`. */
export const Blad: Story = {
  name: 'Błąd',
  render: () => <ErrorBoard title="Nie udało się wczytać terminarza" message="Usługa chwilowo niedostępna." onRetry={onRetry} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Usługa chwilowo niedostępna.')
    await userEvent.click(canvas.getByRole('button', { name: 'Spróbuj ponownie' }))
    await expect(onRetry).toHaveBeenCalledOnce()
  },
}
const onRetry = fn()

/**
 * Szkielet wczytywania: `role="status"` z etykietą, złożony w kształt ekranu.
 * Bloki odcinają się od tła strony (#306): wnęka `--pub-sunken` miała z nim
 * 1,06:1 i prawie znikała.
 */
export const Wczytywanie: Story = {
  render: () => <Loading label="Wczytywanie terminarza" />,
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status', { name: 'Wczytywanie terminarza' })
    const blocks = [...status.querySelectorAll<HTMLElement>('[data-slot="skeleton-block"]')]
    await expect(blocks.length).toBeGreaterThan(2)
    await expect(contrastRatio(cssHex(getComputedStyle(blocks[0]!).backgroundColor), DARK_SURFACES.background)).toBeGreaterThanOrEqual(1.2)
  },
}

/** Szkielet w kształcie własnego ekranu: każdy ticket ekranu składa swój. */
export const WczytywanieWlasnyKsztalt: Story = {
  name: 'Wczytywanie, własny kształt',
  render: () => (
    <Loading label="Wczytywanie tabeli">
      <SkeletonBlock className="h-16 w-64" />
      <SkeletonBlock className="h-80 w-full" />
    </Loading>
  ),
}
