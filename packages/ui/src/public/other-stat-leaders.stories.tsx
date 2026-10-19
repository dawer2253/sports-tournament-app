import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { leaderboardsBySport, statOptionsBySport } from '../lib/demo-data'
import { OtherStatLeaders, type StatBoard } from './stats'

const football = leaderboardsBySport.football
const ready = (code: string): StatBoard => ({ status: 'ready', leaderboard: football[code]! })

const meta = {
  title: 'Strona publiczna/Komponenty/Statystyki/Liderzy pozostałych statystyk',
  component: OtherStatLeaders,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-[19rem]">{Story()}</div>],
  args: {
    stats: statOptionsBySport.football,
    value: 'goals',
    boards: { goals: ready('goals'), yellowCards: ready('yellowCards'), redCards: ready('redCards') },
    // Adres jak zakładka: pierwsza statystyka bez `?stat=`.
    statHref: (code: string) => (code === 'goals' ? '/t/liga/statystyki' : `/t/liga/statystyki?stat=${code}`),
    onValueChange: fn(),
  },
} satisfies Meta<typeof OtherStatLeaders>

export default meta
type Story = StoryObj<typeof meta>

const rowsOf = (section: HTMLElement) => within(section).queryAllByRole('listitem')

/**
 * Piłka z wybranymi Bramkami: dwie sekcje, bez bieżącej, po najwyżej trzy
 * wiersze (Żółte kartki mają cztery). „Cała klasyfikacja” prowadzi na adres
 * swojej statystyki i zgłasza jej kod.
 */
export const Pelni: Story = {
  name: 'Pełni',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const sections = within(canvas.getByRole('complementary', { name: 'Pozostałe statystyki' })).getAllByRole('region')
    await expect(sections.map((section) => within(section).getByRole('heading').textContent)).toEqual([
      'Żółte kartki',
      'Czerwone kartki',
    ])
    const yellow = canvas.getByRole('region', { name: 'Żółte kartki' })
    await expect(rowsOf(yellow).map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^1.*Bartosz Mazur.*3$/),
      expect.stringMatching(/^2.*Szymon Lewandowski.*2$/),
      expect.stringMatching(/^2.*Tomasz Mazur.*2$/),
    ])
    await expect(rowsOf(canvas.getByRole('region', { name: 'Czerwone kartki' }))).toHaveLength(1)

    const link = within(yellow).getByRole('link', { name: 'Cała klasyfikacja' })
    await expect(link).toHaveAttribute('href', '/t/liga/statystyki?stat=yellowCards')
    await userEvent.click(link)
    await expect(args.onValueChange).toHaveBeenLastCalledWith('yellowCards')
  },
}

/** Z wybranymi Czerwonymi kartkami „Cała klasyfikacja” Bramek prowadzi pod adres bez parametru. */
export const PierwszaStatystyka: Story = {
  name: 'Pierwsza statystyka',
  args: { value: 'redCards' },
  play: async ({ args, canvasElement }) => {
    const goals = within(canvasElement).getByRole('region', { name: 'Bramki' })
    await expect(within(canvasElement).queryByRole('region', { name: 'Czerwone kartki' })).not.toBeInTheDocument()
    const link = within(goals).getByRole('link', { name: 'Cała klasyfikacja' })
    await expect(link).toHaveAttribute('href', '/t/liga/statystyki')
    await userEvent.click(link)
    await expect(args.onValueChange).toHaveBeenLastCalledWith('goals')
  },
}

/** Pusta klasyfikacja (nikt jeszcze nie ma czerwonej kartki): „Jeszcze nikt.” */
export const Pusta: Story = {
  args: {
    boards: {
      yellowCards: ready('yellowCards'),
      redCards: { status: 'ready', leaderboard: { ...football.redCards!, rows: [] } },
    },
  },
  play: async ({ canvasElement }) => {
    const red = within(canvasElement).getByRole('region', { name: 'Czerwone kartki' })
    await expect(within(red).getByText('Jeszcze nikt.')).toBeInTheDocument()
    await expect(rowsOf(red)).toHaveLength(0)
  },
}

/** Sekcja w trakcie wczytywania: szkielet z `role="status"`, sąsiednia już z wierszami. */
export const Wczytywanie: Story = {
  args: { boards: { yellowCards: ready('yellowCards'), redCards: { status: 'loading' } } },
  play: async ({ canvasElement }) => {
    const red = within(canvasElement).getByRole('region', { name: 'Czerwone kartki' })
    await expect(within(red).getByRole('status', { name: 'Wczytywanie: Czerwone kartki' })).toBeInTheDocument()
    await expect(rowsOf(within(canvasElement).getByRole('region', { name: 'Żółte kartki' }))).toHaveLength(3)
  },
}

const onRetry = fn()

/** Błąd sekcji: „Spróbuj ponownie” woła ponowienie, sąsiednia sekcja stoi dalej. */
export const Blad: Story = {
  name: 'Błąd',
  args: {
    boards: {
      yellowCards: ready('yellowCards'),
      redCards: { status: 'error', message: 'Usługa chwilowo niedostępna.', onRetry },
    },
  },
  play: async ({ canvasElement }) => {
    const red = within(canvasElement).getByRole('region', { name: 'Czerwone kartki' })
    await expect(within(red).getByRole('alert')).toHaveTextContent('Usługa chwilowo niedostępna.')
    await userEvent.click(within(red).getByRole('button', { name: 'Spróbuj ponownie' }))
    await expect(onRetry).toHaveBeenCalledOnce()
    await expect(rowsOf(within(canvasElement).getByRole('region', { name: 'Żółte kartki' }))).toHaveLength(3)
  },
}
