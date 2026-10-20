import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { publicTournament, scheduleTimeZone } from '../lib/demo-data'
import { desktop1280, phone375 } from '../test/viewport'
import { publicTabs } from './public-nav'
import { RegistrationBanner, RegistrationTile } from './registration'
import { Shell } from './shell'

const DEADLINE = '2026-11-15T17:00:00+00:00'
const FORM_HREF = '/t/liga-letnia-2026/zgloszenie'

const meta = {
  title: 'Strona publiczna/Komponenty/Zapisy',
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/** Pasek pod nagłówkiem turnieju: stoi nad treścią każdej zakładki. */
export const Pasek: Story = {
  render: () => (
    <Shell
      tournament={publicTournament}
      tabs={publicTabs([{ type: 'league' }])}
      active="standings"
      banner={<RegistrationBanner deadline={DEADLINE} timeZone={scheduleTimeZone} href={FORM_HREF} />}
    >
      <p className="text-muted-foreground">Treść zakładki.</p>
    </Shell>
  ),
  play: async ({ canvasElement }) => {
    const banner = within(canvasElement).getByRole('complementary', { name: 'Zapisy' })
    await expect(banner).toHaveTextContent('Zapisy otwarte do niedz., 15 lis, 18:00')
    await expect(within(banner).getByRole('link', { name: 'Zgłoś drużynę' })).toHaveAttribute('href', FORM_HREF)
  },
}

/** Zapisy bez terminu: sam napis „Zapisy otwarte”. */
export const PasekBezTerminu: Story = {
  name: 'Pasek bez terminu',
  render: () => (
    <Shell tournament={publicTournament} tabs={publicTabs([{ type: 'league' }])} banner={<RegistrationBanner deadline={null} href={FORM_HREF} />}>
      <p className="text-muted-foreground">Treść zakładki.</p>
    </Shell>
  ),
  play: async ({ canvasElement }) => {
    const banner = within(canvasElement).getByRole('complementary', { name: 'Zapisy' })
    await expect(banner.querySelector('p')?.textContent).toBe('Zapisy otwarte')
  },
}

/** Kafel na Przeglądzie, nad treścią ekranu. */
export const Kafel: Story = {
  parameters: { layout: 'padded' },
  render: () => <RegistrationTile deadline={DEADLINE} timeZone={scheduleTimeZone} href={FORM_HREF} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Zapisy otwarte do niedz., 15 lis, 18:00' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Zgłoś drużynę' })).toHaveAttribute('href', FORM_HREF)
  },
}

/** Telefon: pasek łamie przycisk pod napis, strona nie przewija się w bok. */
export const PasekTelefon: Story = {
  name: 'Pasek, telefon',
  parameters: phone375.parameters,
  globals: phone375.globals,
  render: Pasek.render,
  play: async ({ canvasElement }) => {
    await expect(canvasElement.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(375)
  },
}
