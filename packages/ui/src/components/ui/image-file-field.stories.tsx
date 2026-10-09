import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { TeamCrest } from '../layout/team-crest'
import { ImageFileField, type ImageFileFieldProps } from './image-file-field'

// Małe SVG w adresie `data:`, żeby story nie zależało od sieci.
const CURRENT_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#0f766e"/></svg>',
  )

const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

/** Pole jest kontrolowane, więc story trzyma wartość w stanie, jak formularz aplikacji. */
function Controlled(props: ImageFileFieldProps) {
  const [value, setValue] = React.useState(props.value)
  return (
    <ImageFileField
      {...props}
      value={value}
      onChange={(file) => {
        setValue(file)
        props.onChange(file)
      }}
    />
  )
}

const meta = {
  title: 'UI/Pole obrazu',
  component: ImageFileField,
  parameters: { layout: 'padded' },
  args: {
    label: 'Herb',
    hint: 'PNG, JPG lub WebP, do 2 MB.',
    value: null,
    onChange: fn(),
    currentUrl: null,
    fallback: <TeamCrest abbr="WB" className="size-full" />,
  },
  render: (args) => <Controlled {...args} />,
} satisfies Meta<typeof ImageFileField>

export default meta
type Story = StoryObj<typeof meta>

export const Pusty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByLabelText('Herb')

    await expect(input).toHaveAttribute('type', 'file')
    await expect(input).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp')
    await expect(input).toHaveAccessibleDescription('PNG, JPG lub WebP, do 2 MB.')
    await expect(canvasElement.querySelector('img')).toBeNull()
  },
}

/** Obecny obraz w podglądzie, dopóki nie wybrano nowego pliku. */
export const ObecnyObraz: Story = {
  args: { currentUrl: CURRENT_URL },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('img')).toHaveAttribute('src', CURRENT_URL)
  },
}

/** Wybrany plik trafia do `onChange` i do podglądu przez object URL. */
export const WyborPliku: Story = {
  args: { currentUrl: CURRENT_URL },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    // Prawdziwy PNG 1×1: plik, który się nie dekoduje, zniknąłby z podglądu
    // przez `onError`, zanim asercja zdąży go zobaczyć.
    const png = Uint8Array.from(atob(PNG_1X1), (char) => char.charCodeAt(0))
    const file = new File([png], 'herb.png', { type: 'image/png' })

    await userEvent.upload(canvas.getByLabelText('Herb'), file)

    await expect(args.onChange).toHaveBeenCalledWith(file)
    await waitFor(() => expect(canvasElement.querySelector('img')?.getAttribute('src')).toMatch(/^blob:/))
    // Podgląd nadal stoi, gdy obraz zdąży się zdekodować.
    const img = canvasElement.querySelector('img')!
    await waitFor(() => expect(img.complete && img.naturalWidth).toBe(1))
  },
}

/** Błąd stoi pod polem i jest z nim powiązany, więc czytnik ekranu czyta go przy polu. */
export const Blad: Story = {
  args: { error: 'Herb może mieć najwyżej 2 MB.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByLabelText('Herb')

    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveAccessibleDescription(/Herb może mieć najwyżej 2 MB\./)
  },
}
