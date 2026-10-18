import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { AdminLogin } from './admin-login'

const meta = {
  title: 'Ekrany/Admin/Logowanie',
  component: AdminLogin,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminLogin>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Ten sam ekran co pod `/login` w panelu: jedna karta z polami e-mail i hasło.
 * Asercje idą po etykietach pól, bo to one są kontraktem formularza — układ
 * karty może się zmienić, nazwa pola nie.
 */
export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // `CardTitle` to `div`, nie nagłówek — tak samo w panelu, więc asercja
    // idzie po tekście, nie po roli.
    await expect(canvas.getByText('Logowanie')).toBeInTheDocument()
    await expect(canvas.getByLabelText('E-mail')).toBeInTheDocument()
    await expect(canvas.getByLabelText('Hasło')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Zaloguj' })).toBeInTheDocument()

    // Rejestracji konta panel nie ma — makieta też jej nie pokazuje.
    await expect(canvas.queryByText(/Zarejestruj|Utwórz konto|Nie masz konta/)).not.toBeInTheDocument()
  },
}
