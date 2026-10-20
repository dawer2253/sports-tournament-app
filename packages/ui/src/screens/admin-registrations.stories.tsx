import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { registrationRows } from '../lib/demo-data'
import { AdminRegistrations } from './admin-registrations'

const meta = {
  title: 'Panel/Ekrany/Admin/Zgłoszenia',
  component: AdminRegistrations,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AdminRegistrations>

export default meta
type Story = StoryObj<typeof meta>

/** Nazwy drużyn w kartach sekcji, w kolejności z DOM-u. */
function teamsIn(section: HTMLElement) {
  return within(section)
    .getAllByRole('article')
    .map((card) => within(card).getByRole('heading', { level: 3 }).textContent)
}

export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Karta „Zgłoszenia” zaraz po „Drużynach”, z liczbą oczekujących.
    const tabs = canvas.getByRole('navigation', { name: 'Sekcje turnieju' })
    const tab = within(tabs).getByText('Zgłoszenia').closest('a')!
    await expect(tab).toHaveAttribute('aria-current', 'page')
    // Bez `navHref` karta nie jest linkiem, więc nazwy nie liczy; liczbę widać, opis czyta czytnik.
    await expect(tab.querySelector('[data-slot="section-badge"]')).toHaveTextContent('2')
    await expect(tab).toHaveTextContent(', 2 oczekujące')

    // Oczekujące od najstarszego, rozpatrzone od najnowszej decyzji.
    await expect(teamsIn(canvas.getByRole('region', { name: 'Oczekujące' }))).toEqual(['Lwy Mokotów', 'Smoki Ochota'])
    await expect(teamsIn(canvas.getByRole('region', { name: 'Rozpatrzone' }))).toEqual(['Żubry Targówek', 'Rysie Wola'])

    const lwy = canvas.getByRole('article', { name: 'Lwy Mokotów' })
    await expect(within(lwy).getByRole('link', { name: 'anna.wisniewska@example.com' })).toHaveAttribute('href', 'mailto:anna.wisniewska@example.com')
    await expect(within(lwy).getByRole('link', { name: '+48 600 100 200' })).toHaveAttribute('href', 'tel:+48600100200')
    await expect(within(within(lwy).getByRole('list', { name: 'Skład: Lwy Mokotów' })).getAllByRole('listitem')).toHaveLength(3)
    await expect(within(lwy).getByRole('button', { name: 'Przyjmij' })).toBeInTheDocument()

    // Odrzucone bez danych osobowych i bez akcji.
    const rysie = canvas.getByRole('article', { name: 'Rysie Wola' })
    await expect(within(rysie).queryByRole('link')).not.toBeInTheDocument()
    await expect(within(rysie).queryByRole('button')).not.toBeInTheDocument()
    await expect(rysie).toHaveTextContent('Odrzucone')
  },
}

/** Uwaga przy „Przyjmij”, gdy turniej ma już skład grup albo terminarz, i błąd przyjęcia przy zgłoszeniu. */
export const UwagaIBladPrzyjecia: Story = {
  name: 'Uwaga i błąd przyjęcia',
  args: {
    note: 'Skład grup jest już ustalony: przyjęta drużyna nie będzie miała grupy, dopóki nie zapiszesz składu od nowa.',
    error: 'W tym turnieju jest już drużyna o tej nazwie.',
  },
  play: async ({ canvasElement }) => {
    const lwy = within(canvasElement).getByRole('article', { name: 'Lwy Mokotów' })
    await expect(within(lwy).getByRole('alert')).toHaveTextContent('W tym turnieju jest już drużyna o tej nazwie.')
    await expect(lwy).toHaveTextContent('Skład grup jest już ustalony')
  },
}

/** Same rozpatrzone: bez plakietki przy karcie i ze zdaniem w miejscu oczekujących. */
export const WszystkieRozpatrzone: Story = {
  name: 'Wszystkie rozpatrzone',
  args: { registrations: registrationRows.filter((registration) => registration.status !== 'pending') },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Wszystkie zgłoszenia są rozpatrzone.')).toBeInTheDocument()
    await expect(canvasElement.querySelector('[data-slot="section-badge"]')).toBeNull()
  },
}

/** Bez zgłoszeń przy zamkniętych zapisach: pusty stan mówi, gdzie je otworzyć. */
export const PustaZapisyZamkniete: Story = {
  name: 'Pusta, zapisy zamknięte',
  args: { registrations: [], open: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Nie ma jeszcze zgłoszeń')).toBeInTheDocument()
    await expect(canvas.getByText(/Otwórz je w ustawieniach turnieju/)).toBeInTheDocument()
  },
}
