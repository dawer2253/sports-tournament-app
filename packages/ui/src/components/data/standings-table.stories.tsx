import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import {
  basketballStandingsTableRows,
  standingsScoreLabel,
  standingsTablePreviewRows,
  standingsTableRows,
} from '../../lib/demo-data'
import { StandingsTable } from './standings-table'

const meta = {
  title: 'UI/Tabela ligi',
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
