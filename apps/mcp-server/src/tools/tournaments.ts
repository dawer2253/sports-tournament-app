import type { Sport, Stage, Tournament, TournamentStatus, TournamentUpdate } from '@tournament/api-client';
import * as z from 'zod/v4';
import { ToolFailure, unwrap } from '../api.ts';
import { warsawDateTime, warsawLocal } from '../time.ts';
import { ADD, EDIT, ensureOk, id, localDateTime, panelLink, READ, run, stagesOf, success, type ToolKit } from './kit.ts';

const FORMATS = {
  league: 'liga (każdy z każdym)',
  knockout: 'puchar (drabinka)',
  groups_playoff: 'grupy, a potem puchar',
} as const;

type Format = keyof typeof FORMATS;

const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: 'szkic',
  active: 'trwa',
  finished: 'zakończony',
};

/** Formatu API nie przechowuje: wynika z faz, które turniej dostał przy założeniu. */
function formatOf(stages: Stage[]): Format {
  if (stages.some((stage) => stage.type === 'group')) {
    return 'groups_playoff';
  }
  return stages.every((stage) => stage.type === 'knockout') ? 'knockout' : 'league';
}

const tiebreakerCode = z.enum([
  'points',
  'head_to_head',
  'score_diff',
  'score_for',
  'score_against',
  'wins',
  'set_ratio',
  'point_ratio',
]);

const pointsSchema = z.object({
  win: z.number().int().min(0),
  draw: z.number().int().min(0),
  loss: z.number().int().min(0),
  winDecidingSet: z.number().int().min(0).optional(),
  lossDecidingSet: z.number().int().min(0).optional(),
});

const setFormatSchema = z.object({
  setsToWin: z.union([z.literal(2), z.literal(3)]),
  setPoints: z.number().int(),
  decidingSetPoints: z.number().int(),
  minLead: z.union([z.literal(1), z.literal(2)]),
});

const settingsSchema = z.object({
  points: pointsSchema,
  tiebreakers: z.array(tiebreakerCode),
  matchDuration: z.number().describe('Długość meczu w minutach.'),
  periods: z.object({ count: z.number(), minutes: z.number().nullable() }),
  setFormat: setFormatSchema.nullable(),
  primaryColor: z.string(),
  registration: z.object({
    open: z.boolean(),
    deadline: z.string().nullable().describe('Czas warszawski, „YYYY-MM-DD HH:MM”.'),
    pendingCount: z.number(),
  }),
});

function settingsOf(tournament: Tournament) {
  return {
    points: tournament.points,
    tiebreakers: tournament.tiebreakers,
    matchDuration: tournament.matchDuration,
    periods: tournament.periods,
    setFormat: tournament.setFormat,
    primaryColor: tournament.branding.primaryColor,
    registration: {
      open: tournament.registration.open,
      deadline: tournament.registration.deadline ? warsawLocal(tournament.registration.deadline) : null,
      pendingCount: tournament.registration.pendingCount,
    },
  };
}

const stageSchema = z.object({
  id: z.number(),
  type: z.enum(['league', 'group', 'knockout']),
  name: z.string(),
  groups: z.array(z.object({ id: z.number(), name: z.string(), qualifiers: z.number() })),
});

function stageView(stage: Stage) {
  return {
    id: stage.id,
    type: stage.type,
    name: stage.name,
    groups: stage.groups.map((group) => ({ id: group.id, name: group.name, qualifiers: group.qualifiers })),
  };
}

function stageLine(stage: Stage): string {
  const groups = stage.groups.map((group) => `${group.name} (id ${group.id}, wychodzi ${group.qualifiers})`);
  return `- ${stage.name}: id ${stage.id}, typ ${stage.type}${groups.length > 0 ? `; grupy: ${groups.join(', ')}` : ''}`;
}

export function registerTournamentTools({ server, session, config }: ToolKit): void {
  async function fetchTournament(tournamentId: number): Promise<Tournament> {
    return unwrap(
      await session.request((api) =>
        api.GET('/tournaments/{tournament}', { params: { path: { tournament: tournamentId } } }),
      ),
    ).data;
  }

  async function fetchSports(): Promise<Sport[]> {
    return unwrap(await session.request((api) => api.GET('/sports'))).data;
  }

  server.registerTool(
    'list_sports',
    {
      title: 'Lista sportów',
      description:
        'Zwraca sporty dostępne przy zakładaniu turnieju: kod, nazwę, czy dopuszczają remis, czy grają na sety, ' +
        'typy zdarzeń meczowych (gole, kartki, punkty) z informacją, czy wymagają zawodnika, statystyki klasyfikacji ' +
        'zawodników i domyślne ustawienia (punktacja, długość meczu, części gry).',
      inputSchema: {},
      outputSchema: {
        sports: z.array(
          z.object({
            code: z.string(),
            name: z.string(),
            allowsDraw: z.boolean(),
            playsSets: z.boolean(),
            eventTypes: z.array(
              z.object({ code: z.string(), label: z.string(), hasPlayer: z.boolean(), value: z.number() }),
            ),
            stats: z.array(z.object({ code: z.string(), label: z.string() })),
            tiebreakers: z.array(z.object({ code: z.string(), label: z.string() })),
            defaults: z.object({
              points: pointsSchema,
              matchDuration: z.number(),
              periods: z.object({ count: z.number(), minutes: z.number().nullable() }),
            }),
          }),
        ),
      },
      annotations: { title: 'Lista sportów', ...READ },
    },
    () =>
      run(async () => {
        const sports = (await fetchSports()).map((sport) => ({
          code: sport.code,
          name: sport.name,
          allowsDraw: sport.config.allowsDraw,
          playsSets: sport.config.defaultSetFormat !== null,
          eventTypes: sport.config.eventTypes.map(({ code, label, hasPlayer, value }) => ({
            code,
            label,
            hasPlayer,
            value,
          })),
          stats: sport.config.availableStats.map((code) => ({ code, label: sport.config.statLabels[code] ?? code })),
          tiebreakers: sport.config.availableTiebreakers.map((code) => ({
            code,
            label: sport.config.tiebreakerLabels[code] ?? code,
          })),
          defaults: {
            points: sport.config.defaultPoints,
            matchDuration: sport.config.defaultMatchDuration,
            periods: sport.config.defaultPeriods,
          },
        }));
        const lines = sports.map(
          (sport) =>
            `- ${sport.name} (${sport.code}): ${sport.allowsDraw ? 'remis możliwy' : 'bez remisów'}` +
            `${sport.playsSets ? ', gra na sety' : ''}; zdarzenia: ` +
            sport.eventTypes.map((type) => `${type.code} (${type.label})`).join(', '),
        );
        return success({ sports }, ['Dostępne sporty:', ...lines].join('\n'));
      }),
  );

  server.registerTool(
    'list_tournaments',
    {
      title: 'Lista turniejów',
      description:
        'Zwraca turnieje zalogowanego organizatora, od najnowszych, po 20 na stronę: id, nazwę, status ' +
        '(draft = szkic niewidoczny publicznie, active = trwa i jest opublikowany, finished = zakończony), sport ' +
        'i liczbę drużyn. Można zawęzić do wybranych statusów.',
      inputSchema: {
        status: z
          .array(z.enum(['draft', 'active', 'finished']))
          .min(1)
          .optional()
          .describe('Tylko turnieje w tych statusach. Bez tego pola: wszystkie.'),
        page: z.number().int().min(1).default(1).describe('Numer strony, od 1.'),
      },
      outputSchema: {
        tournaments: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            status: z.enum(['draft', 'active', 'finished']),
            sport: z.string(),
            teamsCount: z.number(),
          }),
        ),
        page: z.number(),
        lastPage: z.number(),
        total: z.number(),
      },
      annotations: { title: 'Lista turniejów', ...READ },
    },
    ({ status, page }) =>
      run(async () => {
        const result = unwrap(
          await session.request((api) => api.GET('/tournaments', { params: { query: { status, page, perPage: 20 } } })),
        );
        const tournaments = result.data.map((tournament) => ({
          id: tournament.id,
          name: tournament.name,
          status: tournament.status,
          sport: tournament.sport.code,
          teamsCount: tournament.teamsCount,
        }));
        const lines = tournaments.map(
          (tournament) =>
            `- ${tournament.name} (id ${tournament.id}): ${STATUS_LABELS[tournament.status]}, ${tournament.sport}, ` +
            `drużyn: ${tournament.teamsCount}`,
        );
        const { currentPage, lastPage, total } = result.meta;
        const header =
          total === 0
            ? 'Brak turniejów.'
            : `Turnieje (strona ${currentPage} z ${lastPage}, razem ${total}):`;
        return success({ tournaments, page: currentPage, lastPage, total }, [header, ...lines].join('\n'));
      }),
  );

  server.registerTool(
    'get_tournament',
    {
      title: 'Szczegóły turnieju',
      description:
        'Zwraca jeden turniej: status, sport, format, ustawienia (punktacja, kolejność rozstrzygania remisów ' +
        'w tabeli, długość meczu, części gry, format setów, kolor, zapisy), fazy z grupami i liczbą drużyn ' +
        'wychodzących z grupy oraz drużyny z id, grupą i liczbą zawodników. Zawodników zwraca list_players.',
      inputSchema: { tournamentId: id('Id turnieju (z list_tournaments albo create_tournament).') },
      outputSchema: {
        id: z.number(),
        name: z.string(),
        slug: z.string(),
        status: z.enum(['draft', 'active', 'finished']),
        format: z.enum(['league', 'knockout', 'groups_playoff']),
        sport: z.object({ code: z.string(), name: z.string(), allowsDraw: z.boolean() }),
        settings: settingsSchema,
        stages: z.array(stageSchema),
        teams: z.array(
          z.object({ id: z.number(), name: z.string(), groupId: z.number().nullable(), playersCount: z.number() }),
        ),
        panelUrl: z.string(),
      },
      annotations: { title: 'Szczegóły turnieju', ...READ },
    },
    ({ tournamentId }) =>
      run(async () => {
        const [tournament, stages, teams] = await Promise.all([
          fetchTournament(tournamentId),
          stagesOf(session, tournamentId),
          session
            .request((api) =>
              api.GET('/tournaments/{tournament}/teams', { params: { path: { tournament: tournamentId } } }),
            )
            .then((result) => unwrap(result).data),
        ]);
        const format = formatOf(stages);
        const settings = settingsOf(tournament);
        const groupNames = new Map(stages.flatMap((stage) => stage.groups.map((group) => [group.id, group.name])));
        const panelUrl = panelLink(config, tournamentId);

        const text = [
          `${tournament.name} (id ${tournament.id}, slug ${tournament.slug}): ${STATUS_LABELS[tournament.status]}, ` +
            `${tournament.sport.name}, ${FORMATS[format]}.`,
          `Punktacja: wygrana ${settings.points.win}, remis ${settings.points.draw}, porażka ${settings.points.loss}. ` +
            `Mecz: ${settings.matchDuration} min, części: ${settings.periods.count}. ` +
            `Zapisy: ${settings.registration.open ? 'otwarte' : 'zamknięte'}` +
            `${settings.registration.pendingCount > 0 ? `, zgłoszeń do decyzji: ${settings.registration.pendingCount}` : ''}.`,
          'Fazy:',
          ...stages.map(stageLine),
          `Drużyny (${teams.length}):`,
          ...teams.map(
            (team) =>
              `- ${team.name} (id ${team.id}, zawodników: ${team.playersCount}` +
              `${team.groupId ? `, ${groupNames.get(team.groupId) ?? `grupa ${team.groupId}`}` : ''})`,
          ),
          `Panel: ${panelUrl}`,
        ].join('\n');

        return success(
          {
            id: tournament.id,
            name: tournament.name,
            slug: tournament.slug,
            status: tournament.status,
            format,
            sport: { code: tournament.sport.code, name: tournament.sport.name, allowsDraw: tournament.sport.allowsDraw },
            settings,
            stages: stages.map(stageView),
            teams: teams.map((team) => ({
              id: team.id,
              name: team.name,
              groupId: team.groupId,
              playersCount: team.playersCount,
            })),
            panelUrl,
          },
          text,
        );
      }),
  );

  server.registerTool(
    'create_tournament',
    {
      title: 'Załóż turniej',
      description:
        'Zakłada nowy turniej jako szkic, niewidoczny publicznie. Format wybiera się raz, przy założeniu: ' +
        'league (liga, każdy z każdym), knockout (puchar w drabince) albo groups_playoff (faza grupowa, ' +
        'a po niej puchar). Każde wywołanie zakłada osobny turniej. Ustawienia (punktacja, długość meczu) ' +
        'biorą się z domyślnych dla sportu. Zwraca id turnieju, jego fazy z id i link do panelu.',
      inputSchema: {
        name: z.string().min(1).max(160).describe('Nazwa turnieju, np. „Liga Osiedlowa 2026”.'),
        sport: z
          .string()
          .describe('Kod sportu z list_sports: football (piłka nożna), basketball (koszykówka), volleyball (siatkówka).'),
        format: z.enum(['league', 'knockout', 'groups_playoff']).describe('Format turnieju; później się go nie zmienia.'),
      },
      outputSchema: {
        id: z.number(),
        name: z.string(),
        status: z.string(),
        format: z.enum(['league', 'knockout', 'groups_playoff']),
        stages: z.array(stageSchema),
        panelUrl: z.string(),
      },
      annotations: { title: 'Załóż turniej', ...ADD },
    },
    ({ name, sport, format }) =>
      run(async () => {
        const sports = await fetchSports();
        const sportId = sports.find((candidate) => candidate.code === sport)?.id;
        if (sportId === undefined) {
          const codes = sports.map((candidate) => candidate.code).join(', ');
          throw new ToolFailure(`Nie ma sportu o kodzie „${sport}”. Dostępne kody: ${codes}.`);
        }

        const tournament = unwrap(
          await session.request((api) => api.POST('/tournaments', { body: { name, sportId, format } })),
        ).data;
        const stages = await stagesOf(session, tournament.id);
        const panelUrl = panelLink(config, tournament.id);

        return success(
          { id: tournament.id, name: tournament.name, status: tournament.status, format, stages: stages.map(stageView), panelUrl },
          [
            `Założono szkic turnieju „${tournament.name}” (id ${tournament.id}), format: ${FORMATS[format]}.`,
            'Fazy:',
            ...stages.map(stageLine),
            `Panel: ${panelUrl}`,
          ].join('\n'),
        );
      }),
  );

  server.registerTool(
    'update_tournament',
    {
      title: 'Zmień ustawienia turnieju',
      description:
        'Zmienia ustawienia turnieju. Zmienia tylko podane pola, reszta zostaje. Sportu ani formatu zmienić się ' +
        'nie da; status zmienia set_tournament_status. Punktację podaje się w całości. Format setów (tylko ' +
        'siatkówka) blokuje się po wpisaniu pierwszego wyniku seta. Zwraca ustawienia po zmianie.',
      inputSchema: {
        tournamentId: id('Id turnieju.'),
        name: z.string().min(1).max(160).optional().describe('Nowa nazwa.'),
        slug: z
          .string()
          .min(1)
          .optional()
          .describe('Fragment adresu strony publicznej, unikalny w całej aplikacji, np. „liga-osiedlowa-2026”.'),
        matchDuration: z.number().int().min(10).max(600).optional().describe('Długość meczu w minutach (10–600).'),
        periods: z
          .object({
            count: z.number().int().min(1).max(10).describe('Liczba części gry (połowy, kwarty).'),
            minutes: z.number().int().nullable().describe('Minuty jednej części; null, gdy części nie mierzy się czasem.'),
          })
          .optional(),
        setFormat: setFormatSchema
          .optional()
          .describe('Tylko sport grany na sety: ile setów do wygranej, do ilu punktów set i set decydujący, minimalna przewaga.'),
        primaryColor: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional()
          .describe('Kolor turnieju na stronie publicznej, #RRGGBB.'),
        registrationOpen: z.boolean().optional().describe('Czy drużyny mogą zgłaszać się przez stronę publiczną.'),
        registrationDeadline: localDateTime
          .nullable()
          .optional()
          .describe('Koniec zapisów, czas warszawski „YYYY-MM-DD HH:MM”; null usuwa termin.'),
        points: pointsSchema
          .optional()
          .describe(
            'Punkty w tabeli za wygraną, remis i porażkę. W siatkówce także winDecidingSet i lossDecidingSet ' +
              '(mecz rozstrzygnięty w secie decydującym).',
          ),
        tiebreakers: z
          .array(tiebreakerCode)
          .min(1)
          .optional()
          .describe('Kolejność kryteriów przy równej liczbie punktów; dostępne kody dla sportu zwraca list_sports.'),
      },
      outputSchema: { id: z.number(), name: z.string(), slug: z.string(), settings: settingsSchema },
      annotations: { title: 'Zmień ustawienia turnieju', ...EDIT },
    },
    ({ tournamentId, primaryColor, registrationOpen, registrationDeadline, ...fields }) =>
      run(async () => {
        const body: TournamentUpdate = { ...fields };
        if (primaryColor !== undefined) {
          body.branding = { primaryColor };
        }
        if (registrationOpen !== undefined || registrationDeadline !== undefined) {
          body.registration = {};
          if (registrationOpen !== undefined) {
            body.registration.open = registrationOpen;
          }
          if (registrationDeadline !== undefined) {
            body.registration.deadline =
              registrationDeadline === null ? null : warsawDateTime(...splitLocal(registrationDeadline));
          }
        }
        const changed = Object.keys(body);
        if (changed.length === 0) {
          throw new ToolFailure('Nie podano żadnego pola do zmiany.');
        }

        const tournament = unwrap(
          await session.request((api) =>
            api.PATCH('/tournaments/{tournament}', { params: { path: { tournament: tournamentId } }, body }),
          ),
        ).data;

        return success(
          { id: tournament.id, name: tournament.name, slug: tournament.slug, settings: settingsOf(tournament) },
          `Zapisano zmiany w turnieju „${tournament.name}” (id ${tournament.id}): ${changed.join(', ')}.`,
        );
      }),
  );

  server.registerTool(
    'set_tournament_status',
    {
      title: 'Zmień status turnieju',
      description:
        'Ustawia status turnieju. active publikuje turniej: staje się widoczny na stronie publicznej pod swoim ' +
        'slugiem, a przy otwartych zapisach drużyny mogą się zgłaszać. finished oznacza turniej jako zakończony; ' +
        'to deklaracja, która niczego nie blokuje. draft chowa turniej z powrotem, ale API odmawia, gdy jakiś ' +
        'mecz już się zaczął.',
      inputSchema: {
        tournamentId: id('Id turnieju.'),
        status: z.enum(['draft', 'active', 'finished']).describe('draft = szkic, active = opublikowany i trwa, finished = zakończony.'),
      },
      outputSchema: { id: z.number(), name: z.string(), slug: z.string(), status: z.enum(['draft', 'active', 'finished']) },
      annotations: { title: 'Zmień status turnieju', ...EDIT },
    },
    ({ tournamentId, status }) =>
      run(async () => {
        const tournament = unwrap(
          await session.request((api) =>
            api.PATCH('/tournaments/{tournament}', { params: { path: { tournament: tournamentId } }, body: { status } }),
          ),
        ).data;
        const effect: Record<TournamentStatus, string> = {
          draft: 'Turniej jest szkicem i nie jest widoczny publicznie.',
          active: `Turniej jest opublikowany i widoczny na stronie publicznej (slug ${tournament.slug}).`,
          finished: 'Turniej jest oznaczony jako zakończony i dalej widoczny publicznie.',
        };
        return success(
          { id: tournament.id, name: tournament.name, slug: tournament.slug, status: tournament.status },
          `„${tournament.name}” (id ${tournament.id}): status ${STATUS_LABELS[tournament.status]}. ${effect[tournament.status]}`,
        );
      }),
  );

  server.registerTool(
    'delete_tournament',
    {
      title: 'Usuń turniej',
      description:
        'Usuwa turniej na stałe razem z fazami, meczami, drużynami, zawodnikami, obiektami i zgłoszeniami. ' +
        'Tego nie da się cofnąć. API odmawia, gdy jakiś mecz turnieju trwa albo się zakończył.',
      inputSchema: { tournamentId: id('Id turnieju do usunięcia.') },
      outputSchema: { id: z.number(), name: z.string() },
      annotations: { title: 'Usuń turniej', ...EDIT },
    },
    ({ tournamentId }) =>
      run(async () => {
        const tournament = await fetchTournament(tournamentId);
        ensureOk(
          await session.request((api) =>
            api.DELETE('/tournaments/{tournament}', { params: { path: { tournament: tournamentId } } }),
          ),
        );
        return success(
          { id: tournament.id, name: tournament.name },
          `Usunięto turniej „${tournament.name}” (id ${tournament.id}) ze wszystkimi danymi.`,
        );
      }),
  );

  server.registerTool(
    'get_standings',
    {
      title: 'Tabela',
      description:
        'Zwraca tabele turnieju: jedną dla ligi albo po jednej na grupę. Faza pucharowa tabeli nie ma. Wiersz ' +
        'to pozycja, drużyna, mecze, zwycięstwa, remisy, porażki, zdobyte i stracone (gole, punkty albo sety ' +
        'zależnie od sportu) i punkty. Tabela liczy się z meczów zakończonych.',
      inputSchema: {
        tournamentId: id('Id turnieju.'),
        groupId: id('Tylko tabela tej grupy (id z get_tournament).').optional(),
      },
      outputSchema: {
        tables: z.array(
          z.object({
            stageId: z.number(),
            stageName: z.string(),
            groupId: z.number().nullable(),
            groupName: z.string().nullable(),
            scoreLabel: z.string().describe('Co liczą kolumny zdobytych i straconych, np. „Bramki”.'),
            rows: z.array(
              z.object({
                position: z.number(),
                team: z.object({ id: z.number(), name: z.string() }),
                played: z.number(),
                won: z.number(),
                drawn: z.number(),
                lost: z.number(),
                scoreFor: z.number(),
                scoreAgainst: z.number(),
                points: z.number(),
              }),
            ),
          }),
        ),
      },
      annotations: { title: 'Tabela', ...READ },
    },
    ({ tournamentId, groupId }) =>
      run(async () => {
        const all = unwrap(
          await session.request((api) =>
            api.GET('/tournaments/{tournament}/standings', { params: { path: { tournament: tournamentId } } }),
          ),
        ).data;
        const selected = groupId === undefined ? all : all.filter((table) => table.groupId === groupId);
        if (groupId !== undefined && selected.length === 0) {
          throw new ToolFailure(`Turniej ${tournamentId} nie ma tabeli grupy ${groupId}. Id grup zwraca get_tournament.`);
        }
        const tables = selected.map((table) => ({
          stageId: table.stageId,
          stageName: table.stageName,
          groupId: table.groupId,
          groupName: table.groupName,
          scoreLabel: table.scoreLabel,
          rows: table.rows.map((row) => ({
            position: row.position,
            team: { id: row.team.id, name: row.team.name },
            played: row.played,
            won: row.won,
            drawn: row.drawn,
            lost: row.lost,
            scoreFor: row.scoreFor,
            scoreAgainst: row.scoreAgainst,
            points: row.points,
          })),
        }));
        if (tables.length === 0) {
          return success({ tables }, 'Turniej nie ma tabeli: ma tylko fazę pucharową.');
        }
        const text = tables
          .map((table) =>
            [
              `${table.groupName ?? table.stageName} (M, Z-R-P, ${table.scoreLabel.toLowerCase()}, pkt):`,
              ...table.rows.map(
                (row) =>
                  `${row.position}. ${row.team.name}: ${row.played}, ${row.won}-${row.drawn}-${row.lost}, ` +
                  `${row.scoreFor}:${row.scoreAgainst}, ${row.points} pkt`,
              ),
            ].join('\n'),
          )
          .join('\n\n');
        return success({ tables }, text);
      }),
  );

  server.registerTool(
    'get_leaderboard',
    {
      title: 'Klasyfikacja zawodników',
      description:
        'Zwraca klasyfikację zawodników według jednej statystyki, np. goli. Dostępne statystyki sportu zwraca ' +
        'list_sports. Działa tylko dla turnieju opublikowanego (active albo finished), bo klasyfikację liczy ' +
        'strona publiczna; dla szkicu zwraca błąd.',
      inputSchema: {
        tournamentId: id('Id turnieju.'),
        stat: z.string().optional().describe('Kod statystyki z list_sports; bez tego pola pierwsza statystyka sportu.'),
        limit: z.number().int().min(1).max(100).default(10).describe('Ilu zawodników z czołówki zwrócić.'),
      },
      outputSchema: {
        stat: z.string(),
        label: z.string(),
        rows: z.array(
          z.object({
            position: z.number(),
            player: z.object({ id: z.number(), name: z.string() }),
            team: z.object({ id: z.number(), name: z.string() }),
            value: z.number(),
          }),
        ),
      },
      annotations: { title: 'Klasyfikacja zawodników', ...READ },
    },
    ({ tournamentId, stat, limit }) =>
      run(async () => {
        const tournament = await fetchTournament(tournamentId);
        if (tournament.status === 'draft') {
          throw new ToolFailure(
            `Turniej „${tournament.name}” jest szkicem, a klasyfikację zawodników liczy tylko strona publiczna ` +
              'turnieju opublikowanego.',
          );
        }
        const board = unwrap(
          await session.request((api) =>
            api.GET('/public/t/{slug}/leaderboard', {
              params: { path: { slug: tournament.slug }, query: stat === undefined ? {} : { stat } },
            }),
          ),
        ).data;
        const rows = board.rows.slice(0, limit).map((row) => ({
          position: row.position,
          player: { id: row.player.id, name: row.player.name },
          team: { id: row.team.id, name: row.team.name },
          value: row.value,
        }));
        const lines = rows.map((row) => `${row.position}. ${row.player.name} (${row.team.name}): ${row.value}`);
        return success(
          { stat: board.stat, label: board.label, rows },
          [`${board.label}:`, ...(lines.length > 0 ? lines : ['Nikt jeszcze nie ma wpisanej tej statystyki.'])].join('\n'),
        );
      }),
  );
}

/** „2026-11-01 18:00” → ['2026-11-01', '18:00'] dla `warsawDateTime`. */
export function splitLocal(local: string): [string, string] {
  const [day, time] = local.split(' ');
  return [day, time];
}
