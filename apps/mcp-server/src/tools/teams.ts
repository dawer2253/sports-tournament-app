import type { Player } from '@tournament/api-client';
import * as z from 'zod/v4';
import { ToolFailure, unwrap } from '../api.ts';
import { addEach, rejectedSchema } from './batch.ts';
import { ADD, EDIT, ensureOk, id, READ, REMOVE, run, success, type ToolKit } from './kit.ts';

const playerSchema = z.object({
  id: z.number(),
  name: z.string(),
  number: z.number().nullable(),
  position: z.string().nullable(),
});

function playerView(player: Player) {
  return { id: player.id, name: player.name, number: player.number, position: player.position };
}

function playerLine(player: z.infer<typeof playerSchema>): string {
  const extras = [`id ${player.id}`];
  if (player.number !== null) {
    extras.push(`nr ${player.number}`);
  }
  if (player.position !== null) {
    extras.push(player.position);
  }
  return `${player.name} (${extras.join(', ')})`;
}

const playerNumber = z.number().int().min(0).max(999).nullable();
const playerPosition = z.string().max(60).nullable();

export function registerTeamTools({ server, session }: ToolKit): void {
  server.registerTool(
    'add_teams',
    {
      title: 'Dodaj drużyny',
      description:
        'Dodaje drużyny do turnieju po kolei. Drużynę odrzuconą przez API (np. nazwa już zajęta w turnieju) ' +
        'pomija i idzie dalej; w wyniku są dodane drużyny z id i odrzucone z powodem. Błąd, gdy nie dodało żadnej ' +
        'albo gdy API przerwało dodawanie (wtedy wynik mówi, które już weszły). API nie przyjmuje drużyn, ' +
        'gdy w turnieju zaczął się jakiś mecz; limit to 128 drużyn.',
      inputSchema: {
        tournamentId: id('Id turnieju.'),
        names: z.array(z.string().min(1).max(120)).min(1).describe('Nazwy drużyn, każda osobno.'),
      },
      outputSchema: {
        added: z.array(z.object({ id: z.number(), name: z.string() })),
        rejected: rejectedSchema,
      },
      annotations: { title: 'Dodaj drużyny', ...ADD },
    },
    ({ tournamentId, names }) =>
      run(() =>
        addEach({
          items: names,
          noun: 'Drużyny',
          label: (name) => name,
          send: (name) =>
            session.request((api) =>
              api.POST('/tournaments/{tournament}/teams', {
                params: { path: { tournament: tournamentId } },
                body: { name },
              }),
            ),
          view: (team) => ({ id: team.id, name: team.name }),
          line: (team) => `${team.name} (id ${team.id})`,
        }),
      ),
  );

  server.registerTool(
    'update_team',
    {
      title: 'Zmień nazwę drużyny',
      description: 'Zmienia nazwę drużyny. Nazwa musi być unikalna w turnieju.',
      inputSchema: {
        teamId: id('Id drużyny (z get_tournament).'),
        name: z.string().min(1).max(120).describe('Nowa nazwa.'),
      },
      outputSchema: { id: z.number(), name: z.string() },
      annotations: { title: 'Zmień nazwę drużyny', ...EDIT },
    },
    ({ teamId, name }) =>
      run(async () => {
        const team = unwrap(
          await session.request((api) => api.PATCH('/teams/{team}', { params: { path: { team: teamId } }, body: { name } })),
        ).data;
        return success({ id: team.id, name: team.name }, `Drużyna ${team.id} nazywa się teraz „${team.name}”.`);
      }),
  );

  server.registerTool(
    'delete_team',
    {
      title: 'Usuń drużynę',
      description:
        'Usuwa drużynę z turnieju razem z jej zawodnikami. Kasuje też jej mecze zaplanowane, więc w kolejkach ' +
        'zostają luki; w fazie pucharowej znika cała drabinka do ponownego wygenerowania. API odmawia, gdy ' +
        'drużyna ma mecz trwający albo zakończony (w pucharze: gdy jakikolwiek mecz drabinki się zaczął).',
      inputSchema: { teamId: id('Id drużyny do usunięcia.') },
      outputSchema: { id: z.number(), name: z.string(), removedScheduledMatches: z.number() },
      annotations: { title: 'Usuń drużynę', ...REMOVE },
    },
    ({ teamId }) =>
      run(async () => {
        const team = unwrap(
          await session.request((api) => api.GET('/teams/{team}', { params: { path: { team: teamId } } })),
        ).data;
        ensureOk(await session.request((api) => api.DELETE('/teams/{team}', { params: { path: { team: teamId } } })));
        return success(
          { id: team.id, name: team.name, removedScheduledMatches: team.scheduledMatchesCount },
          `Usunięto drużynę „${team.name}” (id ${team.id}) z zawodnikami. ` +
            `Zniknęło jej meczów zaplanowanych: ${team.scheduledMatchesCount}.`,
        );
      }),
  );

  server.registerTool(
    'list_players',
    {
      title: 'Zawodnicy drużyny',
      description: 'Zwraca zawodników drużyny: id, imię i nazwisko, numer na koszulce i pozycję.',
      inputSchema: { teamId: id('Id drużyny (z get_tournament).') },
      outputSchema: { players: z.array(playerSchema) },
      annotations: { title: 'Zawodnicy drużyny', ...READ },
    },
    ({ teamId }) =>
      run(async () => {
        const players = unwrap(
          await session.request((api) => api.GET('/teams/{team}/players', { params: { path: { team: teamId } } })),
        ).data.map(playerView);
        const text =
          players.length === 0
            ? `Drużyna ${teamId} nie ma zawodników.`
            : [`Zawodnicy drużyny ${teamId} (${players.length}):`, ...players.map((player) => `- ${playerLine(player)}`)].join('\n');
        return success({ players }, text);
      }),
  );

  server.registerTool(
    'add_players',
    {
      title: 'Dodaj zawodników',
      description:
        'Dodaje zawodników do jednej drużyny po kolei. Zawodnika odrzuconego przez API (np. numer zajęty ' +
        'w drużynie) pomija i idzie dalej; w wyniku są dodani z id i odrzuceni z powodem. Błąd, gdy nie dodało ' +
        'nikogo albo gdy API przerwało dodawanie (wtedy wynik mówi, kto już wszedł). Drużyna ma najwyżej 50 zawodników.',
      inputSchema: {
        teamId: id('Id drużyny (z get_tournament).'),
        players: z
          .array(
            z.object({
              name: z.string().min(1).max(120).describe('Imię i nazwisko.'),
              number: playerNumber.optional().describe('Numer na koszulce 0–999, unikalny w drużynie.'),
              position: playerPosition.optional().describe('Pozycja dowolnym tekstem, np. „bramkarz”.'),
            }),
          )
          .min(1),
      },
      outputSchema: { added: z.array(playerSchema), rejected: rejectedSchema },
      annotations: { title: 'Dodaj zawodników', ...ADD },
    },
    ({ teamId, players }) =>
      run(() =>
        addEach({
          items: players,
          noun: 'Zawodnicy',
          label: (player) => (player.number == null ? player.name : `${player.name} (nr ${player.number})`),
          send: (player) =>
            session.request((api) =>
              api.POST('/teams/{team}/players', {
                params: { path: { team: teamId } },
                body: { name: player.name, number: player.number ?? null, position: player.position ?? null },
              }),
            ),
          view: playerView,
          line: playerLine,
        }),
      ),
  );

  server.registerTool(
    'update_player',
    {
      title: 'Zmień dane zawodnika',
      description:
        'Zmienia imię i nazwisko, numer albo pozycję zawodnika. Zmienia tylko podane pola; null czyści numer ' +
        'albo pozycję.',
      inputSchema: {
        playerId: id('Id zawodnika (z list_players).'),
        name: z.string().min(1).max(120).optional(),
        number: playerNumber.optional().describe('Numer 0–999, unikalny w drużynie; null usuwa numer.'),
        position: playerPosition.optional().describe('Pozycja; null ją usuwa.'),
      },
      outputSchema: playerSchema.shape,
      annotations: { title: 'Zmień dane zawodnika', ...EDIT },
    },
    ({ playerId, ...fields }) =>
      run(async () => {
        if (Object.keys(fields).length === 0) {
          throw new ToolFailure('Nie podano żadnego pola do zmiany.');
        }
        const player = playerView(
          unwrap(
            await session.request((api) =>
              api.PATCH('/players/{player}', { params: { path: { player: playerId } }, body: fields }),
            ),
          ).data,
        );
        return success(player, `Zapisano zawodnika: ${playerLine(player)}.`);
      }),
  );

  server.registerTool(
    'delete_player',
    {
      title: 'Usuń zawodnika',
      description:
        'Usuwa zawodnika z drużyny. API odmawia, gdy zawodnik ma zdarzenia (gole, kartki) w meczu trwającym ' +
        'albo zakończonym.',
      inputSchema: { playerId: id('Id zawodnika do usunięcia.') },
      outputSchema: { id: z.number() },
      annotations: { title: 'Usuń zawodnika', ...REMOVE },
    },
    ({ playerId }) =>
      run(async () => {
        ensureOk(
          await session.request((api) => api.DELETE('/players/{player}', { params: { path: { player: playerId } } })),
        );
        return success({ id: playerId }, `Usunięto zawodnika ${playerId}.`);
      }),
  );
}
