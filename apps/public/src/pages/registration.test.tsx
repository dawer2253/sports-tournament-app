import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { API_URL as API, server } from '../test/server';
import { SLUG, publicApi, renderAt, tournament } from '../test/public-api';

/** Zgłoszenie drużyny na stronie publicznej (#300, DoD „Vitest (`apps/public`)”). */

const DEADLINE = '2026-11-15T17:00:00+00:00';
const open = () => tournament({ registration: { open: true, deadline: DEADLINE } });
const FORM = `/t/${SLUG}/zgloszenie`;

/** Odpowiedź `POST /public/t/{slug}/registrations`; ciała żądań trafiają do `bodies`. */
function registrationApi(respond: () => Response = () => HttpResponse.json({ data: { teamName: 'Lwy Mokotów' } }, { status: 201 })) {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${API}/public/t/:slug/registrations`, async ({ request }) => {
      bodies.push(await request.json());
      return respond();
    }),
  );
  return bodies;
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Nazwa drużyny'), 'Lwy Mokotów');
  await user.type(screen.getByLabelText('Imię i nazwisko'), 'Anna Wiśniewska');
  await user.type(screen.getByLabelText('E-mail'), 'anna@example.com');
  await user.click(screen.getByRole('checkbox'));
}

describe('Zgłoszenie drużyny: formularz', () => {
  it('wysyła ciało z kontraktu, z numerami jako liczbami, i pokazuje potwierdzenie', async () => {
    publicApi({ data: open() });
    const bodies = registrationApi();
    const user = userEvent.setup();
    renderAt(FORM);

    await fillRequired(user);
    await user.type(screen.getByLabelText('Telefon (opcjonalnie)'), '+48 600 100 200');
    await user.click(screen.getByRole('button', { name: 'Dodaj zawodnika' }));
    await user.type(screen.getByLabelText('Zawodnik 1'), 'Paweł Lis');
    await user.type(screen.getByLabelText('Numer zawodnika 1'), '7');
    await user.click(screen.getByRole('button', { name: 'Dodaj zawodnika' }));
    await user.type(screen.getByLabelText('Zawodnik 2'), 'Kamil Dąb');
    await user.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));

    const status = await screen.findByRole('status');
    expect(within(status).getByRole('heading', { name: 'Zgłoszenie wysłane' })).toBeInTheDocument();
    expect(status).toHaveTextContent('Drużyna „Lwy Mokotów” czeka na decyzję organizatora.');
    expect(bodies).toEqual([
      {
        teamName: 'Lwy Mokotów',
        contactName: 'Anna Wiśniewska',
        contactEmail: 'anna@example.com',
        contactPhone: '+48 600 100 200',
        players: [
          { name: 'Paweł Lis', number: 7 },
          { name: 'Kamil Dąb', number: null },
        ],
        consent: true,
      },
    ]);
  });

  it('pokazuje błędy z 422 pod polami, a błąd bez pola nad formularzem', async () => {
    publicApi({ data: open() });
    registrationApi(() =>
      HttpResponse.json(
        {
          message: 'W tym turnieju jest już drużyna o tej nazwie. (i jeszcze 2 błędy)',
          errors: {
            teamName: ['W tym turnieju jest już drużyna o tej nazwie.'],
            consent: ['Zaznacz zgodę na przetwarzanie danych.'],
            registration: ['Turniej ma już komplet drużyn.'],
          },
        },
        { status: 422 },
      ),
    );
    const user = userEvent.setup();
    renderAt(FORM);

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Turniej ma już komplet drużyn.');
    const teamName = screen.getByLabelText('Nazwa drużyny');
    expect(teamName).toHaveAttribute('aria-invalid', 'true');
    expect(teamName).toHaveAccessibleDescription('W tym turnieju jest już drużyna o tej nazwie.');
    expect(screen.getByRole('checkbox')).toHaveAccessibleDescription('Zaznacz zgodę na przetwarzanie danych.');
    // Formularz zostaje z tym, co wpisano.
    expect(teamName).toHaveValue('Lwy Mokotów');
  });

  it('nie wysyła numeru, który nie jest liczbą, i mówi to pod polem', async () => {
    publicApi({ data: open() });
    const bodies = registrationApi();
    const user = userEvent.setup();
    renderAt(FORM);

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Dodaj zawodnika' }));
    await user.type(screen.getByLabelText('Zawodnik 1'), 'Paweł Lis');
    await user.type(screen.getByLabelText('Numer zawodnika 1'), 'x7');
    await user.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));

    await waitFor(() => expect(screen.getByLabelText('Numer zawodnika 1')).toHaveAccessibleDescription('Numer to liczba od 0 do 999.'));
    expect(bodies).toEqual([]);
  });

  it('pokazuje treść 429 nad formularzem', async () => {
    publicApi({ data: open() });
    registrationApi(() => HttpResponse.json({ message: 'Zbyt wiele prób. Spróbuj ponownie później.' }, { status: 429 }));
    const user = userEvent.setup();
    renderAt(FORM);

    await fillRequired(user);
    await user.click(screen.getByRole('button', { name: 'Wyślij zgłoszenie' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Zbyt wiele prób. Spróbuj ponownie później.');
  });

  it('pod bezpośrednim adresem formularza przy zamkniętych zapisach mówi, że zapisy są zamknięte', async () => {
    publicApi({ data: tournament({ registration: { open: false, deadline: null } }) });
    renderAt(FORM);

    expect(await screen.findByRole('heading', { name: 'Zapisy są zamknięte' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Nazwa drużyny')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Wróć do przeglądu' })).toHaveAttribute('href', `/t/${SLUG}`);
  });
});

describe('Zgłoszenie drużyny: wejście w formularz', () => {
  it('przy otwartych zapisach stoi pasek na każdej zakładce i kafel na Przeglądzie', async () => {
    publicApi({ data: open() });
    const { router } = renderAt(`/t/${SLUG}`);

    const banner = await screen.findByRole('complementary', { name: 'Zapisy' });
    expect(within(banner).getByRole('link', { name: 'Zgłoś drużynę' })).toHaveAttribute('href', FORM);
    expect(await screen.findByRole('heading', { name: /^Zapisy otwarte do / })).toBeInTheDocument();

    await router.navigate(`/t/${SLUG}/terminarz`);
    expect(await screen.findByRole('complementary', { name: 'Zapisy' })).toBeInTheDocument();
  });

  it('przy zamkniętych zapisach nie ma ani paska, ani kafla', async () => {
    publicApi({ data: tournament({ registration: { open: false, deadline: null } }) });
    renderAt(`/t/${SLUG}`);

    await screen.findByRole('navigation', { name: 'Sekcje turnieju' });
    expect(screen.queryByRole('complementary', { name: 'Zapisy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Zgłoś drużynę' })).not.toBeInTheDocument();
  });

  it('na samym formularzu paska nie ma', async () => {
    publicApi({ data: open() });
    renderAt(FORM);

    await screen.findByLabelText('Nazwa drużyny');
    expect(screen.queryByRole('complementary', { name: 'Zapisy' })).not.toBeInTheDocument();
  });

  it('przechodzi z paska do formularza', async () => {
    publicApi({ data: open() });
    const user = userEvent.setup();
    const { router } = renderAt(`/t/${SLUG}/tabela`);

    await user.click(within(await screen.findByRole('complementary', { name: 'Zapisy' })).getByRole('link', { name: 'Zgłoś drużynę' }));

    expect(router.state.location.pathname).toBe(FORM);
    expect(await screen.findByRole('heading', { level: 2, name: 'Zgłoś drużynę' })).toBeInTheDocument();
  });
});
