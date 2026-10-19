import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { publicLeagueSeason } from '../lib/demo-data'
import { phone375 } from '../test/viewport'
import { TeamsShowcase } from './teams-showcase'

const meta = {
  title: 'Strona publiczna/Komponenty/Prezentacja drużyn',
  component: TeamsShowcase,
  parameters: { layout: 'padded' },
  args: { teams: publicLeagueSeason.teams },
} satisfies Meta<typeof TeamsShowcase>

export default meta
type Story = StoryObj<typeof meta>

const names = (canvasElement: HTMLElement) =>
  [...canvasElement.querySelectorAll('[data-slot="showcase-team-name"]')].map((element) => element.textContent)

/**
 * Kafle alfabetycznie po polsku, bez względu na kolejność z API: „Ł” stoi
 * po „L”, a nie za „Z”, jak przy porównaniu kodów znaków.
 */
export const PolskieLitery: Story = {
  name: 'Polskie litery',
  args: {
    teams: ['Orły', 'Łosie', 'Żubry', 'Lwy', 'Zorza'].map((name, index) => ({ id: index + 1, name, logoUrl: null })),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(names(canvasElement)).toEqual(['Lwy', 'Łosie', 'Orły', 'Zorza', 'Żubry'])
    await expect(canvasElement.querySelector('[data-slot="fact"]')?.textContent?.trim()).toBe('5 drużyn')
    await expect(canvas.getByText('Terminarz pojawi się tutaj, gdy organizator go ułoży.')).toBeInTheDocument()
  },
}

/** Długa nazwa na telefonie łamie się w kaflu, strona nie przewija się w bok. */
export const DlugaNazwa: Story = {
  name: 'Długa nazwa, telefon',
  parameters: phone375.parameters,
  globals: phone375.globals,
  args: {
    teams: [
      { id: 1, name: 'Uczniowski Klub Sportowy Niedźwiedzie Mokotów', logoUrl: null },
      ...publicLeagueSeason.teams,
    ],
  },
  play: async () => {
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(document.documentElement.clientWidth)
  },
}
