import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { statOptionsBySport } from '../lib/demo-data'
import { StatTabs, type StatTabsProps } from './stats'

/** Wybór trzymany poza zakładkami, jak w adresie strony publicznej (`?stat=`). */
function Controlled(props: StatTabsProps) {
  const [value, setValue] = useState(props.value)
  return (
    <StatTabs
      {...props}
      value={value}
      onValueChange={(code) => {
        setValue(code)
        props.onValueChange(code)
      }}
    >
      <p>Klasyfikacja: {value}</p>
    </StatTabs>
  )
}

const meta = {
  title: 'Strona publiczna/Komponenty/Statystyki/Zakładki',
  component: StatTabs,
  parameters: { layout: 'padded' },
  render: (args) => <Controlled {...args} />,
  args: {
    stats: statOptionsBySport.football,
    value: 'goals',
    onValueChange: fn(),
    children: null,
  },
} satisfies Meta<typeof StatTabs>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Trzy statystyki piłki. Klik zgłasza kod statystyki, a nie etykietę; panel
 * ma nazwę wybranej zakładki.
 */
export const Pilka: Story = {
  name: 'Piłka',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('tablist', { name: 'Statystyka' })).toBeInTheDocument()
    await expect(canvas.getByRole('tab', { name: 'Bramki' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.click(canvas.getByRole('tab', { name: 'Żółte kartki' }))
    await expect(args.onValueChange).toHaveBeenLastCalledWith('yellowCards')
    await expect(canvas.getByRole('tab', { name: 'Żółte kartki' })).toHaveAttribute('aria-selected', 'true')
    await expect(canvas.getByRole('tabpanel')).toHaveAccessibleName('Żółte kartki')
  },
}

/**
 * Klawiatura jak w ARIA tabs: strzałki i Home/End wybierają statystykę,
 * a w kolejności Tab stoi tylko wybrana zakładka.
 */
export const Klawiatura: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.tab()
    await expect(canvas.getByRole('tab', { name: 'Bramki' })).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    await expect(args.onValueChange).toHaveBeenLastCalledWith('yellowCards')
    await expect(canvas.getByRole('tab', { name: 'Żółte kartki' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{End}')
    await expect(args.onValueChange).toHaveBeenLastCalledWith('redCards')
    await expect(canvas.getByRole('tab', { name: 'Czerwone kartki' })).toHaveAttribute('aria-selected', 'true')

    await userEvent.keyboard('{Home}')
    await expect(args.onValueChange).toHaveBeenLastCalledWith('goals')
    await userEvent.keyboard('{ArrowLeft}')
    await expect(args.onValueChange).toHaveBeenLastCalledWith('redCards')

    // Tab z zakładki idzie od razu do panelu, bez postoju na pozostałych
    // zakładkach, a powrót wraca na wybraną.
    await userEvent.tab()
    await expect(canvas.getByRole('tabpanel')).toHaveFocus()
    await userEvent.tab({ shift: true })
    await expect(canvas.getByRole('tab', { name: 'Czerwone kartki' })).toHaveFocus()
  },
}

/** Dłuższa lista na telefonie przewija się w bok, zamiast łamać zakładki. */
export const DlugaListaNaTelefonie: Story = {
  name: 'Długa lista na telefonie',
  args: {
    stats: [
      ...statOptionsBySport.football,
      { code: 'assists', label: 'Asysty' },
      { code: 'cleanSheets', label: 'Czyste konta' },
    ],
  },
  decorators: [(Story) => <div className="w-[20rem]">{Story()}</div>],
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole('tablist')
    await expect(list.scrollWidth).toBeGreaterThan(list.clientWidth)
    const tops = new Set(within(list).getAllByRole('tab').map((tab) => Math.round(tab.getBoundingClientRect().top)))
    await expect(tops.size).toBe(1)
  },
}
