import type { Group, Stage, Team } from '@tournament/api-client';
import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { API_URL as API, server } from '../test/server';
import { WILKI, renderPanel, serveTeams, validationError } from '../test/teams-api';
import { LEAGUE_STAGE, tournamentStages } from '../test/tournament-stages';

const GROUP_A: Group = { id: 21, name: 'Grupa A', order: 1, qualifiers: 2 };
const GROUP_B: Group = { id: 22, name: 'Grupa B', order: 2, qualifiers: 1 };
const GROUP_STAGE: Stage = { id: 13, type: 'group', name: 'Faza grupowa', order: 1, groups: [GROUP_A, GROUP_B] };

/** Cztery drużyny w dwóch grupach: pierwsze dwie w A, kolejne w B. */
const TEAMS: Team[] = [
  { ...WILKI, id: 1, name: 'Wilki Bemowo', groupId: GROUP_A.id },
  { ...WILKI, id: 2, name: 'Sokoły Ursus', groupId: GROUP_A.id },
  { ...WILKI, id: 3, name: 'Orły Bielany', groupId: GROUP_B.id },
  { ...WILKI, id: 4, name: 'Rysie Wola', groupId: GROUP_B.id },
];

/**
 * Turniej z fazą grupową: faza z grupami, drużyny z `group_id` i mecze fazy.
 * Handlery zakłada `serveTeams`, a ten dokłada fazy i mecze i zwraca `puts`,
 * czyli ciała zapisów składu.
 */
function serveGroupPhase({ groups = GROUP_STAGE.groups, teams = TEAMS, matches = [] as unknown[] } = {}) {
  const puts: unknown[] = [];
  serveTeams({ teams, players: [] });
  server.use(
    tournamentStages([{ ...GROUP_STAGE, groups }]),
    http.get(`${API}/tournaments/:id/matches`, () =>
      HttpResponse.json({
        data: matches,
        meta: { currentPage: 1, lastPage: 1, perPage: 200, total: matches.length },
      }),
    ),
    http.put(`${API}/stages/:stage/groups`, async ({ request }) => {
      puts.push(await request.json());
      return HttpResponse.json({ data: { ...GROUP_STAGE, groups } });
    }),
  );
  return puts;
}

describe('Grupy — edytor składu (#258)', () => {
  it('pokazuje zapisany skład i zapisuje go w całości', async () => {
    const puts = serveGroupPhase();
    const { user, invalidateQueries } = renderPanel('/tournaments/7/groups');

    // Skład złożony z `stage.groups` i `team.groupId`, więc przycisk jest czynny bez zmian.
    const save = await screen.findByRole('button', { name: 'Zapisz skład grup' });
    expect(save).toBeEnabled();
    expect(screen.getByDisplayValue('Grupa A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Grupa B')).toBeInTheDocument();

    await user.click(save);

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(puts[0]).toEqual({
      groups: [
        { name: 'Grupa A', qualifiers: 2, teamIds: [1, 2] },
        { name: 'Grupa B', qualifiers: 1, teamIds: [3, 4] },
      ],
    });
    expect(await screen.findByText('Zapisano skład grup.')).toBeInTheDocument();

    // Zmieniają się wszystkie trzy zbiory: fazy, mecze (kasowanie) i drużyny (`group_id`).
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tournament', 7, 'stages'] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tournament', 7, 'matches'] });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tournament', 7, 'teams'] });
    });
  });

  it('ostrzega, że zapis skasuje terminarz grup', async () => {
    serveGroupPhase({ matches: [{ id: 1, status: 'scheduled' }] });
    renderPanel('/tournaments/7/groups');

    expect(await screen.findByText(/Zapis składu skasuje terminarz grup \(1 mecz\)/)).toBeInTheDocument();
  });

  it('przy meczu rozpoczętym blokuje zapis i mówi o zamrożeniu', async () => {
    serveGroupPhase({ matches: [{ id: 1, status: 'live' }] });
    renderPanel('/tournaments/7/groups');

    expect(await screen.findByRole('button', { name: 'Zapisz skład grup' })).toBeDisabled();
    expect(screen.getByText('Faza ma mecz rozpoczęty, więc skład grup jest zamrożony.')).toBeInTheDocument();
  });

  it('422 z zapisu siada nad przyciskami', async () => {
    serveGroupPhase();
    server.use(
      http.put(`${API}/stages/:stage/groups`, () =>
        validationError({ groups: ['Skład musi zawierać każdą drużynę turnieju dokładnie raz.'] }),
      ),
    );
    const { user } = renderPanel('/tournaments/7/groups');

    await user.click(await screen.findByRole('button', { name: 'Zapisz skład grup' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Skład musi zawierać każdą drużynę turnieju dokładnie raz.');
  });

  it('bez zapisanego składu startują dwie grupy, a losowanie je wypełnia', async () => {
    const puts = serveGroupPhase({ groups: [] });
    const { user } = renderPanel('/tournaments/7/groups');

    expect(await screen.findByDisplayValue('Grupa A')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Grupa B')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Losuj' }));

    // Po losowaniu każda drużyna ma grupę, więc szkic da się zapisać.
    const save = screen.getByRole('button', { name: 'Zapisz skład grup' });
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() => expect(puts).toHaveLength(1));

    // Kolejność drużyn w grupie idzie za listą z API, więc zapis jej nie przestawia.
    const groups = (puts[0] as { groups: { teamIds: number[] }[] }).groups;
    for (const group of groups) {
      expect(group.teamIds).toEqual([...group.teamIds].sort((a, b) => a - b));
    }
  });

  it('bez fazy grupowej mówi, że turniej jej nie ma', async () => {
    serveTeams({ teams: TEAMS, players: [] });
    server.use(tournamentStages([LEAGUE_STAGE]));
    renderPanel('/tournaments/7/groups');

    expect(await screen.findByText('Ten turniej nie ma fazy grupowej')).toBeInTheDocument();
  });
});
