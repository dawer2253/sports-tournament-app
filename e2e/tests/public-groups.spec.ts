import type { AdminMatch, ApiClient, Tournament } from '@tournament/api-client';
import { PUBLIC_URL } from './env';
import { expect, test } from './fixtures';

/**
 * Grupy i playoff na stronie publicznej (#268, wariant A z #252): dwie grupy
 * po trzy drużyny, z każdej wychodzą dwie. Skład, terminarz, wyniki i drabinka
 * idą przez API panelu, a przez ekrany tylko to, co widzi kibic. Szew, którego
 * nie widzi ani vitest na mocku, ani Pest bez przeglądarki: `Stage.groups`
 * i `Match.groupId` z Laravela → tabele z linią wyjścia, etykiety grup w
 * listach meczów i notka o rozjeździe drabinki z tabelami.
 *
 * Gospodarza wybiera generator terminarza, więc wynik meczu test wylicza
 * z siły drużyn (kolejność na liście grupy), a nie z góry.
 */

const GROUPS = {
  'Grupa A': ['Bobry', 'Dziki', 'Foki'],
  'Grupa B': ['Gryfy', 'Jelenie', 'Kuny'],
} as const;

const STRENGTH = new Map<string, number>(Object.values(GROUPS).flatMap((names) => names.map((name, index) => [name, index] as const)));

const QUALIFIERS_SENTENCE = 'Z grupy wychodzą 2 drużyny — miejsca nad przerywaną linią. Remis na linii rozstrzyga organizer.';

interface GroupsSetup {
  groupStageId: number;
  knockoutStageId: number;
  matches: AdminMatch[];
}

/** Wynik, w którym wygrywa drużyna wyżej na liście swojej grupy. */
function strongerWins(match: AdminMatch) {
  const homeWins = STRENGTH.get(match.homeTeam!.name)! < STRENGTH.get(match.awayTeam!.name)!;
  return { status: 'finished' as const, homeScore: homeWins ? 1 : 0, awayScore: homeWins ? 0 : 1 };
}

/** Drużyny, skład grup i terminarz grup przez API, a turniej opublikowany. */
async function setUpGroups(api: ApiClient, tournament: Tournament): Promise<GroupsSetup> {
  const ids = new Map<string, number>();
  for (const name of Object.values(GROUPS).flat()) {
    const { data, error } = await api.POST('/tournaments/{tournament}/teams', {
      params: { path: { tournament: tournament.id } },
      body: { name },
    });
    expect(error, `POST /teams ${name}`).toBeUndefined();
    ids.set(name, data!.data.id);
  }

  const stages = await api.GET('/tournaments/{tournament}/stages', { params: { path: { tournament: tournament.id } } });
  const groupStage = stages.data!.data.find((stage) => stage.type === 'group')!;
  const knockoutStage = stages.data!.data.find((stage) => stage.type === 'knockout')!;

  const composed = await api.PUT('/stages/{stage}/groups', {
    params: { path: { stage: groupStage.id } },
    body: {
      groups: Object.entries(GROUPS).map(([name, teams]) => ({ name, teamIds: teams.map((team) => ids.get(team)!), qualifiers: 2 })),
    },
  });
  expect(composed.error, 'PUT /stages/{stage}/groups').toBeUndefined();

  const generated = await api.POST('/stages/{stage}/schedule', {
    params: { path: { stage: groupStage.id } },
    body: { meetings: 1 },
  });
  expect(generated.error, 'POST /stages/{stage}/schedule').toBeUndefined();

  const published = await api.PATCH('/tournaments/{tournament}', {
    params: { path: { tournament: tournament.id } },
    body: { status: 'active' },
  });
  expect(published.error, 'PATCH /tournaments status').toBeUndefined();

  const matches = await api.GET('/tournaments/{tournament}/matches', {
    params: { path: { tournament: tournament.id }, query: { stageId: groupStage.id } },
  });
  return { groupStageId: groupStage.id, knockoutStageId: knockoutStage.id, matches: matches.data!.data };
}

async function saveResult(api: ApiClient, match: AdminMatch, body: { status: 'finished'; homeScore: number; awayScore: number }) {
  const saved = await api.PATCH('/matches/{match}', { params: { path: { match: match.id } }, body });
  expect(saved.error, 'PATCH /matches').toBeUndefined();
}

/** Mecz pary drużyn, niezależnie od tego, kto jest gospodarzem. */
function matchOf(matches: AdminMatch[], a: string, b: string): AdminMatch {
  return matches.find((match) => [match.homeTeam!.name, match.awayTeam!.name].toSorted().join() === [a, b].toSorted().join())!;
}

test('kibic widzi tabele grup z linią wyjścia i grupy w Terminarzu', async ({ page, api, groups }) => {
  const played = await test.step('dwie grupy przez API i po meczu rozegranym w każdej', async () => {
    const { matches } = await setUpGroups(api, groups);
    const match = matchOf(matches, 'Bobry', 'Dziki');
    const other = matchOf(matches, 'Gryfy', 'Jelenie');
    await saveResult(api, match, strongerWins(match));
    await saveResult(api, other, strongerWins(other));
    const remaining = matches.find((candidate) => candidate.groupId === other.groupId && candidate.id !== other.id)!;
    return { match, remaining };
  });

  await test.step('Tabela ma obie grupy z punktami, linią wyjścia i zdaniem o wychodzących', async () => {
    await page.goto(`${PUBLIC_URL}/t/${groups.slug}`);
    await page.getByRole('navigation', { name: 'Sekcje turnieju' }).getByRole('link', { name: 'Tabela' }).click();

    for (const [name, [winner]] of Object.entries(GROUPS)) {
      const region = page.getByRole('region', { name });
      await expect(region.getByRole('heading', { name })).toBeVisible();
      await expect(region.getByText(QUALIFIERS_SENTENCE)).toBeVisible();
      // Wiersz nad linią rozpoznaje się po słowach, które tabela daje czytnikowi ekranu.
      await expect(region.getByText(', wychodzi z grupy')).toHaveCount(2);
      const leader = region.getByRole('row').filter({ hasText: winner });
      await expect(leader.getByRole('cell').last(), `punkty ${winner}`).toHaveText('3');
    }
  });

  await test.step('Terminarz i Wyniki niosą nazwę grupy przy wierszu meczu', async () => {
    const tabs = page.getByRole('navigation', { name: 'Sekcje turnieju' });
    await tabs.getByRole('link', { name: 'Terminarz' }).click();
    const fixture = page.getByRole('link', { name: `${played.remaining.homeTeam!.name} – ${played.remaining.awayTeam!.name}` });
    await expect(fixture).toContainText('Grupa B');

    await tabs.getByRole('link', { name: 'Wyniki' }).click();
    const result = page.getByRole('link', { name: `${played.match.homeTeam!.name} – ${played.match.awayTeam!.name}` });
    await expect(result).toContainText('Grupa A');
  });
});

test('kibic widzi pustą Drabinkę z odnośnikiem do tabel grup, a po wygenerowaniu drzewo i notkę o rozjeździe', async ({
  page,
  api,
  groups,
}) => {
  const setup = await test.step('dwie grupy przez API, wszystkie mecze grup rozegrane po sile drużyn', async () => {
    const created = await setUpGroups(api, groups);
    for (const match of created.matches) await saveResult(api, match, strongerWins(match));
    return created;
  });

  await test.step('przed wygenerowaniem Drabinka ma pusty stan z odnośnikiem do tabel grup', async () => {
    await page.goto(`${PUBLIC_URL}/t/${groups.slug}/drabinka`);
    await expect(page.getByRole('heading', { name: 'Drabinka powstanie po fazie grupowej' })).toBeVisible();
    await page.getByRole('link', { name: 'Zobacz tabele grup' }).click();
    await expect(page).toHaveURL(`${PUBLIC_URL}/t/${groups.slug}/tabela`);
  });

  await test.step('po wygenerowaniu z propozycji rozstawienia jest drzewo bez notki', async () => {
    const seeding = await api.GET('/stages/{stage}/bracket/seeding', { params: { path: { stage: setup.knockoutStageId } } });
    expect(seeding.error, 'GET /bracket/seeding').toBeUndefined();
    const generated = await api.POST('/stages/{stage}/bracket', {
      params: { path: { stage: setup.knockoutStageId } },
      body: { teamIds: seeding.data!.data.map((seed) => seed.teamId), thirdPlaceMatch: false },
    });
    expect(generated.error, 'POST /bracket').toBeUndefined();

    await page.goto(`${PUBLIC_URL}/t/${groups.slug}/drabinka`);
    // Rozstawienie 1A, 1B, 2A, 2B: w półfinale 1 zwycięzca A gra z drugim z B.
    await expect(page.getByRole('link', { name: 'Półfinał 1: Bobry – Jelenie' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Półfinał 2: Gryfy – Dziki' })).toBeVisible();
    await expect(page.getByText(/Drabinka różni się od dzisiejszych tabel grup/)).toBeHidden();
  });

  await test.step('po zmianie wyniku grupy notka mówi, kto gra w drabince, a kto stoi dziś nad linią', async () => {
    // Foki wygrywają z Dzikami wysoko i wyprzedzają je w Grupie A.
    const match = matchOf(setup.matches, 'Dziki', 'Foki');
    const fokiHome = match.homeTeam!.name === 'Foki';
    await saveResult(api, match, { status: 'finished', homeScore: fokiHome ? 5 : 0, awayScore: fokiHome ? 0 : 5 });

    await page.reload();
    await expect(
      page.getByText(
        'Drabinka różni się od dzisiejszych tabel grup: w drabince gra Dziki, a w tabeli grupy nad linią stoi dziś Foki.',
      ),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Półfinał 2: Gryfy – Dziki' })).toBeVisible();
  });
});
