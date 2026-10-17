import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { teams } from '../../lib/demo-data'
import { FirstRoundPreview } from './first-round-preview'

const seeding = (count: number) => teams.slice(0, count).map(({ id, name }) => ({ id, name }))

/** Wiersze podglądu jako tekst, z numerem pozycji na początku. */
function rows(canvasElement: HTMLElement): (string | null)[] {
  const list = within(canvasElement).getByRole('list', { name: 'Podgląd 1. rundy' })
  return within(list).getAllByRole('listitem').map((item) => item.textContent)
}

const meta = {
  title: 'UI/Podgląd 1. rundy',
  component: FirstRoundPreview,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-sm">{Story()}</div>],
  args: { seeding: seeding(6) },
} satisfies Meta<typeof FirstRoundPreview>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Sześć drużyn: drabinka na osiem, więc wolne losy mają seedy 1 i 2, a grają
 * pozycje 2 (4–5) i 4 (3–6), jak w przykładzie z #215.
 */
export const SzescDruzyn: Story = {
  play: async ({ canvasElement }) => {
    await expect(rows(canvasElement)).toEqual([
      '1FC Górka→wolny los → 2. runda',
      '2Dragons–Wilki',
      '3Sparta→wolny los → 2. runda',
      '4Orły–Tygrysy',
    ])
  },
}

/** Pełna drabinka bez wolnych losów: 1–8, 4–5, 2–7, 3–6. */
export const OsiemDruzyn: Story = {
  args: { seeding: seeding(8) },
  play: async ({ canvasElement }) => {
    await expect(rows(canvasElement)).toEqual([
      '1FC Górka–Burza',
      '2Dragons–Wilki',
      '3Sparta–Huragan',
      '4Orły–Tygrysy',
    ])
  },
}

/** Pięć drużyn: trzy wolne losy dla seedów 1–3 i jeden mecz 4–5. */
export const PiecDruzyn: Story = {
  args: { seeding: seeding(5) },
  play: async ({ canvasElement }) => {
    const all = rows(canvasElement)
    await expect(all.filter((row) => row?.includes('wolny los'))).toEqual([
      '1FC Górka→wolny los → 2. runda',
      '3Sparta→wolny los → 2. runda',
      '4Orły→wolny los → 2. runda',
    ])
    await expect(all).toContain('2Dragons–Wilki')
  },
}

/**
 * Z tabel grup (#260): przy nazwie stoi pochodzenie, więc pary 2 × 2 czytają
 * się „1A – 2B” i „1B – 2A”, jak w propozycji z backendu.
 */
export const ZGrup: Story = {
  args: {
    seeding: [
      { ...seeding(1)[0]!, origin: '1A', groupId: 1 },
      { id: 4, name: 'Dragons', origin: '1B', groupId: 2 },
      { id: 2, name: 'Sparta', origin: '2A', groupId: 1 },
      { id: 5, name: 'Wilki', origin: '2B', groupId: 2 },
    ],
  },
  play: async ({ canvasElement }) => {
    await expect(rows(canvasElement)).toEqual(['11A FC Górka–2B Wilki', '21B Dragons–2A Sparta'])
  },
}
