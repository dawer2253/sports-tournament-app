import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, waitFor } from 'storybook/test'
import { TournamentLogo } from './tournament-logo'

// Małe SVG w adresie `data:`, żeby story z logo nie zależało od sieci.
const LOGO_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><rect width="40" height="20" rx="4" fill="#b45309"/></svg>',
  )

const meta = {
  title: 'UI/Logo turnieju',
  component: TournamentLogo,
  parameters: { layout: 'padded' },
  args: { logoUrl: null, color: '#1F7A45', onError: fn(), className: 'size-16' },
} satisfies Meta<typeof TournamentLogo>

export default meta
type Story = StoryObj<typeof meta>

/** Bez wgranego logo: domyślne logo, czyli puchar na kolorze turnieju. */
export const Domyslne: Story = {
  play: async ({ canvasElement, args }) => {
    await expect(canvasElement.querySelector('img')).toBeNull()
    const fallback = canvasElement.querySelector('[data-slot="tournament-logo-default"]')
    await expect(fallback).not.toBeNull()
    await expect(fallback).toHaveStyle({ backgroundColor: 'rgb(31, 122, 69)' })
    // Brak logo to nie błąd ładowania.
    await expect(args.onError).not.toHaveBeenCalled()
  },
}

/** Domyślne logo idzie za kolorem z formularza. */
export const DomyslneInnyKolor: Story = {
  args: { color: '#1D4E89' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-slot="tournament-logo-default"]')).toHaveStyle({
      backgroundColor: 'rgb(29, 78, 137)',
    })
  },
}

/** Logo w stałym pudełku z `object-contain`, jak herb drużyny. */
export const ZLogo: Story = {
  args: { logoUrl: LOGO_URL },
  play: async ({ canvasElement }) => {
    const img = canvasElement.querySelector('img')
    await expect(img).toHaveAttribute('src', LOGO_URL)
    await expect(img).toHaveClass('object-contain')
    await expect(canvasElement.querySelector('[data-slot="tournament-logo-default"]')).toBeNull()
  },
}

/** Adres, który się nie ładuje: domyślne logo i sygnał dla ekranu. */
export const NieLadujeSie: Story = {
  args: { logoUrl: '/nie-ma-takiego-logo.png' },
  play: async ({ canvasElement, args }) => {
    await waitFor(() => expect(canvasElement.querySelector('img')).toBeNull())
    await expect(canvasElement.querySelector('[data-slot="tournament-logo-default"]')).not.toBeNull()
    await expect(args.onError).toHaveBeenCalledTimes(1)
  },
}
