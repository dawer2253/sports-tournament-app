import type { AdminMatch, MatchEvent, Schemas } from '@tournament/api-client';
import * as z from 'zod/v4';
import { ToolFailure, unwrap } from '../api.ts';
import { warsawDateTime } from '../time.ts';
import { addEach, rejectedSchema } from './batch.ts';
import {
  ADD,
  EDIT,
  ensureOk,
  id,
  localDateTime,
  matchLine,
  matchSchema,
  matchView,
  READ,
  REMOVE,
  run,
  success,
  type ToolKit,
} from './kit.ts';
import { splitLocal } from './tournaments.ts';

const eventSchema = z.object({
  id: z.number(),
  type: z.string(),
  typeLabel: z.string(),
  team: z.object({ id: z.number(), name: z.string() }),
  player: z.object({ id: z.number(), name: z.string() }).nullable(),
  minute: z.number().nullable(),
  addedTime: z.number().nullable(),
});

function eventView(event: MatchEvent) {
  return {
    id: event.id,
    type: event.type,
    typeLabel: event.typeLabel,
    team: { id: event.team.id, name: event.team.name },
    player: event.player ? { id: event.player.id, name: event.player.name } : null,
    minute: event.minute,
    addedTime: event.addedTime,
  };
}

function minuteText(minute: number | null | undefined, addedTime: number | null | undefined): string | null {
  if (minute == null) {
    return null;
  }
  return addedTime ? `${minute}+${addedTime}'` : `${minute}'`;
}

function eventLine(event: z.infer<typeof eventSchema>): string {
  const when = minuteText(event.minute, event.addedTime);
  const who = event.player ? `${event.player.name} (${event.team.name})` : event.team.name;
  return `${event.typeLabel}${when ? ` ${when}` : ''}: ${who}, id ${event.id}`;
}

/** Skąd wziąć typy zdarzeń; opis powtarzają trzy narzędzia. */
const EVENT_TYPE = z
  .string()
  .describe('Kod typu zdarzenia z list_sports, np. goal, own_goal, yellow_card, red_card w piłce nożnej.');

/** Reguła z ADR 0013: kiedy zdarzenie zmienia wynik meczu. */
const SCORE_RULE =
  'W meczu trwającym (live) dodanie, poprawka albo usunięcie zdarzenia punktowanego (gol, samobój, kosz) ' +
  'od razu przesuwa wynik meczu. W meczu zakończonym wynik się nie zmienia i poprawia się go osobno przez ' +
  'set_match_result. W siatkówce zdarzenia nigdy nie zmieniają wyniku, bo wynik to sety.';

type MatchUpdate = Schemas['MatchUpdate'];

const scoreSchema = z.number().int().min(0).max(999);
const penaltiesSchema = z.number().int().min(0).max(99);

export function registerMatchTools({ server, session }: ToolKit): void {
  async function patchMatch(matchId: number, body: MatchUpdate) {
    return session.request((api) => api.PATCH('/matches/{match}', { params: { path: { match: matchId } }, body }));
  }

  /** Mecz po zapisie i zdanie o awansie, gdy wynik zakończył mecz pucharowy. */
  function savedMatch(match: AdminMatch, lead: string) {
    const lines = [`${lead} ${matchLine(match)}.`];
    if (match.status === 'finished' && match.winnerToMatchId !== null) {
      lines.push(`Zwycięzca przechodzi do meczu #${match.winnerToMatchId}.`);
    }
    if (match.status === 'finished' && match.loserToMatchId !== null) {
      lines.push(`Przegrany gra w meczu #${match.loserToMatchId}.`);
    }
    return success(matchView(match), lines.join(' '));
  }

  server.registerTool(
    'list_matches',
    {
      title: 'Mecze turnieju',
      description:
        'Zwraca mecze turnieju po 50 na stronę, w kolejności kolejek i numerów meczów: id, fazę, grupę, ' +
        'kolejkę lub rundę, drużyny, status (scheduled = zaplanowany, live = trwa, finished = zakończony), wynik, ' +
        'sety, karne, termin w czasie warszawskim i obiekt. Mecz pucharowy bez drużyny czeka na zwycięzcę ' +
        'poprzedniej rundy. Można zawęzić do fazy, kolejki i statusu.',
      inputSchema: {
        tournamentId: id('Id turnieju.'),
        stageId: id('Tylko mecze tej fazy (id z get_tournament).').optional(),
        roundId: id('Tylko mecze tej kolejki lub rundy (roundId z wcześniejszego list_matches).').optional(),
        status: z.enum(['scheduled', 'live', 'finished']).optional().describe('Tylko mecze w tym statusie.'),
        page: z.number().int().min(1).default(1).describe('Numer strony, od 1.'),
      },
      outputSchema: {
        matches: z.array(matchSchema),
        page: z.number(),
        lastPage: z.number(),
        total: z.number(),
      },
      annotations: { title: 'Mecze turnieju', ...READ },
    },
    ({ tournamentId, stageId, roundId, status, page }) =>
      run(async () => {
        const result = unwrap(
          await session.request((api) =>
            api.GET('/tournaments/{tournament}/matches', {
              params: { path: { tournament: tournamentId }, query: { stageId, roundId, status, page, perPage: 50 } },
            }),
          ),
        );
        const { currentPage, lastPage, total } = result.meta;
        const header = total === 0 ? 'Brak meczów.' : `Mecze (strona ${currentPage} z ${lastPage}, razem ${total}):`;
        return success(
          { matches: result.data.map(matchView), page: currentPage, lastPage, total },
          [header, ...result.data.map((match) => `- ${matchLine(match)}`)].join('\n'),
        );
      }),
  );

  server.registerTool(
    'update_match',
    {
      title: 'Zmień termin lub obiekt meczu',
      description:
        'Zmienia termin albo obiekt jednego meczu. Zmienia tylko podane pola; null usuwa termin albo obiekt. ' +
        'Drużyn w meczu zmienić się nie da. Kolizje z innymi meczami API tylko zgłasza, nie blokuje zapisu.',
      inputSchema: {
        matchId: id('Id meczu (z list_matches).'),
        kickoff: localDateTime.nullable().optional().describe('Nowy termin, czas warszawski „YYYY-MM-DD HH:MM”.'),
        venueId: z.number().int().nullable().optional().describe('Id obiektu (z list_venues).'),
      },
      outputSchema: matchSchema.shape,
      annotations: { title: 'Zmień termin lub obiekt meczu', ...EDIT },
    },
    ({ matchId, kickoff, venueId }) =>
      run(async () => {
        const body: MatchUpdate = {};
        if (kickoff !== undefined) {
          body.kickoffAt = kickoff === null ? null : warsawDateTime(...splitLocal(kickoff));
        }
        if (venueId !== undefined) {
          body.venueId = venueId;
        }
        if (Object.keys(body).length === 0) {
          throw new ToolFailure('Podaj kickoff albo venueId.');
        }
        const match = unwrap(await patchMatch(matchId, body)).data;
        const collisions =
          match.collisions.length > 0
            ? ` Uwaga, kolizja z meczami: ${match.collisions.map((collision) => `#${collision.matchId} (${collision.type === 'team' ? 'drużyna' : 'obiekt'})`).join(', ')}.`
            : '';
        return success(matchView(match), `Zapisano: ${matchLine(match)}.${collisions}`);
      }),
  );

  server.registerTool(
    'set_match_result',
    {
      title: 'Wpisz wynik meczu',
      description:
        'Wpisuje albo poprawia wynik meczu. Domyślnie kończy mecz (finished); status live zapisuje wynik meczu, ' +
        'który trwa. Piłka nożna i koszykówka: homeScore i awayScore. Siatkówka: sets, a wynik w setach liczy API. ' +
        'Karne tylko w meczu pucharowym zakończonym remisem, i wtedy są wymagane. Sport bez remisów wymaga ' +
        'zwycięzcy. Zakończenie meczu pucharowego przesuwa zwycięzcę do następnej rundy. Zdarzeń meczu ' +
        '(strzelców) to narzędzie nie dodaje.',
      inputSchema: {
        matchId: id('Id meczu (z list_matches).'),
        homeScore: scoreSchema.optional().describe('Gole lub punkty gospodarzy; nie w siatkówce.'),
        awayScore: scoreSchema.optional().describe('Gole lub punkty gości; nie w siatkówce.'),
        sets: z
          .array(z.object({ home: z.number().int().min(0).max(99), away: z.number().int().min(0).max(99) }))
          .min(1)
          .max(5)
          .optional()
          .describe('Tylko siatkówka: punkty w kolejnych setach, np. [{home: 25, away: 20}, …].'),
        homePenalties: penaltiesSchema.optional().describe('Karne gospodarzy, tylko przy remisie w pucharze.'),
        awayPenalties: penaltiesSchema.optional().describe('Karne gości, tylko przy remisie w pucharze.'),
        status: z.enum(['finished', 'live']).default('finished'),
      },
      outputSchema: matchSchema.shape,
      annotations: { title: 'Wpisz wynik meczu', ...EDIT },
    },
    ({ matchId, homeScore, awayScore, sets, homePenalties, awayPenalties, status }) =>
      run(async () => {
        let body: MatchUpdate;
        if (sets !== undefined) {
          if (homeScore !== undefined || awayScore !== undefined || homePenalties !== undefined || awayPenalties !== undefined) {
            throw new ToolFailure('Przy setach podaje się tylko sets: wynik w setach liczy API, a karnych w siatkówce nie ma.');
          }
          body = { status, sets };
        } else {
          if (homeScore === undefined || awayScore === undefined) {
            throw new ToolFailure('Podaj homeScore i awayScore (albo sets w siatkówce).');
          }
          // Karne zawsze jadą w ciele, także jako null: API łączy ciało z zapisanym meczem,
          // więc stare karne zostałyby przy nowym wyniku bez remisu i zablokowały zapis.
          body = {
            status,
            homeScore,
            awayScore,
            homePenalties: homePenalties ?? null,
            awayPenalties: awayPenalties ?? null,
          };
        }
        const match = unwrap(await patchMatch(matchId, body)).data;
        return savedMatch(match, 'Zapisano wynik:');
      }),
  );

  server.registerTool(
    'clear_match_result',
    {
      title: 'Wyczyść wynik meczu',
      description:
        'Cofa mecz do zaplanowanych: usuwa wynik, sety i karne, termin zostaje. W pucharze zdejmuje też ' +
        'zwycięzcę z następnej rundy. API odmawia, gdy mecz ma zdarzenia (najpierw trzeba je usunąć) albo gdy ' +
        'mecz następnej rundy już się zaczął.',
      inputSchema: { matchId: id('Id meczu (z list_matches).') },
      outputSchema: matchSchema.shape,
      annotations: { title: 'Wyczyść wynik meczu', ...EDIT },
    },
    ({ matchId }) =>
      run(async () => {
        // Ciało zależy od sportu, a API nie podaje sportu meczu. Najpierw wersja setowa:
        // w sporcie bez setów API odrzuca ją zawsze i tylko pod kluczem `sets`.
        let result = await patchMatch(matchId, { status: 'scheduled', sets: [] });
        if (result.response.status === 422 && hasError(result.error, 'sets')) {
          result = await patchMatch(matchId, {
            status: 'scheduled',
            homeScore: null,
            awayScore: null,
            homePenalties: null,
            awayPenalties: null,
          });
        }
        return savedMatch(unwrap(result).data, 'Wyczyszczono wynik:');
      }),
  );

  server.registerTool(
    'list_match_events',
    {
      title: 'Zdarzenia meczu',
      description: 'Zwraca zdarzenia meczu (gole, kartki, punkty) w kolejności minut: id, typ, drużynę, zawodnika i minutę.',
      inputSchema: { matchId: id('Id meczu (z list_matches).') },
      outputSchema: { events: z.array(eventSchema) },
      annotations: { title: 'Zdarzenia meczu', ...READ },
    },
    ({ matchId }) =>
      run(async () => {
        const events = unwrap(
          await session.request((api) => api.GET('/matches/{match}/events', { params: { path: { match: matchId } } })),
        ).data.map(eventView);
        const text =
          events.length === 0
            ? `Mecz ${matchId} nie ma zdarzeń.`
            : [`Zdarzenia meczu ${matchId}:`, ...events.map((event) => `- ${eventLine(event)}`)].join('\n');
        return success({ events }, text);
      }),
  );

  server.registerTool(
    'add_match_events',
    {
      title: 'Dodaj zdarzenia meczu',
      description:
        'Dodaje zdarzenia (gole, kartki, punkty) do meczu trwającego albo zakończonego, po kolei. Zdarzenie ' +
        `odrzucone przez API pomija i idzie dalej; w wyniku są dodane z id i odrzucone z powodem. ${SCORE_RULE} ` +
        'Zawodnik musi grać w drużynie zdarzenia; typy z hasPlayer w list_sports go wymagają. Mecz zaplanowany ' +
        'zdarzeń nie przyjmuje.',
      inputSchema: {
        matchId: id('Id meczu (z list_matches).'),
        events: z
          .array(
            z.object({
              type: EVENT_TYPE,
              teamId: z.number().int().describe('Id drużyny, której zdarzenie się liczy (przy samobóju: drużyna strzelca).'),
              playerId: z.number().int().nullable().optional().describe('Id zawodnika (z list_players).'),
              minute: z.number().int().min(1).max(150).nullable().optional().describe('Minuta meczu.'),
              addedTime: z.number().int().min(1).max(30).nullable().optional().describe('Minuta doliczonego czasu, np. 2 dla 45+2.'),
            }),
          )
          .min(1),
      },
      outputSchema: { added: z.array(eventSchema), rejected: rejectedSchema },
      annotations: { title: 'Dodaj zdarzenia meczu', ...ADD },
    },
    ({ matchId, events }) =>
      run(() =>
        addEach({
          items: events,
          noun: 'Zdarzenia',
          label: (event) => [event.type, minuteText(event.minute, event.addedTime)].filter(Boolean).join(' '),
          send: (event) =>
            session.request((api) =>
              api.POST('/matches/{match}/events', {
                params: { path: { match: matchId } },
                body: {
                  type: event.type,
                  teamId: event.teamId,
                  playerId: event.playerId ?? null,
                  minute: event.minute ?? null,
                  ...(event.addedTime != null ? { addedTime: event.addedTime } : {}),
                },
              }),
            ),
          view: eventView,
          line: eventLine,
        }),
      ),
  );

  server.registerTool(
    'update_match_event',
    {
      title: 'Popraw zdarzenie meczu',
      description: `Poprawia zdarzenie meczu: typ, drużynę, zawodnika albo minutę. Zmienia tylko podane pola. ${SCORE_RULE}`,
      inputSchema: {
        eventId: id('Id zdarzenia (z list_match_events).'),
        type: EVENT_TYPE.optional(),
        teamId: z.number().int().optional(),
        playerId: z.number().int().nullable().optional(),
        minute: z.number().int().min(1).max(150).nullable().optional(),
        addedTime: z.number().int().min(1).max(30).nullable().optional(),
      },
      outputSchema: eventSchema.shape,
      annotations: { title: 'Popraw zdarzenie meczu', ...EDIT },
    },
    ({ eventId, ...fields }) =>
      run(async () => {
        if (Object.keys(fields).length === 0) {
          throw new ToolFailure('Nie podano żadnego pola do zmiany.');
        }
        const event = eventView(
          unwrap(
            await session.request((api) =>
              api.PATCH('/match-events/{event}', { params: { path: { event: eventId } }, body: fields }),
            ),
          ).data,
        );
        return success(event, `Zapisano zdarzenie: ${eventLine(event)}.`);
      }),
  );

  server.registerTool(
    'delete_match_event',
    {
      title: 'Usuń zdarzenie meczu',
      description: `Usuwa zdarzenie meczu. ${SCORE_RULE}`,
      inputSchema: { eventId: id('Id zdarzenia (z list_match_events).') },
      outputSchema: { id: z.number() },
      annotations: { title: 'Usuń zdarzenie meczu', ...REMOVE },
    },
    ({ eventId }) =>
      run(async () => {
        ensureOk(
          await session.request((api) => api.DELETE('/match-events/{event}', { params: { path: { event: eventId } } })),
        );
        return success({ id: eventId }, `Usunięto zdarzenie ${eventId}.`);
      }),
  );
}

function hasError(error: unknown, field: string): boolean {
  const errors = (error as { errors?: Record<string, unknown> } | undefined)?.errors;
  return errors !== undefined && field in errors;
}
