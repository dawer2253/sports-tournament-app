import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  basketballStandingsTableRows,
  groupStandingsQualifiers,
  groupStandingsTableRows,
  standingsScoreLabel,
  standingsTablePreviewRows,
  standingsTableRows,
  volleyballStandingsTableRows,
} from '../../lib/demo-data'
import { withQualifiers } from '../../lib/qualifiers'
import { StandingsTable } from './standings-table'

const meta = {
  title: 'Panel/UI/Dane/Tabela ligi',
  component: StandingsTable,
  parameters: { layout: 'padded' },
  args: {
    rows: standingsTableRows,
    scoreLabel: standingsScoreLabel,
    allowsDraw: true,
  },
} satisfies Meta<typeof StandingsTable>

export default meta
type Story = StoryObj<typeof meta>

/** Nagłówki kolumn w kolejności, tak jak widzi je czytnik ekranu. */
function headers(canvasElement: HTMLElement) {
  return within(canvasElement)
    .getAllByRole('columnheader')
    .map((header) => header.textContent)
}

/**
 * Piłka: kolumna R jest, zdobycze to „Bramki”. Drużyny z równą liczbą punktów
 * tworzą blok: grubsza linia stoi tylko tam, gdzie punkty się zmieniają.
 */
export const Pilka: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(headers(canvasElement)).toEqual(['#', 'Drużyna', 'M', 'W', 'R', 'P', 'Bramki', '+/−', 'Pkt'])
    const rows = canvas.getAllByRole('row').slice(1)
    await expect(rows).toHaveLength(standingsTableRows.length)
    await expect(rows[0]).toHaveTextContent('FC Górka')
    await expect(rows[0]).toHaveTextContent('12:4')
    await expect(rows[0]).toHaveTextContent('+8')

    // Miejsca 2 i 3 mają po 10 punktów: między nimi nie ma granicy bloku,
    // a przed 2. (13 → 10) i przed 4. (10 → 6) jest.
    await expect(rows[1]).toHaveClass('border-t-2')
    await expect(rows[2]).not.toHaveClass('border-t-2')
    await expect(rows[3]).toHaveClass('border-t-2')

    // Liga nie ma linii wyjścia ani remisu na linii.
    for (const row of rows) {
      await expect(row).not.toHaveClass('border-dashed')
      await expect(row).not.toHaveTextContent('wychodzi z grupy')
    }
    await expect(canvas.queryByText('remis na linii')).not.toBeInTheDocument()
  },
}

/**
 * Grupa: wychodzą dwie drużyny. Wychodzący są wyróżnieni, a pod ostatnim
 * z nich stoi przerywana linia. Miejsca 2 i 3 mają po 4 punkty, więc obie
 * drużyny dostają plakietkę „remis na linii”.
 */
export const Grupa: Story = {
  args: { rows: withQualifiers(groupStandingsTableRows, groupStandingsQualifiers) },
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole('row').slice(1)

    await expect(rows[0]).toHaveTextContent('wychodzi z grupy')
    await expect(rows[1]).toHaveTextContent('wychodzi z grupy')
    await expect(rows[2]).not.toHaveTextContent('wychodzi z grupy')
    await expect(rows[0]).toHaveClass('bg-primary/5')
    await expect(rows[1]).toHaveClass('bg-primary/5')
    await expect(rows[2]).not.toHaveClass('bg-primary/5')

    // Linia tylko pod ostatnim wychodzącym; granica bloku punktów (4 → 4 nie,
    // 9 → 4 tak) ustępuje jej pod linią.
    await expect(rows[1]).toHaveClass('border-dashed')
    await expect(rows.filter((row) => row.classList.contains('border-dashed'))).toHaveLength(1)
    await expect(rows[2]).not.toHaveClass('border-t-2')

    await expect(within(rows[1]!).getByText('remis na linii')).toBeInTheDocument()
    await expect(within(rows[2]!).getByText('remis na linii')).toBeInTheDocument()
    await expect(rows[0]).not.toHaveTextContent('remis na linii')
    await expect(rows[3]).not.toHaveTextContent('remis na linii')
  },
}

/** Koszykówka: bez kolumny R, a nagłówek zdobyczy przychodzi z odpowiedzi. */
export const Koszykowka: Story = {
  args: { rows: basketballStandingsTableRows, scoreLabel: 'Punkty', allowsDraw: false },
  play: async ({ canvasElement }) => {
    await expect(headers(canvasElement)).toEqual(['#', 'Drużyna', 'M', 'W', 'P', 'Punkty', '+/−', 'Pkt'])
  },
}

/**
 * Podgląd innej kolejności kryteriów: wiersze, które zmieniły miejsce, są
 * podświetlone, a przy pozycji stoi strzałka i poprzednie miejsce dla czytnika.
 */
export const PodgladZeZmianaMiejsc: Story = {
  args: {
    rows: standingsTablePreviewRows,
    previousPositions: new Map(standingsTableRows.map((row) => [row.team.id, row.position])),
  },
  play: async ({ canvasElement }) => {
    const rows = within(canvasElement).getAllByRole('row').slice(1)

    await expect(rows[0]).not.toHaveClass('bg-accent')
    await expect(rows[1]).toHaveClass('bg-accent')
    await expect(rows[1]).toHaveTextContent('2, wcześniej 3.')
    await expect(rows[2]).toHaveTextContent('3, wcześniej 2.')
    await expect(rows[5]).not.toHaveClass('bg-accent')
    await expect(rows[5]).not.toHaveTextContent('wcześniej')
  },
}

export const Ladowanie: Story = {
  args: { rows: [], status: 'pending' },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole('status')).toHaveAccessibleName('Wczytywanie tabeli')
  },
}

/** Turniej bez drużyn: zamiast pustej tabeli odnośnik do Drużyn. */
export const BezDruzyn: Story = {
  args: { rows: [], emptyAction: <a href="#druzyny">Przejdź do drużyn</a> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('table')).not.toBeInTheDocument()
    await expect(canvas.getByText('Turniej nie ma jeszcze drużyn')).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Przejdź do drużyn' })).toHaveAttribute('href', '#druzyny')
  },
}

export const Blad: Story = {
  args: { rows: [], status: 'error', errorMessage: 'Serwer nie odpowiada.', onRetry: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Nie udało się wczytać tabeli')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Spróbuj ponownie' }))
    await expect(args.onRetry).toHaveBeenCalled()
  },
}

/** Siatkówka (#301): sety jako zdobycze i kolumna punktów w setach z etykietą z odpowiedzi. */
export const Siatkowka: Story = {
  name: 'Siatkówka',
  args: { rows: volleyballStandingsTableRows, scoreLabel: 'Sety', allowsDraw: false, rallyPointsLabel: 'Punkty w setach' },
  play: async ({ canvasElement }) => {
    await expect(headers(canvasElement)).toEqual(['#', 'Drużyna', 'M', 'W', 'P', 'Sety', 'Punkty w setach', '+/−', 'Pkt'])
    await expect(within(canvasElement).getByText('183:162')).toBeInTheDocument()
  },
}
