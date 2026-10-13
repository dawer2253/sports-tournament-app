import { PUBLIC_URL } from './env';
import { expect, test } from './fixtures';
import { expectStandings } from './standings';

/**
 * Panel i strona publiczna to dwie aplikacje na jednym backendzie: kibic ma
 * zobaczyć tabelę, którą policzył zapisany wynik, i terminarz bez meczu, który
 * właśnie się zakończył (#185, #206). Drogę przez ekrany panelu sprawdza
 * `organizer-flow.spec.ts`, więc tutaj dane powstają przez API.
 *
 * Terminarz „dwa razy”: po zakończeniu pierwszego meczu w terminarzu zostaje
 * rewanż, więc widać zarówno to, co zostało, jak i to, co z niego wypadło.
 */
test('strona publiczna pokazuje tabelę i terminarz po wyniku zapisanym w panelu', async ({ page, api, tournament }) => {
  for (const name of ['Orły', 'Sokoły']) {
    const { error } = await api.POST('/tournaments/{tournament}/teams', {
      params: { path: { tournament: tournament.id } },
      body: { name },
    });
    expect(error, `POST /teams ${name}`).toBeUndefined();
  }

  const stages = await api.GET('/tournaments/{tournament}/stages', {
    params: { path: { tournament: tournament.id } },
  });
  const stage = stages.data!.data[0]!;
  const generated = await api.POST('/stages/{stage}/schedule', {
    params: { path: { stage: stage.id } },
    body: { meetings: 2 },
  });
  expect(generated.error, 'POST /schedule').toBeUndefined();

  const matches = await api.GET('/tournaments/{tournament}/matches', {
    params: { path: { tournament: tournament.id }, query: { stageId: stage.id } },
  });
  const match = matches.data!.data[0]!;
  const saved = await api.PATCH('/matches/{match}', {
    params: { path: { match: match.id } },
    body: { status: 'finished', homeScore: 2, awayScore: 0 },
  });
  expect(saved.error, 'PATCH /matches').toBeUndefined();

  // Szkic nie istnieje publicznie (404 jak nieznany slug, decyzja #82).
  const published = await api.PATCH('/tournaments/{tournament}', {
    params: { path: { tournament: tournament.id } },
    body: { status: 'active' },
  });
  expect(published.error, 'PATCH /tournaments status').toBeUndefined();

  const home = match.homeTeam!.name;
  const away = match.awayTeam!.name;

  await page.goto(`${PUBLIC_URL}/t/${tournament.slug}/tabela`);
  await expect(page.getByRole('heading', { name: tournament.name })).toBeVisible();
  await expectStandings(page.getByRole('table'), [
    { team: home, played: 1, won: 1, drawn: 0, lost: 0, score: '2:0', points: 3 },
    { team: away, played: 1, won: 0, drawn: 0, lost: 1, score: '0:2', points: 0 },
  ]);

  // Terminarz: zakończony mecz z niego wypadł, został rewanż.
  await page.getByRole('navigation', { name: 'Sekcje turnieju' }).getByRole('link', { name: 'Terminarz' }).click();
  await expect(page).toHaveURL(`${PUBLIC_URL}/t/${tournament.slug}/terminarz`);
  await expect(page.getByRole('group', { name: `${away} – ${home}` })).toBeVisible();
  await expect(page.getByRole('group', { name: `${home} – ${away}` })).toHaveCount(0);
});

/**
 * Klasyfikacja liczy się na Laravelu ze zdarzeń meczu zakończonego (#207),
 * a strona publiczna pokazuje ją pod etykietą z odpowiedzi. Zdarzenia
 * i wynik powstają przez API, przez ekran idzie tylko Statystyki.
 */
test('gol zawodnika w meczu zakończonym trafia do Statystyk na stronie publicznej', async ({ page, api, tournament }) => {
  const scorers = new Map<number, { team: string; scorer: string; playerId: number }>();
  for (const [name, scorer] of [
    ['Wilki', 'Marek Nowak'],
    ['Sokoły', 'Tomasz Lis'],
  ] as const) {
    const created = await api.POST('/tournaments/{tournament}/teams', {
      params: { path: { tournament: tournament.id } },
      body: { name },
    });
    expect(created.error, `POST /teams ${name}`).toBeUndefined();
    const player = await api.POST('/teams/{team}/players', {
      params: { path: { team: created.data!.data.id } },
      body: { name: scorer, number: 9, position: null },
    });
    expect(player.error, `POST /players ${scorer}`).toBeUndefined();
    scorers.set(created.data!.data.id, { team: name, scorer, playerId: player.data!.data.id });
  }

  const stages = await api.GET('/tournaments/{tournament}/stages', {
    params: { path: { tournament: tournament.id } },
  });
  const stage = stages.data!.data[0]!;
  const generated = await api.POST('/stages/{stage}/schedule', {
    params: { path: { stage: stage.id } },
    body: { meetings: 1 },
  });
  expect(generated.error, 'POST /schedule').toBeUndefined();

  const matches = await api.GET('/tournaments/{tournament}/matches', {
    params: { path: { tournament: tournament.id }, query: { stageId: stage.id } },
  });
  const match = matches.data!.data[0]!;
  const finished = await api.PATCH('/matches/{match}', {
    params: { path: { match: match.id } },
    body: { status: 'finished', homeScore: 2, awayScore: 0 },
  });
  expect(finished.error, 'PATCH /matches finished').toBeUndefined();

  // Gospodarza losuje generator, więc strzelca bierzemy z drużyny gospodarza.
  const home = scorers.get(match.homeTeam!.id)!;
  for (const minute of [12, 70]) {
    const event = await api.POST('/matches/{match}/events', {
      params: { path: { match: match.id } },
      body: { type: 'goal', teamId: match.homeTeam!.id, playerId: home.playerId, minute },
    });
    expect(event.error, `POST /events ${minute}′`).toBeUndefined();
  }

  const published = await api.PATCH('/tournaments/{tournament}', {
    params: { path: { tournament: tournament.id } },
    body: { status: 'active' },
  });
  expect(published.error, 'PATCH /tournaments status').toBeUndefined();

  await page.goto(`${PUBLIC_URL}/t/${tournament.slug}`);
  await page.getByRole('navigation', { name: 'Sekcje turnieju' }).getByRole('link', { name: 'Statystyki' }).click();
  await expect(page).toHaveURL(`${PUBLIC_URL}/t/${tournament.slug}/statystyki`);

  await expect(page.getByRole('tab', { name: 'Bramki' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('columnheader', { name: 'Bramki' })).toBeVisible();
  // Jeden wiersz: zawodnik gości nie ma bramki, więc nie ma go w klasyfikacji.
  const rows = page.getByRole('table').getByRole('row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1).getByRole('cell')).toHaveText(['1', new RegExp(`${home.scorer}.*${home.team}`), '2']);
});
