import type { Meta, StoryObj } from '@storybook/react-vite'
import { AdminLogin, AdminRegister } from './admin-login'

const meta = {
  title: 'Ekrany/Admin · Logowanie',
  component: AdminLogin,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminLogin>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}

export const Rejestracja: Story = {
  render: () => <AdminRegister />,
}
