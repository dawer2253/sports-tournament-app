import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { BRAND_FOREGROUND_DARK } from '../../lib/contrast'
import { publicTournament } from '../../lib/demo-data'
import { PublicShell, type PublicNavKey } from './public-shell'

// Małe SVG w adresie `data:`, żeby story z logo nie zależało od sieci.
const LOGO_URL =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#b45309"/></svg>',
  )

/** Adresy zakładek, tak jak podaje je `apps/public`. */
const navHref = (key: PublicNavKey) =>
  ({ home: '/t/liga-osiedlowa', standings: '/t/liga-osiedlowa/tabela', fixtures: '/t/liga-osiedlowa/terminarz', results: '/t/liga-osiedlowa/wyniki' })[key]

const meta = {
  title: 'UI/Shell strony publicznej',
  component: PublicShell,
  parameters: { layout: 'fullscreen' },
  args: {
    tournament: publicTournament,
    active: 'home',
    // Adresy zawsze, żeby zakładki były odnośnikami; kliknięcie przejmuje
    // tylko story `Nawigacja`, więc pozostałe w zakładki nie klikają.
    navHref,
    children: <p className="text-sm text-muted-foreground">Miejsce na treść ekranu.</p>,
  },
} satisfies Meta<typeof PublicShell>

export default meta
type Story = StoryObj<typeof meta>

/** `rgb(...)`, w jakim przeglądarka oddaje kolor `#RRGGBB` w `getComputedStyle`. */
function rgb(hex: string) {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

function heading(canvasElement: HTMLElement) {
  return within(canvasElement).getByRole('heading', { level: 1 })
}

/**
 * Piłka: zdjęcie boiska pod nakładką koloru turnieju, logo domyślne (puchar
 * na kolorze), meta ze sportem i zakładki w kolejności z #192. Ciemna zieleń
 * ma kontrast z białym, więc tekst nagłówka jest biały.
 */
export const Domyslny: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const tabs = within(canvas.getByRole('navigation', { name: 'Sekcje turnieju' }))
    await expect(tabs.getAllByRole('link').map((tab) => tab.textContent)).toEqual([
      'Przegląd',
      'Tabela',
      'Terminarz',
      'Wyniki',
    ])

    await expect(getComputedStyle(heading(canvasElement)).color).toBe(rgb('#FFFFFF'))
    await expect(canvasElement.querySelector('header')).toHaveAttribute('data-hero', 'photo')
    await expect(canvasElement.querySelector('[data-slot="tournament-logo-default"]')).toHaveStyle({
      backgroundColor: rgb('#1F7A45'),
    })
    await expect(canvas.getByText('Piłka nożna')).toBeInTheDocument()
    await expect(canvas.queryByText('Zakończony')).not.toBeInTheDocument()
    await expect(canvas.getByText('/t/liga-osiedlowa')).toBeInTheDocument()
  },
}

/** Jasny kolor turnieju: biały nie ma kontrastu 4.5, więc tekst nagłówka jest ciemny. */
export const JasnyKolor: Story = {
  args: { tournament: { ...publicTournament, branding: { logoUrl: null, primaryColor: '#FFD400' } } },
  play: async ({ canvasElement }) => {
    await expect(getComputedStyle(heading(canvasElement)).color).toBe(rgb(BRAND_FOREGROUND_DARK))
  },
}

/** Koszykówka: własne zdjęcie boiska do kosza, to samo w obu motywach. */
export const Koszykowka: Story = {
  args: { tournament: { ...publicTournament, sport: { code: 'basketball', name: 'Koszykówka' } } },
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector('header')!
    await expect(header).toHaveAttribute('data-hero', 'photo')
    const sources = [...header.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    await expect(sources).toHaveLength(2)
    for (const src of sources) await expect(src).toMatch(/hero-basketball/)
  },
}

/** Sport bez własnego zdjęcia: płaski kolor turnieju zamiast boiska. */
export const InnySport: Story = {
  args: {
    tournament: { ...publicTournament, sport: { code: 'volleyball', name: 'Siatkówka' }, branding: { logoUrl: null, primaryColor: '#1D4E89' } },
  },
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector('header')!
    await expect(header).toHaveAttribute('data-hero', 'color')
    await expect(header.querySelectorAll('img')).toHaveLength(0)
    await expect(header).toHaveStyle({ backgroundColor: rgb('#1D4E89') })
  },
}

/** Wgrane logo zamiast domyślnego pucharu. */
export const ZLogo: Story = {
  args: { tournament: { ...publicTournament, branding: { logoUrl: LOGO_URL, primaryColor: '#1F7A45' } } },
  play: async ({ canvasElement }) => {
    const logo = canvasElement.querySelector('[data-slot="tournament-logo"]')!
    await expect(logo.querySelector('img')).toHaveAttribute('src', LOGO_URL)
    await expect(logo.querySelector('[data-slot="tournament-logo-default"]')).toBeNull()
  },
}

/** Turniej zakończony: meta mówi o tym obok sportu. */
export const Zakonczony: Story = {
  args: { tournament: { ...publicTournament, status: 'finished' } },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('Zakończony')).toBeInTheDocument()
  },
}

/**
 * Zakładki z adresami i przejętym kliknięciem, jak w aplikacji: klik zgłasza
 * klucz przez `onNavigate`, a aktywna zakładka ma `aria-current`.
 */
export const Nawigacja: Story = {
  args: { active: 'standings', onNavigate: fn() },
  play: async ({ canvasElement, args }) => {
    const tabs = within(within(canvasElement).getByRole('navigation', { name: 'Sekcje turnieju' }))
    await expect(tabs.getByRole('link', { name: 'Tabela' })).toHaveAttribute('aria-current', 'page')
    await expect(tabs.getByRole('link', { name: 'Terminarz' })).toHaveAttribute('href', '/t/liga-osiedlowa/terminarz')

    await userEvent.click(tabs.getByRole('link', { name: 'Terminarz' }))
    await expect(args.onNavigate).toHaveBeenCalledWith('fixtures')
  },
}

/** Strona bez aktywnej zakładki (np. strona meczu, #205). */
export const BezAktywnejZakladki: Story = {
  args: { active: undefined },
  play: async ({ canvasElement }) => {
    const tabs = within(within(canvasElement).getByRole('navigation', { name: 'Sekcje turnieju' }))
    for (const tab of tabs.getAllByRole('link')) {
      await expect(tab).not.toHaveAttribute('aria-current')
    }
  },
}
