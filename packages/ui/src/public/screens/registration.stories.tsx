import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { publicTournament, scheduleTimeZone } from '../../lib/demo-data'
import { desktop1280, phone375 } from '../../test/viewport'
import { publicTabs } from '../public-nav'
import { RegistrationBanner } from '../registration'
import { Shell } from '../shell'
import { RegistrationClosed, RegistrationScreen, RegistrationSent, type RegistrationScreenProps } from './registration'

/** Termin zapisów z przykładu `zapisy` w kontrakcie: 15 listopada, 18:00 w Polsce. */
const DEADLINE = '2026-11-15T17:00:00+00:00'

const tournament = { ...publicTournament, name: 'Liga Letnia 2026', slug: 'liga-letnia-2026' }
const backHref = `/t/${tournament.slug}`

/** Ekran w shellu turnieju, z paskiem zapisów, tak jak rysuje go `apps/public` na każdej zakładce poza samym formularzem. */
function InShell({ children, banner = false }: { children: React.ReactNode; banner?: boolean }) {
  return (
    <Shell
      tournament={tournament}
      tabs={publicTabs([{ type: 'league' }])}
      banner={banner && <RegistrationBanner deadline={DEADLINE} timeZone={scheduleTimeZone} href={`${backHref}/zgloszenie`} />}
    >
      {children}
    </Shell>
  )
}

const meta = {
  title: 'Strona publiczna/Ekrany/Zgłoszenie drużyny',
  component: RegistrationScreen,
  parameters: { layout: 'fullscreen', ...desktop1280.parameters },
  globals: desktop1280.globals,
  args: { deadline: DEADLINE, timeZone: scheduleTimeZone, onSubmit: fn() },
  render: (args: RegistrationScreenProps) => (
    <InShell>
      <RegistrationScreen {...args} />
    </InShell>
  ),
} satisfies Meta<typeof RegistrationScreen>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Pusty formularz. Kibic wpisuje drużynę i kontakt, dodaje dwóch zawodników,
 * usuwa jednego i zaznacza zgodę; ekran oddaje stronie pola tak, jak je
 * wpisał — liczbę z numeru robi dopiero strona.
 */
export const Pusty: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { level: 2, name: 'Zgłoś drużynę' })).toBeInTheDocument()
    await expect(canvas.getByText('Zgłoszenia do niedz., 15 lis, 18:00')).toBeInTheDocument()

    await userEvent.type(canvas.getByLabelText('Nazwa drużyny'), 'Lwy Mokotów')
    await userEvent.type(canvas.getByLabelText('Imię i nazwisko'), 'Anna Wiśniewska')
    await userEvent.type(canvas.getByLabelText('E-mail'), 'anna@example.com')
    await userEvent.click(canvas.getByRole('button', { name: 'Dodaj zawodnika' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Dodaj zawodnika' }))
    await userEvent.type(canvas.getByLabelText('Zawodnik 1'), 'Paweł Lis')
    await userEvent.type(canvas.getByLabelText('Numer zawodnika 1'), '7')
    await userEvent.type(canvas.getByLabelText('Zawodnik 2'), 'Kamil Dąb')
    await userEvent.click(canvas.getByRole('button', { name: 'Usuń zawodnika 1' }))
    await userEvent.click(canvas.getByRole('checkbox'))
    await userEvent.click(canvas.getByRole('button', { name: 'Wyślij zgłoszenie' }))

    await expect(args.onSubmit).toHaveBeenCalledWith({
      teamName: 'Lwy Mokotów',
      contactName: 'Anna Wiśniewska',
      contactEmail: 'anna@example.com',
      contactPhone: '',
      players: [{ name: 'Kamil Dąb', number: '' }],
      consent: true,
      website: '',
    })
    // Pole-pułapka jest w formularzu, ale poza drzewem dostępności i kolejnością fokusu.
    await expect(canvas.queryByRole('textbox', { name: 'Nie wypełniaj tego pola' })).not.toBeInTheDocument()
    await expect(canvasElement.querySelector('input[name="ta-check"]')).toHaveAttribute('tabindex', '-1')
  },
}

/**
 * Błędy z odpowiedzi `422` pod polami, a błąd bez pola (`registration`)
 * w tablicy nad formularzem. Pole z błędem ma `aria-invalid` i opis błędu.
 */
export const BledyWalidacji: Story = {
  name: 'Błędy walidacji',
  args: {
    initialDraft: {
      teamName: 'Wilki Bemowo',
      contactName: '',
      contactEmail: 'anna@',
      contactPhone: '',
      players: [
        { name: 'Paweł Lis', number: '7' },
        { name: 'Kamil Dąb', number: '7' },
      ],
      consent: false,
      website: '',
    },
    errors: {
      teamName: 'W tym turnieju jest już drużyna o tej nazwie.',
      contactName: 'Pole imię i nazwisko jest wymagane.',
      contactEmail: 'Pole e-mail musi być poprawnym adresem e-mail.',
      'players.0.number': 'Ten numer ma już inny zawodnik ze składu.',
      'players.1.number': 'Ten numer ma już inny zawodnik ze składu.',
      consent: 'Zaznacz zgodę na przetwarzanie danych.',
      registration: 'Turniej ma już komplet drużyn.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('alert')).toHaveTextContent('Turniej ma już komplet drużyn.')
    const teamName = canvas.getByLabelText('Nazwa drużyny')
    await expect(teamName).toHaveAttribute('aria-invalid', 'true')
    await expect(teamName).toHaveAccessibleDescription('W tym turnieju jest już drużyna o tej nazwie.')
    await expect(canvas.getByLabelText('Numer zawodnika 2')).toHaveAccessibleDescription('Ten numer ma już inny zawodnik ze składu.')
    await expect(canvas.getByRole('checkbox')).toHaveAccessibleDescription('Zaznacz zgodę na przetwarzanie danych.')
    // Pole bez błędu nie udaje błędnego.
    await expect(canvas.getByLabelText('Telefon (opcjonalnie)')).not.toHaveAttribute('aria-invalid')

    // Po usunięciu wiersza błędy zawodników znikają, zamiast przeskoczyć na
    // kolejnego: zostaje Kamil Dąb ze swoim numerem i bez cudzego błędu.
    await userEvent.click(canvas.getByRole('button', { name: 'Usuń zawodnika 1' }))
    await expect(canvas.getByLabelText('Zawodnik 1')).toHaveValue('Kamil Dąb')
    await expect(canvas.getByLabelText('Numer zawodnika 1')).not.toHaveAttribute('aria-invalid')
  },
}

/** Wysyłanie: przycisk zablokowany, drugie kliknięcie niczego nie wyśle. */
export const Wysylanie: Story = {
  name: 'Wysyłanie',
  args: { submitting: true },
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole('button', { name: 'Wysyłanie…' })
    await expect(button).toBeDisabled()
    await userEvent.click(button)
    await expect(args.onSubmit).not.toHaveBeenCalled()
  },
}

/** Zapisy zamknięte: tak samo pod bezpośrednim adresem formularza, bez paska zapisów. */
export const ZapisyZamkniete: Story = {
  name: 'Zapisy zamknięte',
  render: () => (
    <InShell>
      <RegistrationClosed backHref={backHref} />
    </InShell>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'Zapisy są zamknięte' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Wróć do przeglądu' })).toHaveAttribute('href', backHref)
    await expect(canvas.queryByRole('form')).not.toBeInTheDocument()
    await expect(canvas.queryByRole('complementary', { name: 'Zapisy' })).not.toBeInTheDocument()
  },
}

/** Potwierdzenie po wysłaniu: nazwa drużyny i zdanie o kontakcie od organizatora. */
export const Potwierdzenie: Story = {
  render: () => (
    <InShell>
      <RegistrationSent teamName="Lwy Mokotów" backHref={backHref} />
    </InShell>
  ),
  play: async ({ canvasElement }) => {
    const status = within(canvasElement).getByRole('status')
    await expect(within(status).getByRole('heading', { name: 'Zgłoszenie wysłane' })).toBeInTheDocument()
    await expect(status).toHaveTextContent('Drużyna „Lwy Mokotów” czeka na decyzję organizatora.')
  },
}

/** Telefon: pola jedno pod drugim, wiersz składu łamie „Usuń” pod spodem, strona nie przewija się w bok. */
export const Telefon: Story = {
  parameters: phone375.parameters,
  globals: phone375.globals,
  args: { initialDraft: { teamName: '', contactName: '', contactEmail: '', contactPhone: '', players: [{ name: 'Paweł Lis', number: '1' }], consent: false, website: '' } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.ownerDocument.documentElement.scrollWidth).toBeLessThanOrEqual(375)
  },
}
