import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, userEvent, within } from 'storybook/test'
import type { SetDraft, SetFormat } from '../../lib/sets'
import { SetScoresField } from './set-scores-field'

const VOLLEYBALL: SetFormat = { setsToWin: 3, setPoints: 25, decidingSetPoints: 15, minLead: 2 }

function Field({ initial, setErrors }: { initial: SetDraft[]; setErrors?: Record<number, string> }) {
  const [sets, setSets] = useState(initial)
  return <SetScoresField sets={sets} onChange={setSets} format={VOLLEYBALL} homeName="Orlęta Wawer" awayName="Jaskółki Targówek" setErrors={setErrors} />
}

const meta = {
  title: 'Panel/UI/Dane/Wyniki setów',
  component: SetScoresField,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SetScoresField>

export default meta
type Story = StoryObj<typeof meta>

const won = (canvasElement: HTMLElement) => canvasElement.querySelector('[data-slot="sets-won"]')!.textContent

/**
 * Mecz trwający: dwa sety zakończone dają 1 : 1, a niedokończony trzeci
 * (14:12) wyniku nie zmienia. Wpisanie 25:12 kończy trzeci set i wynik
 * rośnie do 2 : 1 bez zapisu, a 25:24 cofa go do seta w toku.
 */
export const Trwajacy: Story = {
  name: 'Mecz trwający',
  args: { sets: [], onChange: () => {}, format: VOLLEYBALL, homeName: '', awayName: '' },
  render: () => (
    <Field
      initial={[
        { home: '25', away: '21' },
        { home: '18', away: '25' },
        { home: '14', away: '12' },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(won(canvasElement)).toBe('1 : 1')
    const third = canvas.getByLabelText('3. set, Orlęta Wawer')
    await userEvent.clear(third)
    await userEvent.type(third, '25')
    await expect(won(canvasElement)).toBe('2 : 1')
    // 25:24 to znowu set w toku: gra na przewagi trwa.
    const thirdAway = canvas.getByLabelText('3. set, Jaskółki Targówek')
    await userEvent.clear(thirdAway)
    await userEvent.type(thirdAway, '24')
    await expect(won(canvasElement)).toBe('1 : 1')
  },
}

/** „Dodaj set” kończy się na piątym, decydującym secie do 15, a „Usuń ostatni set” zdejmuje ostatni. */
export const DoPieciuSetow: Story = {
  name: 'Do pięciu setów',
  args: Trwajacy.args,
  render: () => <Field initial={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const add = canvas.getByRole('button', { name: 'Dodaj set' })
    for (let i = 0; i < 5; i++) await userEvent.click(add)
    await expect(canvas.getAllByRole('listitem')).toHaveLength(5)
    await expect(add).toBeDisabled()
    await expect(canvas.getByText('decydujący, do 15')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Usuń ostatni set' }))
    await expect(canvas.getAllByRole('listitem')).toHaveLength(4)
    await expect(add).toBeEnabled()
  },
}

/** Błąd z `422` pod `sets.{n}` stoi pod rzędem swojego seta i opisuje jego pola. */
export const BladSeta: Story = {
  name: 'Błąd seta',
  args: Trwajacy.args,
  render: () => (
    <Field
      initial={[{ home: '25', away: '24' }]}
      setErrors={{ 0: 'Set nie jest zakończony. Trwać może tylko ostatni set meczu trwającego.' }}
    />
  ),
  play: async ({ canvasElement }) => {
    const input = within(canvasElement).getByLabelText('1. set, Orlęta Wawer')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAccessibleDescription('Set nie jest zakończony. Trwać może tylko ostatni set meczu trwającego.')
  },
}
