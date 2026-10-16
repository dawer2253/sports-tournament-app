import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { teams } from '../../lib/demo-data'
import {
  GroupCompositionEditor,
  type GroupCompositionEditorProps,
  type GroupCompositionGroup,
} from './group-composition'

const six = teams.slice(0, 6).map(({ id, name }) => ({ id, name }))

/** Dwa równe szkice po trzy drużyny — punkt wyjścia większości stories. */
const twoGroups: GroupCompositionGroup[] = [
  { name: 'Grupa A', qualifiers: 2, teamIds: six.slice(0, 3).map((team) => team.id) },
  { name: 'Grupa B', qualifiers: 2, teamIds: six.slice(3).map((team) => team.id) },
]

const meta = {
  title: 'UI/Skład grup',
  component: GroupCompositionEditor,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-4xl">{Story()}</div>],
  args: { teams: six, value: twoGroups, onChange: fn(), onSave: fn() },
  // Szkic żyje w stanie, jak w ekranie panelu, więc po kliknięciu widać nowy
  // skład, a nie tylko wołane `onChange`.
  render: function Render(args: GroupCompositionEditorProps) {
    const [value, setValue] = useState(args.value)
    return (
      <GroupCompositionEditor
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next)
          args.onChange(next)
        }}
      />
    )
  },
} satisfies Meta<typeof GroupCompositionEditor>

export default meta
type Story = StoryObj<typeof meta>

/** Dwie grupy po trzy drużyny: kafle, liczniki i pusta pula „Bez grupy". */
export const Domyslny: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Grupa A')).toBeInTheDocument()
    await expect(canvas.getByText('Grupa B')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Nazwa grupy 1')).toHaveValue('Grupa A')
    await expect(canvas.getByLabelText('Nazwa grupy 2')).toHaveValue('Grupa B')
    await expect(canvas.getAllByText('3 drużyny')).toHaveLength(2)
    await expect(canvas.getByText('FC Górka')).toBeInTheDocument()
    await expect(canvas.getByText('Tygrysy')).toBeInTheDocument()
    // Cała szóstka ma grupę, więc pula jest pusta i mówi to wprost.
    await expect(canvas.getByText('Każda drużyna ma grupę.')).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Usuń FC Górka z grupy' }))

    const first = args.onChange.mock.lastCall![0][0]!
    await expect(first.teamIds).toEqual(six.slice(1, 3).map((team) => team.id))
    // Licznik kafelka idzie za szkicem, nie za ostatnim zapisem.
    await expect(canvas.getAllByText('3 drużyny')).toHaveLength(1)
    await expect(canvas.getAllByText('2 drużyny')).toHaveLength(1)
    // Usunięta drużyna wraca do puli od razu, przed zapisem.
    await expect(canvas.getByRole('combobox', { name: 'Przypisz drużynę do grupy' })).toBeInTheDocument()
  },
}

/**
 * Losowanie dostaje stałe źródło (`random` → 0), więc wynik jest znany.
 * „Losuj" przetasowuje całą stawkę do bieżącej liczby grup, zachowując nazwy
 * i liczby wychodzących.
 */
export const Losowanie: Story = {
  args: { random: () => 0 },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Losuj' }))

    const dealt: GroupCompositionGroup[] = args.onChange.mock.lastCall![0]
    await expect(dealt).toHaveLength(2)
    // Każda drużyna turnieju trafia do dokładnie jednej grupy.
    await expect([...new Set(dealt.flatMap((group) => group.teamIds))].sort((a, b) => a - b)).toEqual(
      six.map((team) => team.id),
    )
  },
}

/** Poprawny szkic zapisuje się jednym przyciskiem. */
export const Zapis: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Zapisz skład grup' }))
    await expect(args.onSave).toHaveBeenCalled()
  },
}

/** Grupa bez drużyn łamie regułę „co najmniej dwie na grupę", więc zapis stoi. */
export const PustaGrupa: Story = {
  args: {
    value: [
      { name: 'Grupa A', qualifiers: 1, teamIds: [] },
      { name: 'Grupa B', qualifiers: 2, teamIds: six.slice(3).map((team) => team.id) },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('button', { name: 'Zapisz skład grup' })).toBeDisabled()
  },
}

/** Faza z rozpoczętym meczem zamraża skład: zapisu nie ma, a edytor stoi. */
export const Zamrozony: Story = {
  args: { frozen: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('button', { name: 'Zapisz skład grup' })).toBeDisabled()
    await expect(canvas.getByText('Faza ma mecz rozpoczęty, więc skład grup jest zamrożony.')).toBeInTheDocument()
  },
}

/** Zapis skasuje istniejący terminarz grup — ostrzeżenie mówi to wprost. */
export const SkasujeTerminarz: Story = {
  args: { scheduledMatchesCount: 3 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(
      canvas.getByText('Zapis składu skasuje terminarz grup (3 mecze), także terminy i wyniki.'),
    ).toBeInTheDocument()
  },
}

/** Zapis w toku zatrzymuje cały edytor, nie tylko przycisk. */
export const Saving: Story = {
  args: { saving: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('button', { name: 'Zapisz skład grup' })).toBeDisabled()
  },
}
