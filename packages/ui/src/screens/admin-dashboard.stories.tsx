import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { tournamentList } from '../lib/demo-data'
import { AdminDashboard } from './admin-dashboard'

const meta = {
  title: 'Ekrany/Admin/Dashboard',
  component: AdminDashboard,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminDashboard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Ten sam ekran co pod `/` w panelu: nagłówek z „Nowy turniej" i tabela
 * turniejów. Asercje idą po wierszach tabeli, nie po kaflach — lista, a nie
 * dashboard z licznikami, jest tym, co wdrożone.
 */
export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Twoje turnieje' })).toBeInTheDocument()

    // Wiersze liczymy w tabeli: w sidebarze stoją bieżące turnieje demo, więc
    // nazwa turnieju nie jest unikalna na całym ekranie.
    const table = canvas.getByRole('table')
    await expect(within(table).getAllByRole('row')).toHaveLength(tournamentList.length + 1)
    for (const tournament of tournamentList) {
      await expect(within(table).getByText(tournament.name)).toBeInTheDocument()
    }

    // Licznik pokazuje się też wtedy, gdy lista nie jest ucięta.
    await expect(canvas.getByText(`Pokazano ${tournamentList.length} z ${tournamentList.length} turniejów.`))
      .toBeInTheDocument()

    // Przy niepustej liście wyjście do kreatora stoi w nagłówku (#28).
    await expect(canvas.getByRole('button', { name: 'Nowy turniej' })).toBeInTheDocument()
  },
}

/** Pusta lista: stan pusty tabeli niesie własny przycisk, nagłówek go nie dubluje. */
export const Pusty: Story = {
  args: { state: 'pusty' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Nie masz jeszcze turniejów')).toBeInTheDocument()
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
    await expect(canvas.getAllByRole('button', { name: 'Nowy turniej' })).toHaveLength(1)
  },
}

/** Trasa czeka na odpowiedź listy: tabela pokazuje szkielet, licznik milczy. */
export const Wczytuje: Story = {
  args: { state: 'wczytuje' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('status')).toHaveAccessibleName('Wczytywanie turniejów')
    await expect(canvas.queryByText(/^Pokazano/)).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Nowy turniej' })).not.toBeInTheDocument()
  },
}

/** Lista padła: komunikat z ponowieniem, bez wyjścia do kreatora. */
export const Blad: Story = {
  args: { state: 'blad' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Nie udało się wczytać turniejów')).toBeInTheDocument()
    await expect(canvas.getByText('Nie udało się pobrać turniejów.')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Spróbuj ponownie' })).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Nowy turniej' })).not.toBeInTheDocument()
  },
}
