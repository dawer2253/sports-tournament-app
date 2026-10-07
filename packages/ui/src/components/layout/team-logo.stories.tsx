import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, waitFor, within } from 'storybook/test'
import { teamAbbr } from './team-crest'
import { TeamLogo } from './team-logo'

// Małe SVG w adresie `data:`, żeby story z logo nie zależało od sieci.
const LOGO_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><rect width="40" height="20" rx="4" fill="#1d4ed8"/></svg>',
  )

const meta = {
  title: 'UI/Herb drużyny',
  component: TeamLogo,
  parameters: { layout: 'padded' },
  args: { name: 'Wilki Bemowo', logoUrl: null, className: 'size-10' },
} satisfies Meta<typeof TeamLogo>

export default meta
type Story = StoryObj<typeof meta>

/** Bez wgranego logo: herb zastępczy ze skrótem z `teamAbbr`. */
export const BezLogo: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('img')).toBeNull()
    await expect(canvasElement.querySelector('svg text')).toHaveTextContent('WB')
  },
}

/** Logo w stałym pudełku: szerokie logo nie rozpycha wiersza (`object-contain`). */
export const ZLogo: Story = {
  args: { logoUrl: LOGO_URL },
  play: async ({ canvasElement }) => {
    const img = canvasElement.querySelector('img')
    await expect(img).not.toBeNull()
    // Dekoracja: nazwa drużyny zawsze stoi obok.
    await expect(img).toHaveAttribute('alt', '')
    await expect(canvasElement.querySelector('svg')).toBeNull()
  },
}

/** Adres, który się nie ładuje (pod mockiem kontraktu: zawsze), daje herb zastępczy. */
export const NieLadujeSie: Story = {
  args: { logoUrl: '/nie-ma-takiego-pliku.png' },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector('img')).toBeNull())
    await expect(canvasElement.querySelector('svg text')).toHaveTextContent('WB')
  },
}

const ABBREVIATIONS: [name: string, abbr: string][] = [
  ['Wilki Bemowo', 'WB'],
  ['Legia', 'LEG'],
  ['KS Orzeł Warszawa Praga', 'KOW'],
  ['  Wilki   Bemowo ', 'WB'],
  ['Żbik', 'ŻBI'],
]

/** Skrót herbu zastępczego wyliczany z nazwy (#89 pkt 9). */
export const Skroty: Story = {
  render: () => (
    <ul className="space-y-2">
      {ABBREVIATIONS.map(([name]) => (
        <li key={name} className="flex items-center gap-3 text-sm">
          <TeamLogo name={name} logoUrl={null} className="size-8" />
          <span className="whitespace-pre">„{name}"</span>
        </li>
      ))}
    </ul>
  ),
  play: async ({ canvasElement }) => {
    for (const [name, abbr] of ABBREVIATIONS) {
      await expect(teamAbbr(name)).toBe(abbr)
    }
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('listitem')).toHaveLength(ABBREVIATIONS.length)
  },
}
