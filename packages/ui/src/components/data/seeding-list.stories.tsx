import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { teams } from '../../lib/demo-data'
import { SeedingList, type SeedingListProps, type SeedingTeam } from './seeding-list'

const six: SeedingTeam[] = teams.slice(0, 6).map(({ id, name }) => ({ id, name }))

/** Nazwy z wywołania `onChange`, żeby asercja czytała się jak lista na ekranie. */
function names(list: SeedingTeam[]): string[] {
  return list.map((team) => team.name)
}

const meta = {
  title: 'UI/Rozstawienie',
  component: SeedingList,
  parameters: { layout: 'padded' },
  args: { value: six, locked: 0, onChange: fn(), onLockedChange: fn() },
  // Kolejność i blokada żyją w stanie, jak w oknie generowania, więc po
  // kliknięciu widać nową listę.
  render: function Render(args: SeedingListProps) {
    const [value, setValue] = useState(args.value)
    const [locked, setLocked] = useState(args.locked)
    return (
      <div className="max-w-sm">
        <SeedingList
          {...args}
          value={value}
          locked={locked}
          onChange={(next) => {
            setValue(next)
            args.onChange(next)
          }}
          onLockedChange={(next) => {
            setLocked(next)
            args.onLockedChange(next)
          }}
        />
      </div>
    )
  },
} satisfies Meta<typeof SeedingList>

export default meta
type Story = StoryObj<typeof meta>

/** Bez blokady: ↑/↓ przestawiają pozycje, a skrajne nie mają dokąd iść. */
export const Domyslny: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole('list', { name: 'Rozstawienie (od najwyżej rozstawionej)' })
    await expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '1FC Górka',
      '2Sparta',
      '3Orły',
      '4Dragons',
      '5Wilki',
      '6Tygrysy',
    ])
    await expect(canvas.getByRole('button', { name: 'Przesuń „FC Górka” wyżej' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Przesuń „Tygrysy” niżej' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: /Wylosuj wszystko/ })).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Przesuń „Orły” wyżej' }))
    await expect(names(args.onChange.mock.lastCall![0])).toEqual(['FC Górka', 'Orły', 'Sparta', 'Dragons', 'Wilki', 'Tygrysy'])

    await userEvent.click(canvas.getByRole('button', { name: 'Przesuń „FC Górka” niżej' }))
    await expect(names(args.onChange.mock.lastCall![0])).toEqual(['Orły', 'FC Górka', 'Sparta', 'Dragons', 'Wilki', 'Tygrysy'])
  },
}

/**
 * Dwie pierwsze pozycje zablokowane: są wyróżnione, a „Wylosuj resztę”
 * miesza tylko pozostałe. Losowanie dostaje stałe źródło (`random` → 0),
 * więc wynik jest znany: Fisher–Yates z samymi zerami przesuwa pierwszy
 * element reszty na koniec.
 */
export const ZablokowanaGora: Story = {
  args: { locked: 2, random: () => 0 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('combobox', { name: 'Zablokowane pozycje' })).toHaveTextContent('Zablokuj 2 pierwsze')
    await expect(canvas.getAllByText('zablokowana')).toHaveLength(2)

    await userEvent.click(canvas.getByRole('button', { name: /Wylosuj resztę/ }))
    await expect(names(args.onChange.mock.lastCall![0])).toEqual(['FC Górka', 'Sparta', 'Dragons', 'Wilki', 'Tygrysy', 'Orły'])
  },
}

/** Bez blokady „Wylosuj wszystko” miesza całą listę (to samo stałe źródło). */
export const LosowanieBezBlokady: Story = {
  args: { random: () => 0 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: /Wylosuj wszystko/ }))
    await expect(names(args.onChange.mock.lastCall![0])).toEqual(['Sparta', 'Orły', 'Dragons', 'Wilki', 'Tygrysy', 'FC Górka'])
  },
}

/** W trakcie zapisu lista stoi. */
export const Zapisywanie: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const button of canvas.getAllByRole('button')) {
      await expect(button).toBeDisabled()
    }
  },
}
