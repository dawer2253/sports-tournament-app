import type { Meta, StoryObj } from '@storybook/react-vite'
import { AdminSettingsBranding } from './admin-settings-branding'

const meta = {
  title: 'Ekrany/Admin · Branding i ustawienia',
  component: AdminSettingsBranding,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminSettingsBranding>

export default meta
type Story = StoryObj<typeof meta>

export const Domyslny: Story = {}
