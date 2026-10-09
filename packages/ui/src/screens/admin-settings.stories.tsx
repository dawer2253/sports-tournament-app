import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { tournament } from '../lib/demo-data'
import { AdminSettings } from './admin-settings'

// Logo w adresie `data:`: treść obrazu, jak plik organizera, a nie chroma UI.
const LOGO_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#b45309"/><path d="M12 20h16" stroke="#fff" stroke-width="4"/></svg>',
  )

const meta = {
  title: 'Ekrany/Admin · Ustawienia',
  component: AdminSettings,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminSettings>

export default meta
type Story = StoryObj<typeof meta>

const SLUG_WARNING = /przestanie działać\. Przekierowania nie będzie\./

function statusCard(canvasElement: HTMLElement) {
  return within(canvasElement.querySelector<HTMLElement>('[data-slot="tournament-status-card"]')!)
}

/** Opublikowany turniej bez logo. */
export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Sekcję pokazuje aktywna karta (#104), a nie tytuł ekranu.
    const tabs = canvas.getByRole('navigation', { name: 'Sekcje turnieju' })
    await expect(within(tabs).getByText('Ustawienia').closest('a')).toHaveAttribute('aria-current', 'page')

    const status = statusCard(canvasElement)
    await expect(status.getByRole('button', { name: 'Zakończ' })).toBeInTheDocument()
    await expect(status.getByRole('link', { name: /Otwórz stronę/ })).toBeInTheDocument()

    // Bez logo: domyślne logo i tylko „Wgraj logo".
    await expect(canvas.getByRole('button', { name: 'Wgraj logo' })).toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Usuń logo' })).not.toBeInTheDocument()

    await expect(canvas.getByLabelText('Nazwa')).toHaveValue(tournament.name)
    await expect(canvas.getByRole('radio', { name: 'Murawa' })).toBeChecked()
    await expect(canvas.getByLabelText('Remis')).toHaveValue(1)
    await expect(canvas.getByRole('button', { name: 'Przywróć domyślne dla sportu' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('listitem').map((li) => li.textContent)).toContain('1Punkty w tabeli')
    await expect(canvas.queryByText(SLUG_WARNING)).not.toBeInTheDocument()

    // Trzy miejsca zapisu: status od razu, logo w oknie, reszta tym przyciskiem.
    await expect(canvas.getAllByRole('button', { name: 'Zapisz zmiany' })).toHaveLength(1)
    await expect(canvas.getByRole('button', { name: 'Usuń turniej' })).toBeInTheDocument()
  },
}

/** Szkic: tylko „Opublikuj", a zmiana adresu nie ostrzega, bo strony i tak nie ma. */
export const Szkic: Story = {
  args: { status: 'draft' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const status = statusCard(canvasElement)
    await expect(status.getAllByRole('button').map((b) => b.textContent)).toEqual(['Opublikuj'])
    await expect(status.queryByRole('link')).not.toBeInTheDocument()

    await userEvent.type(canvas.getByLabelText('Adres strony'), '-2026')
    await expect(canvas.queryByText(SLUG_WARNING)).not.toBeInTheDocument()
  },
}

/** Zmieniony slug w turnieju opublikowanym: alert pod polem adresu. */
export const ZmienionySlug: Story = {
  args: { slug: `${tournament.slug}-2026` },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(
      canvas.getByText(`Dotychczasowy adres /t/${tournament.slug} przestanie działać. Przekierowania nie będzie.`),
    ).toBeInTheDocument()

    // Powrót do zapisanego adresu zdejmuje ostrzeżenie.
    const input = canvas.getByLabelText('Adres strony')
    await userEvent.clear(input)
    await userEvent.type(input, tournament.slug)
    await expect(canvas.queryByText(SLUG_WARNING)).not.toBeInTheDocument()
  },
}

/** Wgrane logo: „Zmień logo" i „Usuń logo". */
export const ZLogo: Story = {
  args: { logoUrl: LOGO_URL },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvasElement.querySelector('[data-slot="tournament-logo"] img')).toHaveAttribute('src', LOGO_URL)
    await expect(canvas.getByRole('button', { name: 'Zmień logo' })).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Usuń logo' })).toBeInTheDocument()
  },
}

/** Plik logo jest, ale się nie ładuje: domyślne logo i komunikat. */
export const LogoNieLadujeSie: Story = {
  args: { logoUrl: '/nie-ma-takiego-logo.png' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await waitFor(() => expect(canvas.getByText('Nie udało się wczytać logo')).toBeInTheDocument())
    await expect(canvasElement.querySelector('[data-slot="tournament-logo"] img')).toBeNull()
    // Logo w API dalej jest, więc można je zmienić albo usunąć.
    await expect(canvas.getByRole('button', { name: 'Usuń logo' })).toBeInTheDocument()
  },
}

/** Kolor spoza palet ze słabym kontrastem: tryb zaawansowany i ostrzeżenie. */
export const SlabyKontrast: Story = {
  args: { primaryColor: '#F2C94C' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Kolor (hex)')).toHaveValue('#F2C94C')
    await expect(canvas.getByText(/może być nieczytelny/)).toBeInTheDocument()
    // Domyślne logo idzie za kolorem z formularza.
    await expect(canvasElement.querySelector('[data-slot="tournament-logo-default"]')).toHaveStyle({
      backgroundColor: 'rgb(242, 201, 76)',
    })
  },
}

/** Koszykówka nie zna remisów, więc nie ma pola „Remis". */
export const Koszykowka: Story = {
  args: { sport: 'basketball' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByLabelText('Wygrana')).toHaveValue(2)
    await expect(canvas.queryByLabelText('Remis')).not.toBeInTheDocument()
    await expect(canvas.getByLabelText('Porażka')).toHaveValue(1)
    await expect(canvas.getByText('Różnica punktów')).toBeInTheDocument()
  },
}
