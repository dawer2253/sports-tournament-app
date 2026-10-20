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
  title: 'Panel/UI/Prymitywy/Kolor wiodący',
  component: BrandColorPicker,
  parameters: { layout: 'padded' },
  args: { value: '#1F7A45', onChange: fn() },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof BrandColorPicker>

export default meta
type Story = StoryObj<typeof meta>

/** Kolor z palety: zaznaczona paleta, pole hex schowane, bez ostrzeżenia. */
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

    // Sześć palet i kafelek „Własny”, który otwiera pole hex.
    const radios = canvas.getAllByRole('radio')
    await expect(radios).toHaveLength(7)
    await expect(canvas.getByRole('radio', { name: 'Własny' })).not.toBeChecked()
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

/** Hex spoza palet zaznacza kafelek „Własny”, otwiera pole hex i nie zaznacza żadnej palety. */
export const SpozaPalet: Story = {
  args: { value: '#123456' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const palette of BRAND_PALETTES) {
      await expect(canvas.getByRole('radio', { name: palette.name })).not.toBeChecked()
    }
    await expect(canvas.getByRole('radio', { name: 'Własny' })).toBeChecked()
    await expect(canvas.getByLabelText('Kolor (hex)')).toHaveValue('#123456')
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

/** Kafelek „Własny” otwiera pole hex z bieżącym kolorem i oddaje wpisaną wartość. */
export const Wlasny: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: 'Własny' }))
    await expect(canvas.getByRole('radio', { name: 'Własny' })).toBeChecked()
    await expect(canvas.getByRole('radio', { name: 'Murawa' })).not.toBeChecked()
    const input = canvas.getByLabelText('Kolor (hex)')
    await expect(input).toHaveValue('#1F7A45')
    // Samo przejście na „Własny” niczego nie zmienia w formularzu.
    await expect(args.onChange).not.toHaveBeenCalled()
    // Ostrzeżenie stoi pod polem hex, więc jego brak sprawdzamy przy otwartym polu.
    await expect(canvas.queryByText(/może być nieczytelny/)).not.toBeInTheDocument()
    await expect(canvas.getByLabelText('Wybierz kolor')).toHaveAttribute('type', 'color')

    await userEvent.clear(input)
    await userEvent.type(input, '#0A0A0A')
    await expect(args.onChange).toHaveBeenLastCalledWith('#0A0A0A')

    // Powrót do palety chowa pole hex.
    await userEvent.click(canvas.getByRole('radio', { name: 'Granat' }))
    await expect(canvas.queryByLabelText('Kolor (hex)')).not.toBeInTheDocument()
    await expect(canvas.getByRole('radio', { name: 'Własny' })).not.toBeChecked()
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

/** Zmiana koloru z zewnątrz na paletę (reset formularza) zdejmuje „Własny”; wpisywanie w polu hex nie. */
export const ResetZZewnatrz: Story = {
  render: (args) => {
    function WithReset() {
      const [value, setValue] = React.useState('#1F7A45')
      return (
        <>
          <BrandColorPicker {...args} value={value} onChange={setValue} />
          <button type="button" onClick={() => setValue('#9B1C31')}>
            Przywróć
          </button>
        </>
      )
    }
    return <WithReset />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('radio', { name: 'Własny' }))
    const input = canvas.getByLabelText('Kolor (hex)')
    await userEvent.clear(input)
    // Wpisany hex równy palecie („Granat”) nie zamyka pola w trakcie pisania.
    await userEvent.type(input, '#1D4E89')
    await expect(canvas.getByLabelText('Kolor (hex)')).toHaveValue('#1D4E89')
    await expect(canvas.getByRole('radio', { name: 'Własny' })).toBeChecked()

    await userEvent.click(canvas.getByRole('button', { name: 'Przywróć' }))
    await expect(canvas.getByRole('radio', { name: 'Bordo' })).toBeChecked()
    await expect(canvas.getByRole('radio', { name: 'Własny' })).not.toBeChecked()
    await expect(canvas.queryByLabelText('Kolor (hex)')).not.toBeInTheDocument()
  },
}
