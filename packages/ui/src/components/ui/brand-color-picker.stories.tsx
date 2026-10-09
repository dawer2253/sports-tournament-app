import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { contrastRatio } from '../../lib/contrast'
import { BRAND_PALETTES, BrandColorPicker, type BrandColorPickerProps } from './brand-color-picker'

/** Pole jest kontrolowane, więc story trzyma wartość w stanie, jak formularz aplikacji. */
function Controlled(props: BrandColorPickerProps) {
  const [value, setValue] = React.useState(props.value)
  return (
    <BrandColorPicker
      {...props}
      value={value}
      onChange={(hex) => {
        setValue(hex)
        props.onChange(hex)
      }}
    />
  )
}

const meta = {
  title: 'UI/Kolor wiodący',
  component: BrandColorPicker,
  parameters: { layout: 'padded' },
  args: { value: '#1F7A45', onChange: fn() },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof BrandColorPicker>

export default meta
type Story = StoryObj<typeof meta>

/** Kolor z palety: zaznaczona paleta, tryb zaawansowany schowany, bez ostrzeżenia. */
export const Paleta: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)

    // Kolor stoi na stronie publicznej pod prawie białym tekstem (#91 pkt 6),
    // więc każda paleta musi mieć z bielą kontrast WCAG AA.
    await expect(BRAND_PALETTES).toHaveLength(6)
    await expect(BRAND_PALETTES[0]).toEqual({ name: 'Murawa', hex: '#1F7A45' })
    for (const palette of BRAND_PALETTES) {
      await expect(contrastRatio(palette.hex, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    }
    await expect(contrastRatio('#FFFFFF', '#000000')).toBe(21)

    const radios = canvas.getAllByRole('radio')
    await expect(radios).toHaveLength(6)
    await expect(canvas.getByRole('radio', { name: 'Murawa' })).toBeChecked()
    await expect(canvas.queryByLabelText('Kolor (hex)')).not.toBeInTheDocument()
    await expect(canvas.queryByText(/może być nieczytelny/)).not.toBeInTheDocument()

    // Klik w paletę oddaje jej hex, a nie nazwę: nazwa palety się nie zapisuje.
    const second = BRAND_PALETTES[1]!
    await userEvent.click(canvas.getByRole('radio', { name: second.name }))
    await expect(args.onChange).toHaveBeenLastCalledWith(second.hex)
    await expect(canvas.getByRole('radio', { name: second.name })).toBeChecked()
  },
}

/** Paletę rozpoznaje się po hexie bez względu na wielkość liter. */
export const PaletaMalymiLiterami: Story = {
  args: { value: '#1f7a45' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('radio', { name: 'Murawa' })).toBeChecked()
    await expect(canvas.queryByLabelText('Kolor (hex)')).not.toBeInTheDocument()
  },
}

/** Hex spoza palet otwiera tryb zaawansowany i nie zaznacza żadnej palety. */
export const SpozaPalet: Story = {
  args: { value: '#123456' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const radio of canvas.getAllByRole('radio')) {
      await expect(radio).not.toBeChecked()
    }
    await expect(canvas.getByLabelText('Kolor (hex)')).toHaveValue('#123456')
    await expect(canvas.getByRole('button', { name: 'Zaawansowane' })).toHaveAttribute('aria-expanded', 'true')
  },
}

/** Słaby kontrast z bielą daje ostrzeżenie, ale niczego nie blokuje. */
export const SlabyKontrast: Story = {
  args: { value: '#F2C94C' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByLabelText('Kolor (hex)')
    await expect(canvas.getByText(/może być nieczytelny/)).toBeInTheDocument()
    await expect(input).toHaveAccessibleDescription(/może być nieczytelny/)
    // Ostrzeżenie to nie błąd.
    await expect(input).not.toHaveAttribute('aria-invalid')

    // Powrót do palety zdejmuje ostrzeżenie.
    await userEvent.click(canvas.getByRole('radio', { name: 'Murawa' }))
    await expect(args.onChange).toHaveBeenLastCalledWith('#1F7A45')
    await expect(canvas.queryByText(/może być nieczytelny/)).not.toBeInTheDocument()
  },
}

/** Pole hex w trybie zaawansowanym oddaje wpisaną wartość. */
export const Zaawansowane: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Zaawansowane' }))
    const input = canvas.getByLabelText('Kolor (hex)')
    await expect(input).toHaveValue('#1F7A45')
    await expect(canvas.getByLabelText('Wybierz kolor')).toHaveAttribute('type', 'color')

    await userEvent.clear(input)
    await userEvent.type(input, '#0A0A0A')
    await expect(args.onChange).toHaveBeenLastCalledWith('#0A0A0A')
    for (const radio of canvas.getAllByRole('radio')) {
      await expect(radio).not.toBeChecked()
    }
  },
}

/** Błąd walidacji przychodzi od aplikacji. */
export const Blad: Story = {
  args: { value: '#12', error: 'Podaj kolor w formacie #RRGGBB.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByLabelText('Kolor (hex)')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAccessibleDescription('Podaj kolor w formacie #RRGGBB.')
    // Niepoprawny hex nie ma kontrastu, więc nie ma też ostrzeżenia.
    await expect(canvas.queryByText(/może być nieczytelny/)).not.toBeInTheDocument()
  },
}
