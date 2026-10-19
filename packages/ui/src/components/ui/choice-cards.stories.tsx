import type { Meta, StoryObj } from '@storybook/react-vite'
import { createRef, useState } from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'
import { ChoiceCards, type ChoiceCardsProps, type ChoiceOption } from './choice-cards'

type Format = 'league' | 'knockout'

const FORMATS: ChoiceOption<Format>[] = [
  {
    value: 'league',
    label: 'Liga każdy z każdym',
    description: 'Wszystkie drużyny grają ze sobą, o kolejności decyduje tabela punktowa.',
  },
  {
    value: 'knockout',
    label: 'Puchar (drabinka)',
    description: 'Przegrany odpada, wygrany awansuje do kolejnej rundy.',
  },
]

const meta = {
  title: 'Panel/UI/Prymitywy/Wybór kafelkowy',
  component: ChoiceCards,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-2xl">{Story()}</div>],
  args: { legend: 'Format rozgrywek', name: 'format', options: FORMATS, value: undefined, onChange: fn() },
  // Wybór trzymamy w stanie, jak w formularzu: kliknięcie zaznacza kafelek,
  // a nie tylko woła `onChange`.
  render: function Render(args: ChoiceCardsProps<string | number>) {
    const [value, setValue] = useState<string | number | null | undefined>(args.value)
    return (
      <ChoiceCards
        {...args}
        value={value}
        onChange={(next) => {
          setValue(next)
          args.onChange(next)
        }}
      />
    )
  },
} satisfies Meta<typeof ChoiceCards>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Nazwę opcji czyta sam tytuł kafelka, a opis zostaje opisem — czytnik ekranu
 * nie zlewa go z nazwą. Zaznaczenie idzie strzałkami i klikiem, jak w radiu.
 */
export const Domyslny: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('group', { name: 'Format rozgrywek' })).toBeInTheDocument()
    // Nazwa radia to sam tytuł, bez zdania opisu.
    const knockout = canvas.getByRole('radio', { name: 'Puchar (drabinka)' })
    await expect(knockout).not.toBeChecked()

    await userEvent.click(knockout)

    await expect(knockout).toBeChecked()
    await expect(args.onChange).toHaveBeenCalledWith('knockout')
  },
}

/** Zaznaczony kafelek dostaje obwódkę i znacznik; pole startuje z wartością z formularza. */
export const Zaznaczony: Story = {
  args: { value: 'league' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('radio', { name: 'Liga każdy z każdym' })).toBeChecked()
    await expect(canvas.getByRole('radio', { name: 'Puchar (drabinka)' })).not.toBeChecked()
  },
}

/**
 * Błąd idzie do opisu każdego radia razem z `aria-invalid`, tak jak w polu
 * tekstowym obok — `fieldset` czytniki ogłaszają niekonsekwentnie.
 */
export const ZBledem: Story = {
  args: { errorMessage: 'Wybierz format rozgrywek.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const league = canvas.getByRole('radio', { name: 'Liga każdy z każdym' })
    const error = canvas.getByText('Wybierz format rozgrywek.')
    await expect(league).toHaveAttribute('aria-invalid', 'true')
    // Błąd wisi w opisie radia razem z opisem opcji, a nie zamiast niego.
    await expect(league.getAttribute('aria-describedby')).toContain(error.id)
  },
}

/**
 * Na ekranie zakładania turnieju zaznaczone pole z błędem zdarza się tylko po
 * `422` z API, a wtedy react-hook-form fokusu nie przenosi. Ref musi więc
 * trafić w zaznaczone radio — inaczej `shouldFocusError` nie ma czego sfokusować.
 */
const selectedRef = createRef<HTMLInputElement>()

export const RefNaZaznaczonym: Story = {
  args: { value: 'knockout', ref: selectedRef },
  play: async ({ canvasElement }) => {
    await expect(selectedRef.current).toBe(within(canvasElement).getByRole('radio', { name: 'Puchar (drabinka)' }))
  },
}

/** Bez zaznaczenia ref trafia w pierwsze radio, żeby fokus miał gdzie osiąść. */
const emptyRef = createRef<HTMLInputElement>()

export const RefBezZaznaczenia: Story = {
  args: { ref: emptyRef },
  play: async ({ canvasElement }) => {
    await expect(emptyRef.current).toBe(
      within(canvasElement).getByRole('radio', { name: 'Liga każdy z każdym' }),
    )
  },
}
