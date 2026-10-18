import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, screen, userEvent, within } from 'storybook/test'
import { demoRoster, matchInProgress } from '../lib/demo-data'
import { AdminMatchResult } from './admin-match-result'

const meta = {
  title: 'Ekrany/Admin/Wynik meczu',
  component: AdminMatchResult,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminMatchResult>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Mecz w trakcie ze zdarzeniami. Typ przy drużynie, potem numer zawodnika:
 * zdarzenie trafia na oś z minutą z pola, a minuta zostaje na następny wpis.
 */
export const Domyslny: Story = {
  play: async () => {
    // Okno siedzi w portalu, poza `canvasElement`.
    const dialog = within(await screen.findByRole('dialog'))
    const home = matchInProgress.homeTeam!
    const scorer = demoRoster(home.id)[0]
    const timeline = () => within(dialog.getByRole('list', { name: 'Oś meczu' })).getAllByRole('listitem')
    const homeButtons = () => within(dialog.getByRole('group', { name: `Zdarzenia: ${home.name}` }))

    await expect(timeline()).toHaveLength(3)

    await userEvent.click(homeButtons().getByRole('button', { name: 'Bramka' }))
    await userEvent.type(dialog.getByLabelText('Minuta'), '40')
    await userEvent.click(dialog.getByRole('button', { name: `${scorer.number}. ${scorer.name}` }))

    await expect(timeline()).toHaveLength(4)
    await expect(timeline()[2]).toHaveTextContent(`Bramka ${scorer.name}`)
    await expect(timeline()[2]).toHaveTextContent('40′')
    // Dwie bramki gospodarza ze zdarzeń przy wyniku 1:0 — cicha linia, bez blokady.
    await expect(dialog.getByText('Bramki ze zdarzeń: 2:0 · wynik meczu 1:0')).toBeInTheDocument()

    // Minuta zostaje w polu przy następnym zdarzeniu.
    await userEvent.click(homeButtons().getByRole('button', { name: 'Żółta kartka' }))
    await expect(dialog.getByLabelText('Minuta')).toHaveValue('40')
  },
}

/**
 * Mecz zaplanowany z kolizjami: sekcja zdarzeń czeka na „Rozpocznij mecz”,
 * które w panelu od razu zapisuje stan „Trwa” i `0:0`.
 */
export const Zaplanowany: Story = {
  args: { match: 'scheduled' },
  play: async () => {
    const dialog = within(await screen.findByRole('dialog'))

    await expect(dialog.getByText('Zdarzenia wpiszesz, gdy mecz się zacznie.')).toBeInTheDocument()
    await expect(dialog.queryByRole('group', { name: /^Zdarzenia:/ })).not.toBeInTheDocument()

    await userEvent.click(dialog.getByRole('button', { name: 'Rozpocznij mecz' }))

    await expect(dialog.getAllByRole('group', { name: /^Zdarzenia:/ })).toHaveLength(2)
    await expect(dialog.getByRole('radio', { name: 'Trwa' })).toBeChecked()
    await expect(dialog.getByText('Brak zdarzeń.')).toBeInTheDocument()
  },
}
