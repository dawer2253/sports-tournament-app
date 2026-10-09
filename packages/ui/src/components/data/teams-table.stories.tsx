import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { teamRows } from '../../lib/demo-data'
import { TeamsTable } from './teams-table'

const meta = {
  title: 'UI/Tabela drużyn',
  component: TeamsTable,
  parameters: { layout: 'padded' },
  args: {
    teams: teamRows,
    teamHref: (team) => `/tournaments/1/teams/${team.id}`,
    onOpenTeam: fn(),
  },
} satisfies Meta<typeof TeamsTable>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getAllByRole('row')).toHaveLength(teamRows.length + 1)

    // Nazwa drużyny jest linkiem do składu, z nazwą drużyny jako nazwą dostępną.
    // Nie pierwszy wiersz: błąd, który zawsze oddaje pierwszą drużynę, też by
    // przeszedł.
    const team = teamRows[1]!
    const link = canvas.getByRole('link', { name: team.name })
    await expect(link).toHaveAttribute('href', `/tournaments/1/teams/${team.id}`)

    // Liczba zawodników bez odmiany, w wierszu tej drużyny.
    const row = link.closest('tr')!
    await expect(within(row).getByText(String(team.playersCount), { exact: true })).toBeInTheDocument()

    await userEvent.click(link)
    await expect(args.onOpenTeam).toHaveBeenCalledTimes(1)
    await expect(args.onOpenTeam).toHaveBeenCalledWith(team)
  },
}

/** Bez `onOpenTeam` link działa samym `href`, jak zwykły odnośnik. */
export const BezCallbacku: Story = {
  args: { onOpenTeam: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('link')).toHaveLength(teamRows.length)
  },
}

export const Ladowanie: Story = {
  args: { teams: [], status: 'pending' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveAccessibleName('Wczytywanie drużyn')
  },
}

export const Pusty: Story = {
  args: { teams: [], onCreate: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
    await expect(canvas.getByText('Turniej nie ma jeszcze drużyn')).toBeInTheDocument()
    await expect(canvas.getByText('Dodaj drużyny, a składy uzupełnisz później.')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Dodaj drużynę' }))
    await expect(args.onCreate).toHaveBeenCalled()
  },
}

export const Blad: Story = {
  args: {
    teams: [],
    status: 'error',
    errorMessage: 'Nie udało się pobrać drużyn.',
    onRetry: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByText('Nie udało się wczytać drużyn')).toBeInTheDocument()
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
    await expect(canvas.getByText('Nie udało się pobrać drużyn.')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Spróbuj ponownie' }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}
