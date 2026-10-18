import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { teams } from '../../lib/demo-data'
import { SeedingList, type SeedingListProps } from './seeding-list'
import type { SeedingTeam } from './seeding-team'

const six: SeedingTeam[] = teams.slice(0, 6).map(({ id, name }) => ({ id, name }))

/**
 * Dwie grupy po trzy drużyny, z każdej wychodzą dwie (#260): propozycja
 * z tabel to 1A, 1B, 2A, 2B, a trzecie miejsca czekają na podmianę.
 */
const groupTable: SeedingTeam[] = [
  { ...six[0]!, origin: '1A', groupId: 1 },
  { ...six[1]!, origin: '2A', groupId: 1 },
  { ...six[2]!, origin: '3A', groupId: 1 },
  { ...six[3]!, origin: '1B', groupId: 2 },
  { ...six[4]!, origin: '2B', groupId: 2 },
  { ...six[5]!, origin: '3B', groupId: 2 },
]
const fromGroups: SeedingTeam[] = [groupTable[0]!, groupTable[3]!, groupTable[1]!, groupTable[4]!]

/** Nazwy z wywołania `onChange`, żeby asercja czytała się jak lista na ekranie. */
function names(list: SeedingTeam[]): string[] {
  return list.map((team) => team.name)
}

const meta = {
  title: 'UI/Dane/Rozstawienie',
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
            args.onLockedChange?.(next)
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

/**
 * Rozstawienie z tabel grup (#260): przy pozycji stoi pochodzenie, a remis
 * na linii rozstrzyga podmiana w obrębie grupy — wybór drugiego miejsca
 * grupy A ma tylko drużyny tej grupy spoza listy. Blokady i losowania nie
 * ma, bo zniszczyłyby rozstawienie krzyżowe.
 */
export const ZGrup: Story = {
  args: { value: fromGroups, groupTeams: groupTable },
  render: function Render(args: SeedingListProps) {
    const [value, setValue] = useState(args.value)
    return (
      <div className="max-w-sm">
        <SeedingList
          value={value}
          groupTeams={args.groupTeams}
          onChange={(next) => {
            setValue(next)
            args.onChange(next)
          }}
        />
      </div>
    )
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole('list', { name: 'Rozstawienie (od najwyżej rozstawionej)' })
    await expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '11AFC Górka',
      '21BDragons',
      '32ASparta',
      '42BWilki',
    ])
    await expect(canvas.queryByRole('combobox', { name: 'Zablokowane pozycje' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: /Wylosuj/ })).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole('combobox', { name: 'Drużyna na pozycji 3' }))
    const body = within(canvasElement.ownerDocument.body)
    await expect((await body.findAllByRole('option')).map((option) => option.textContent)).toEqual([
      'Sparta (2A)',
      'Orły (3A)',
    ])
    await userEvent.click(body.getByRole('option', { name: 'Orły (3A)' }))

    await expect(args.onChange.mock.lastCall![0].map((team: SeedingTeam) => team.id)).toEqual([1, 4, 3, 5])
    await expect(within(list).getAllByRole('listitem')[2]).toHaveTextContent('3AOrły')
  },
}
