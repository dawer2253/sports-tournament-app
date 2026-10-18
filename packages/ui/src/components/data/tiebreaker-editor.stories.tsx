import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { sportSettings, standingsTablePreviewDraft } from '../../lib/demo-data'
import { TiebreakerEditor, TiebreakerSentence } from './tiebreaker-editor'

/** `availableTiebreakers` piłki z etykietami: domyślne kryteria i `wins`. */
const available = sportSettings.football.availableTiebreakers

const meta = {
  title: 'UI/Dane/Edytor tiebreaków',
  component: TiebreakerEditor,
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div className="max-w-sm">{Story()}</div>],
  args: {
    value: ['points', 'head_to_head', 'score_diff', 'score_for'],
    available,
    dirty: false,
    onChange: fn(),
    onSave: fn(),
    onDiscard: fn(),
  },
} satisfies Meta<typeof TiebreakerEditor>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Zapisana lista: `points` z kłódką, reszta z ↑/↓ i przełącznikiem,
 * nieużywane niżej. Bez zmian stopki z zapisem nie ma.
 */
export const Domyslny: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)

    const used = within(canvas.getByRole('list', { name: 'Używane kryteria' })).getAllByRole('listitem')
    await expect(used.map((item) => item.textContent)).toEqual([
      '1Punkty w tabeli zawsze pierwsze',
      '2Bezpośredni mecz',
      '3Różnica bramek',
      '4Bramki zdobyte',
    ])
    // `points` nie da się ani przesunąć, ani wyłączyć.
    await expect(canvas.queryByRole('button', { name: /„Punkty w tabeli”/ })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('switch', { name: /„Punkty w tabeli”/ })).not.toBeInTheDocument()
    // Skrajne pozycje nie mają dokąd iść.
    await expect(canvas.getByRole('button', { name: 'Przesuń „Bezpośredni mecz” wyżej' })).toBeDisabled()
    await expect(canvas.getByRole('button', { name: 'Przesuń „Bramki zdobyte” niżej' })).toBeDisabled()

    await userEvent.click(canvas.getByRole('button', { name: 'Przesuń „Różnica bramek” wyżej' }))
    await expect(args.onChange).toHaveBeenLastCalledWith(['points', 'score_diff', 'head_to_head', 'score_for'])

    await userEvent.click(canvas.getByRole('button', { name: 'Przesuń „Bezpośredni mecz” niżej' }))
    await expect(args.onChange).toHaveBeenLastCalledWith(['points', 'score_diff', 'head_to_head', 'score_for'])

    // Wyłączone znika z listy, włączone ląduje na końcu.
    await userEvent.click(canvas.getByRole('switch', { name: 'Używaj kryterium „Bezpośredni mecz”' }))
    await expect(args.onChange).toHaveBeenLastCalledWith(['points', 'score_diff', 'score_for'])
    await userEvent.click(canvas.getByRole('switch', { name: 'Używaj kryterium „Zwycięstwa”' }))
    await expect(args.onChange).toHaveBeenLastCalledWith(['points', 'head_to_head', 'score_diff', 'score_for', 'wins'])

    await expect(canvas.getByText('Nieużywane')).toBeInTheDocument()
    await expect(canvas.getByText('Na końcu zawsze nazwa drużyny, alfabetycznie.')).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Zapisz kolejność' })).not.toBeInTheDocument()
  },
}

/** Szkic różny od zapisanej listy: zdanie o podglądzie, „Odrzuć” i „Zapisz”. */
export const Zmieniony: Story = {
  args: {
    value: standingsTablePreviewDraft,
    dirty: true,
    preview: 'Podgląd: 4 drużyny zmieniają miejsce.',
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Podgląd: 4 drużyny zmieniają miejsce.')
    await userEvent.click(canvas.getByRole('button', { name: 'Zapisz kolejność' }))
    await expect(args.onSave).toHaveBeenCalled()
    await userEvent.click(canvas.getByRole('button', { name: 'Odrzuć' }))
    await expect(args.onDiscard).toHaveBeenCalled()
  },
}

/** W trakcie zapisu cały edytor stoi. */
export const Zapisywanie: Story = {
  args: { ...Zmieniony.args, pending: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const button of canvas.getAllByRole('button')) {
      await expect(button).toBeDisabled()
    }
    for (const toggle of canvas.getAllByRole('switch')) {
      await expect(toggle).toBeDisabled()
    }
  },
}

/** Błąd zapisu stoi w stopce, a szkic zostaje do poprawy albo ponowienia. */
export const BladZapisu: Story = {
  args: { ...Zmieniony.args, error: 'Nie udało się zapisać kolejności. Spróbuj ponownie.' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Nie udało się zapisać kolejności. Spróbuj ponownie.')
    await expect(canvas.getByRole('button', { name: 'Zapisz kolejność' })).toBeEnabled()
  },
}

/**
 * Koszykówka: domyślna lista sportu i etykiety mówiące o punktach, a nie
 * o bramkach. W „Nieużywane” jest `score_for` i `wins`.
 */
export const Koszykowka: Story = {
  args: {
    value: sportSettings.basketball.tiebreakers.map((item) => item.code),
    available: sportSettings.basketball.availableTiebreakers,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const used = within(canvas.getByRole('list', { name: 'Używane kryteria' })).getAllByRole('listitem')
    await expect(used.map((item) => item.textContent)).toEqual([
      '1Punkty w tabeli zawsze pierwsze',
      '2Bezpośredni mecz',
      '3Różnica punktów',
    ])
    const unused = within(canvas.getByRole('region', { name: 'Nieużywane' })).getAllByRole('listitem')
    await expect(unused.map((item) => item.textContent)).toEqual(['Zdobyte punkty', 'Zwycięstwa'])
  },
}

/** Zdanie pod tabelą: lista turnieju i ukryte ostatnie kryterium. */
export const ZdaniePodTabela: StoryObj<typeof TiebreakerSentence> = {
  render: () => <TiebreakerSentence items={sportSettings.football.tiebreakers} />,
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent(
      'Kolejność: punkty w tabeli → bezpośredni mecz → różnica bramek → bramki zdobyte → nazwa drużyny (alfabetycznie).',
    )
  },
}
