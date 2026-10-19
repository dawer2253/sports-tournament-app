import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'
import { publicTournament } from '../lib/demo-data'
import { cssHex } from '../test/theme'
import { desktop1280, phone390, tablet768 } from '../test/viewport'
import { publicTabs, type PublicNavKey } from './public-nav'
import { Shell } from './shell'

const navHref = (key: PublicNavKey) => `/t/${publicTournament.slug}${key === 'home' ? '' : `/${key}`}`

const meta = {
  title: 'Strona publiczna/Komponenty/Shell',
  component: Shell,
  parameters: { layout: 'fullscreen' },
  args: {
    tournament: publicTournament,
    tabs: publicTabs([{ type: 'league' }]),
    active: 'standings',
    navHref,
    onNavigate: fn(),
    children: <p className="text-muted-foreground">Treść zakładki.</p>,
  },
} satisfies Meta<typeof Shell>

export default meta
type Story = StoryObj<typeof meta>

const tabsNav = (canvas: HTMLElement) => within(within(canvas).getByRole('navigation', { name: 'Sekcje turnieju' }))

/**
 * Liga na komputerze: kolejność zakładek, aktywna z `aria-current` i adresem,
 * klik woła `onNavigate` z kluczem, stopka z adresem turnieju, nazwa turnieju
 * jako jedyny `h1`.
 */
export const Liga: Story = {
  ...desktop1280,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const links = tabsNav(canvasElement).getAllByRole('link')
    await expect(links.map((link) => link.textContent)).toEqual(['Przegląd', 'Tabela', 'Terminarz', 'Wyniki', 'Statystyki'])

    const active = tabsNav(canvasElement).getByRole('link', { current: 'page' })
    await expect(active).toHaveTextContent('Tabela')
    await expect(active).toHaveAttribute('href', '/t/liga-osiedlowa/standings')
    await expect(links.filter((link) => link.hasAttribute('aria-current'))).toHaveLength(1)

    await userEvent.click(tabsNav(canvasElement).getByRole('link', { name: 'Statystyki' }))
    await expect(args.onNavigate).toHaveBeenCalledWith('stats')

    await expect(canvas.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(publicTournament.name)
    await expect(canvas.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()

    const footer = within(canvas.getByRole('contentinfo'))
    await expect(footer.getByText('Prowadzone w TournamentApp')).toBeInTheDocument()
    await expect(footer.getByText('/t/liga-osiedlowa')).toBeInTheDocument()
  },
}

/** Puchar: Drabinka w miejscu Tabeli (#234). */
export const Puchar: Story = {
  ...desktop1280,
  args: { tabs: publicTabs([{ type: 'knockout' }]), active: 'bracket' },
  play: async ({ canvasElement }) => {
    const links = tabsNav(canvasElement).getAllByRole('link')
    await expect(links.map((link) => link.textContent)).toEqual(['Przegląd', 'Drabinka', 'Terminarz', 'Wyniki', 'Statystyki'])
  },
}

/** Grupy: Tabela grup i Drabinka playoffu obok siebie (#268). */
export const Grupy: Story = {
  ...desktop1280,
  args: { tabs: publicTabs([{ type: 'group' }, { type: 'knockout' }]), active: 'home' },
  play: async ({ canvasElement }) => {
    const links = tabsNav(canvasElement).getAllByRole('link')
    await expect(links.map((link) => link.textContent)).toEqual(['Przegląd', 'Tabela', 'Drabinka', 'Terminarz', 'Wyniki', 'Statystyki'])
  },
}

/** Strona meczu i 404: żadna zakładka nie jest podświetlona. */
export const BezAktywnejZakladki: Story = {
  name: 'Bez aktywnej zakładki',
  ...desktop1280,
  args: { active: undefined },
  play: async ({ canvasElement }) => {
    for (const link of tabsNav(canvasElement).getAllByRole('link')) await expect(link).not.toHaveAttribute('aria-current')
  },
}

/**
 * Telefon 390 px: zakładki pod przyciskiem „Menu”. Lista powstaje po
 * otwarciu, Escape i wybór zakładki ją zamykają, a strona nie przewija się
 * w bok.
 */
export const Telefon: Story = {
  ...phone390,
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const menu = canvas.getByRole('button', { name: 'Menu' })
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByRole('navigation', { name: 'Sekcje turnieju' })).not.toBeInTheDocument()
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)

    await userEvent.click(menu)
    await expect(menu).toHaveAttribute('aria-expanded', 'true')
    const list = canvas.getByRole('navigation', { name: 'Sekcje turnieju' })
    await expect(menu).toHaveAttribute('aria-controls', list.id)
    await expect(within(list).getAllByRole('link').map((link) => link.textContent)).toEqual(['Przegląd', 'Tabela', 'Terminarz', 'Wyniki', 'Statystyki'])
    await expect(within(list).getByRole('link', { current: 'page' })).toHaveTextContent('Tabela')
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)

    await userEvent.keyboard('{Escape}')
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByRole('navigation', { name: 'Sekcje turnieju' })).not.toBeInTheDocument()

    await userEvent.click(menu)
    await userEvent.click(within(canvas.getByRole('navigation', { name: 'Sekcje turnieju' })).getByRole('link', { name: 'Wyniki' }))
    await expect(args.onNavigate).toHaveBeenCalledWith('results')
    await expect(menu).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByRole('navigation', { name: 'Sekcje turnieju' })).not.toBeInTheDocument()
  },
}

/** Od 768 px (`md`) zakładki stoją w pasku, bez przycisku „Menu”. */
export const Tablet: Story = {
  ...tablet768,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()
    const nav = canvas.getByRole('navigation', { name: 'Sekcje turnieju' })
    await expect(nav).toBeVisible()
    for (const link of within(nav).getAllByRole('link')) await expect(link).toBeVisible()
  },
}

const brandVar = (canvas: HTMLElement, name: string) =>
  getComputedStyle(canvas.querySelector<HTMLElement>('[data-slot="public-site"]')!).getPropertyValue(name).trim().toLowerCase()

const logoDefault = (canvas: HTMLElement) => {
  const logo = getComputedStyle(canvas.querySelector<HTMLElement>('[data-slot="tournament-logo-default"]')!)
  return { border: cssHex(logo.borderTopColor), fill: cssHex(logo.backgroundColor), width: logo.borderTopWidth }
}

/**
 * Przełącznik „Kolor turnieju” na granacie: rozjaśniona linia i tekst na
 * korzeniu shella, a logo domyślne dostaje widoczny obrys w `--brand-line`.
 */
export const Granat: Story = {
  ...desktop1280,
  globals: { brandColor: 'granat' },
  play: async ({ canvasElement }) => {
    await expect(brandVar(canvasElement, '--brand-line')).toBe('#4769be')
    await expect(brandVar(canvasElement, '--brand-text')).toBe('#6085dc')
    const logo = logoDefault(canvasElement)
    await expect(logo.width).toBe('1px')
    await expect(logo.border).toBe('#4769be')
    await expect(logo.border).not.toBe(logo.fill)
  },
}

/** Na domyślnej zieleni linia ma już 3:1, więc obrys zlewa się z wypełnieniem. */
export const Zielen: Story = {
  name: 'Zieleń',
  ...desktop1280,
  globals: { brandColor: 'zielen' },
  play: async ({ canvasElement }) => {
    const logo = logoDefault(canvasElement)
    await expect(logo.border).toBe(logo.fill)
  },
}

/** Strona publiczna jest zawsze ciemna, także przy „Motywie” jasnym (portale, #136). */
export const ZawszeCiemna: Story = {
  name: 'Zawsze ciemna',
  ...desktop1280,
  globals: { theme: 'light' },
  play: async () => {
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'))
  },
}
