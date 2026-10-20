import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Stage, Team, TeamRegistration, Tournament } from '@tournament/api-client';
import { Toaster } from '@tournament/ui';
import { HttpResponse, http } from 'msw';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { setToken } from '../lib/session';
import { routes } from '../routes';
import { API_URL as API, server } from '../test/server';
import { currentTournaments } from '../test/current-tournaments';
import { LEAGUE_STAGE, tournamentStages } from '../test/tournament-stages';

/** Zgłoszenia drużyn w panelu (#300, DoD „Vitest (`apps/admin`)”). */

const ME = {
  data: { id: 1, name: 'Dawid Patko', email: 'dawid@example.com', createdAt: '2026-09-01T10:00:00+02:00' },
};

const TOURNAMENT: Tournament = {
  id: 5,
  name: 'Liga Letnia 2026',
  slug: 'liga-letnia-2026',
  status: 'active',
  sport: { id: 1, code: 'football', name: 'Piłka nożna', allowsDraw: true },
  branding: { logoUrl: null, primaryColor: '#1F7A45' },
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ['points', 'score_diff'],
  matchDuration: 60,
  periods: { count: 2, minutes: 45 },
  teamsCount: 1,
  registration: { open: true, deadline: '2026-11-15T17:00:00+00:00', pendingCount: 2 },
  createdAt: '2026-10-01T08:00:00+00:00',
  updatedAt: '2026-10-01T08:00:00+00:00',
};

function registration(id: number, overrides: Partial<TeamRegistration> = {}): TeamRegistration {
  return {
    id,
    tournamentId: TOURNAMENT.id,
    teamName: `Drużyna ${id}`,
    status: 'pending',
    contact: { name: 'Anna Wiśniewska', email: 'anna@example.com', phone: null },
    players: [],
    teamId: null,
    createdAt: '2026-10-10T17:42:00+00:00',
    decidedAt: null,
    ...overrides,
  };
}

const LWY = registration(5, {
  teamName: 'Lwy Mokotów',
  contact: { name: 'Anna Wiśniewska', email: 'anna@example.com', phone: '+48 600 100 200' },
  players: [{ name: 'Paweł Lis', number: 1 }],
});
const SMOKI = registration(6, { teamName: 'Smoki Ochota', createdAt: '2026-10-12T08:05:00+00:00' });

/**
 * Zgłoszenia i turniej po stronie „serwera”: przyjęcie i odrzucenie zmieniają
 * stan, a `GET` turnieju liczy oczekujące z niego, jak API.
 */
function serveRegistrations(initial: TeamRegistration[], { stages = [LEAGUE_STAGE], matchesTotal = 0 }: { stages?: Stage[]; matchesTotal?: number } = {}) {
  const state = { registrations: [...initial], tournamentRequests: 0 };
  server.use(
    tournamentStages(stages),
    http.get(`${API}/tournaments/${TOURNAMENT.id}`, () => {
      state.tournamentRequests += 1;
      const pendingCount = state.registrations.filter(({ status }) => status === 'pending').length;
      return HttpResponse.json({ data: { ...TOURNAMENT, registration: { ...TOURNAMENT.registration, pendingCount } } });
    }),
    http.get(`${API}/tournaments/${TOURNAMENT.id}/registrations`, () => HttpResponse.json({ data: [...state.registrations] })),
    http.get(`${API}/tournaments/${TOURNAMENT.id}/matches`, () =>
      HttpResponse.json({ data: [], meta: { currentPage: 1, lastPage: 1, perPage: 1, total: matchesTotal } }),
    ),
  );
  return state;
}

function decide(id: number, patch: Partial<TeamRegistration>) {
  return (registrations: TeamRegistration[]) => registrations.map((candidate) => (candidate.id === id ? { ...candidate, ...patch } : candidate));
}

beforeEach(() => {
  setToken('1|token');
  server.use(http.get(`${API}/me`, () => HttpResponse.json(ME)), currentTournaments());
});

function renderRegistrations() {
  const router = createMemoryRouter(routes, { initialEntries: [`/tournaments/${TOURNAMENT.id}/registrations`] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const card = (name: string) => screen.findByRole('article', { name });

describe('Zgłoszenia: lista', () => {
  it('pokazuje oczekujące z danymi zgłaszającego, a karta sekcji ma liczbę oczekujących', async () => {
    serveRegistrations([LWY, SMOKI, registration(3, { teamName: 'Rysie Wola', status: 'rejected', contact: null, decidedAt: '2026-10-03T18:00:00+00:00' })]);
    renderRegistrations();

    const lwy = await card('Lwy Mokotów');
    expect(within(lwy).getByRole('link', { name: 'anna@example.com' })).toHaveAttribute('href', 'mailto:anna@example.com');
    expect(within(lwy).getByText('Paweł Lis')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Rozpatrzone' })).getByRole('article', { name: 'Rysie Wola' })).toBeInTheDocument();

    const tab = within(screen.getByRole('navigation', { name: 'Sekcje turnieju' })).getByRole('link', { name: /Zgłoszenia/ });
    expect(tab).toHaveAccessibleName('Zgłoszenia, 2 oczekujące');
    expect(tab).toHaveAttribute('aria-current', 'page');
  });

  it('bez zgłoszeń mówi, że zgłoszenia przyjdą z formularza na stronie turnieju', async () => {
    serveRegistrations([]);
    renderRegistrations();

    expect(await screen.findByText('Nie ma jeszcze zgłoszeń')).toBeInTheDocument();
    expect(screen.getByText(/Zgłoszenia z formularza na stronie turnieju pojawią się tutaj/)).toBeInTheDocument();
  });
});

describe('Zgłoszenia: przyjęcie', () => {
  it('przyjmuje zgłoszenie, pokazuje toast i odświeża licznik oczekujących', async () => {
    const state = serveRegistrations([LWY, SMOKI]);
    server.use(
      http.post(`${API}/registrations/${LWY.id}/accept`, () => {
        state.registrations = decide(LWY.id, { status: 'accepted', teamId: 10, decidedAt: '2026-10-20T08:00:00+00:00' })(state.registrations);
        const team: Team = { id: 10, tournamentId: TOURNAMENT.id, name: 'Lwy Mokotów', logoUrl: null, groupId: null, playersCount: 1, scheduledMatchesCount: 0 };
        return HttpResponse.json({ data: team }, { status: 201 });
      }),
    );
    const user = renderRegistrations();

    await user.click(within(await card('Lwy Mokotów')).getByRole('button', { name: 'Przyjmij' }));

    expect(await screen.findByText('Przyjęto zgłoszenie. Drużyna „Lwy Mokotów” jest na liście drużyn.')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(screen.getByRole('region', { name: 'Rozpatrzone' })).getByRole('article', { name: 'Lwy Mokotów' })).toBeInTheDocument(),
    );
    const tab = within(screen.getByRole('navigation', { name: 'Sekcje turnieju' })).getByRole('link', { name: /Zgłoszenia/ });
    await waitFor(() => expect(tab).toHaveAccessibleName('Zgłoszenia, 1 oczekujące'));
  });

  it('pokazuje błąd przyjęcia przy zgłoszeniu, którego dotyczy', async () => {
    serveRegistrations([LWY, SMOKI]);
    server.use(
      http.post(`${API}/registrations/${SMOKI.id}/accept`, () =>
        HttpResponse.json(
          { message: 'W tym turnieju jest już drużyna o tej nazwie.', errors: { name: ['W tym turnieju jest już drużyna o tej nazwie.'] } },
          { status: 422 },
        ),
      ),
    );
    const user = renderRegistrations();

    const smoki = await card('Smoki Ochota');
    await user.click(within(smoki).getByRole('button', { name: 'Przyjmij' }));

    expect(await within(smoki).findByRole('alert')).toHaveTextContent('W tym turnieju jest już drużyna o tej nazwie.');
    expect(within(await card('Lwy Mokotów')).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uprzedza przy „Przyjmij”, gdy skład grup jest już ustalony', async () => {
    serveRegistrations([LWY], {
      stages: [{ id: 3, type: 'group', name: 'Faza grupowa', order: 1, groups: [{ id: 1, name: 'Grupa A', order: 1, qualifiers: 2 }] }],
    });
    renderRegistrations();

    expect(await within(await card('Lwy Mokotów')).findByText(/Skład grup jest już ustalony/)).toBeInTheDocument();
  });

  it('uprzedza przy „Przyjmij”, gdy terminarz jest już ułożony', async () => {
    serveRegistrations([LWY], { matchesTotal: 6 });
    renderRegistrations();

    expect(await within(await card('Lwy Mokotów')).findByText(/Terminarz jest już ułożony/)).toBeInTheDocument();
  });
});

describe('Zgłoszenia: odrzucenie', () => {
  it('odrzuca po potwierdzeniu w oknie i przenosi zgłoszenie do rozpatrzonych bez danych', async () => {
    const state = serveRegistrations([LWY]);
    server.use(
      http.post(`${API}/registrations/${LWY.id}/reject`, () => {
        state.registrations = decide(LWY.id, { status: 'rejected', contact: null, players: [], decidedAt: '2026-10-20T08:00:00+00:00' })(state.registrations);
        return HttpResponse.json({ data: state.registrations[0] });
      }),
    );
    const user = renderRegistrations();

    await user.click(within(await card('Lwy Mokotów')).getByRole('button', { name: 'Odrzuć' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Odrzucić zgłoszenie „Lwy Mokotów”?' });
    await user.click(within(dialog).getByRole('button', { name: 'Odrzuć zgłoszenie' }));

    expect(await screen.findByText('Odrzucono zgłoszenie „Lwy Mokotów”.')).toBeInTheDocument();
    const rejected = await within(await screen.findByRole('region', { name: 'Rozpatrzone' })).findByRole('article', { name: 'Lwy Mokotów' });
    expect(within(rejected).queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Wszystkie zgłoszenia są rozpatrzone.')).toBeInTheDocument();
  });

  it('pokazuje w oknie odmowę zgłoszenia już rozpatrzonego', async () => {
    serveRegistrations([LWY]);
    server.use(
      http.post(`${API}/registrations/${LWY.id}/reject`, () =>
        HttpResponse.json(
          { message: 'To zgłoszenie zostało już rozpatrzone.', errors: { registration: ['To zgłoszenie zostało już rozpatrzone.'] } },
          { status: 422 },
        ),
      ),
    );
    const user = renderRegistrations();

    await user.click(within(await card('Lwy Mokotów')).getByRole('button', { name: 'Odrzuć' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Odrzuć zgłoszenie' }));

    expect(await within(dialog).findByText('To zgłoszenie zostało już rozpatrzone.')).toBeInTheDocument();
  });
});
