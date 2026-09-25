import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { tournamentList } from '../lib/demo-data'
import { AdminDashboard } from './admin-dashboard'

const meta = {
  title: 'Ekrany/Admin · Dashboard',
  component: AdminDashboard,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminDashboard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Liczniki i liczby drużyn asertujemy na kotwicach, nie na podciągu:
 * `toHaveTextContent('16 drużyn')` przechodzi także dla „116 drużyn", czyli
 * przepuszcza dokładnie tę pomyłkę, której ma pilnować.
 */
const licznik = (canvas: ReturnType<typeof within>, label: string) =>
  // „Drużyny" to także pozycja w sidebarze, więc szukamy etykiety w kaflu.
  canvas
    .getAllByText(label)
    .find((el: HTMLElement) => el.closest('[data-slot="card"]'))?.nextElementSibling

export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Kafle biorą nazwę, sport i liczbę drużyn z `tournamentList` — te same
    // trzy turnieje co `UI/Tabela turniejów`, bez ręcznego dublowania wartości.
    for (const t of tournamentList) {
      const heading = canvas.getByRole('heading', { level: 3, name: t.name })
      // `data-slot` to własny uchwyt design systemu (`components/ui/card.tsx`),
      // stabilniejszy niż struktura znaczników kafla.
      const tile = heading.closest('[data-slot="card"]')
      await expect(tile).toHaveTextContent(t.sport.name)
      await expect(tile).toHaveTextContent(new RegExp(`\\b${t.teamsCount} drużyn`))
    }

    await expect(canvas.getAllByRole('heading', { level: 3 })).toHaveLength(tournamentList.length)

    // Liczniki liczą się z tej samej listy, więc nie mogą jej zaprzeczyć.
    // Wartości liczone tutaj od nowa: asercja ma być niezależna od ekranu.
    const aktywne = tournamentList.filter((t) => t.status === 'active').length
    const druzyny = tournamentList.reduce((sum, t) => sum + t.teamsCount, 0)

    await expect(licznik(canvas, 'Aktywne turnieje')).toHaveTextContent(new RegExp(`^${aktywne}$`))
    await expect(licznik(canvas, 'Drużyny')).toHaveTextContent(new RegExp(`^${druzyny}$`))
  },
}
