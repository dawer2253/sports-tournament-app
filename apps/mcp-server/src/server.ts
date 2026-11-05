import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { AdminMatch } from '@tournament/api-client';
import * as z from 'zod/v4';
import { createSession, type Session, ToolFailure, unwrap } from './api.ts';
import type { Config } from './config.ts';
import { TIME_ZONE, warsawDateTime, warsawLocal, warsawLong } from './time.ts';

/** Wynik narzędzia: dane dla agenta w `structuredContent` i to samo zdaniami w `content`. */
function success(structured: Record<string, unknown>, text: string): CallToolResult {
  return { structuredContent: structured, content: [{ type: 'text', text }] };
}

function failure(text: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text }] };
}

/** Zamienia `ToolFailure` na `isError`; inne wyjątki zostawia SDK. */
async function run(handler: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ToolFailure) {
      return failure(error.message);
    }
    throw error;
  }
}

interface ScheduledRound {
  name: string;
  matches: Array<{ home: string; away: string; kickoff: string | null }>;
}

/** Mecze przychodzą posortowane po kolejce i numerze meczu, więc wystarczy je pociąć. */
function groupByRound(matches: AdminMatch[]): Array<ScheduledRound & { startsAt: string | null }> {
  const rounds = new Map<number, ScheduledRound & { startsAt: string | null }>();
  for (const match of matches) {
    let round = rounds.get(match.round.id);
    if (!round) {
      round = { name: match.round.name, matches: [], startsAt: match.kickoffAt };
      rounds.set(match.round.id, round);
    }
    round.matches.push({
      home: match.homeTeam?.name ?? 'do ustalenia',
      away: match.awayTeam?.name ?? 'do ustalenia',
      kickoff: match.kickoffAt ? warsawLocal(match.kickoffAt) : null,
    });
  }
  return [...rounds.values()];
}

function describeRound(round: ScheduledRound & { startsAt: string | null }): string {
  const when = round.startsAt ? warsawLong(round.startsAt) : 'termin do ustalenia';
  return [`${round.name}, ${when}:`, ...round.matches.map((match) => `- ${match.home} – ${match.away}`)].join('\n');
}

/** Serwer MCP z trzema narzędziami. Sesję API można podać z zewnątrz, żeby zalogować się przed startem. */
export function createServer(config: Config, session: Session = createSession(config)): McpServer {
  const server = new McpServer({ name: 'tournament', version: '0.0.0' });

  async function leagueStageId(tournamentId: number): Promise<number> {
    const stages = unwrap(
      await session.request((api) =>
        api.GET('/tournaments/{tournament}/stages', { params: { path: { tournament: tournamentId } } }),
      ),
    ).data;
    const league = stages.find((stage) => stage.type === 'league');
    if (!league) {
      throw new ToolFailure(`Turniej ${tournamentId} nie ma fazy ligi, więc to narzędzie nie ułoży mu terminarza.`);
    }
    return league.id;
  }

  /** Wszystkie mecze fazy, strona po stronie (200 mieści ligę 8 drużyn z rewanżami w jednej). */
  async function stageMatches(tournamentId: number, stageId: number): Promise<AdminMatch[]> {
    const matches: AdminMatch[] = [];
    for (let page = 1; ; page++) {
      const result = unwrap(
        await session.request((api) =>
          api.GET('/tournaments/{tournament}/matches', {
            params: { path: { tournament: tournamentId }, query: { stageId, perPage: 200, page } },
          }),
        ),
      );
      matches.push(...result.data);
      if (result.meta.currentPage >= result.meta.lastPage) {
        return matches;
      }
    }
  }

  server.registerTool(
    'create_tournament',
    {
      title: 'Załóż ligę',
      description:
        'Zakłada nowy turniej w formacie ligi (każdy z każdym) jako szkic, niewidoczny publicznie. ' +
        'Wywołaj raz na ligę. Jeśli turniej już powstał w tej rozmowie, kontynuuj z jego id zamiast zakładać kolejny. ' +
        'Zwraca id turnieju, id fazy ligi i link do turnieju w panelu.',
      inputSchema: {
        name: z.string().describe('Nazwa turnieju, np. „Liga Osiedlowa 2026”.'),
        sport: z.string().describe('Kod sportu: football (piłka nożna), basketball (koszykówka) albo volleyball (siatkówka).'),
      },
      outputSchema: {
        id: z.number(),
        name: z.string(),
        stageId: z.number(),
        status: z.string(),
        panelUrl: z.string(),
      },
      annotations: { destructiveHint: false },
    },
    ({ name, sport }) =>
      run(async () => {
        const sports = unwrap(await session.request((api) => api.GET('/sports'))).data;
        const sportId = sports.find((candidate) => candidate.code === sport)?.id;
        if (sportId === undefined) {
          const codes = sports.map((candidate) => candidate.code).join(', ');
          throw new ToolFailure(`Nie ma sportu o kodzie „${sport}”. Dostępne kody: ${codes}.`);
        }

        const tournament = unwrap(
          await session.request((api) => api.POST('/tournaments', { body: { name, sportId, format: 'league' } })),
        ).data;
        const stageId = await leagueStageId(tournament.id);
        const panelUrl = `${config.panelUrl}/tournaments/${tournament.id}`;

        return success(
          { id: tournament.id, name: tournament.name, stageId, status: tournament.status, panelUrl },
          `Założono szkic turnieju „${tournament.name}” (id ${tournament.id}, faza ligi ${stageId}, stan: ${tournament.status}). ` +
            `Panel: ${panelUrl}`,
        );
      }),
  );

  server.registerTool(
    'add_teams',
    {
      title: 'Dodaj drużyny',
      description:
        'Dodaje drużyny do turnieju po kolei. Drużynę odrzuconą przez API (np. nazwa już zajęta) pomija ' +
        'i idzie dalej; w wyniku są dodane drużyny i odrzucone z powodem. Błąd tylko wtedy, gdy nie dodało żadnej.',
      inputSchema: {
        tournamentId: z.number().int().describe('Id turnieju z create_tournament.'),
        names: z.array(z.string()).min(1).describe('Nazwy drużyn, każda osobno.'),
      },
      outputSchema: {
        added: z.array(z.object({ id: z.number(), name: z.string() })),
        rejected: z.array(z.object({ name: z.string(), message: z.string() })),
      },
      annotations: { destructiveHint: false },
    },
    ({ tournamentId, names }) =>
      run(async () => {
        const added: Array<{ id: number; name: string }> = [];
        const rejected: Array<{ name: string; message: string }> = [];
        // Po kolei, nie równolegle: limit drużyn i unikalność nazw sprawdza backend
        // przy każdym zapisie, a kolejność na liście ma odpowiadać kolejności w czacie.
        for (const name of names) {
          const result = await session.request((api) =>
            api.POST('/tournaments/{tournament}/teams', {
              params: { path: { tournament: tournamentId } },
              body: { name },
            }),
          );
          if (result.response.status === 422) {
            rejected.push({ name, message: (result.error as { message: string }).message });
            continue;
          }
          const team = unwrap(result).data;
          added.push({ id: team.id, name: team.name });
        }

        const rejectedLines = rejected.map((team) => `- ${team.name}: ${team.message}`);
        if (added.length === 0) {
          return failure(['Nie dodano żadnej drużyny. API odrzuciło:', ...rejectedLines].join('\n'));
        }
        const lines = [`Dodano ${added.length} z ${names.length} drużyn: ${added.map((team) => team.name).join(', ')}.`];
        if (rejected.length > 0) {
          lines.push('Odrzucone:', ...rejectedLines);
        }
        return success({ added, rejected }, lines.join('\n'));
      }),
  );

  server.registerTool(
    'generate_schedule',
    {
      title: 'Wygeneruj terminarz',
      description:
        'Układa terminarz ligi (pary w kolejkach) i nadaje kolejkom daty co intervalDays dni od startDate, ' +
        'w czasie warszawskim. Ponowne wywołanie losuje pary od nowa i nadpisuje cały terminarz. ' +
        'Wywołaj po dodaniu wszystkich drużyn. Turniej zostaje szkicem: publikuje go organizer w panelu.',
      inputSchema: {
        tournamentId: z.number().int().describe('Id turnieju z create_tournament.'),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Dzień pierwszej kolejki, YYYY-MM-DD.'),
        kickoffTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .default('18:00')
          .describe('Godzina meczów kolejki w czasie warszawskim, HH:MM.'),
        intervalDays: z.number().int().default(7).describe('Odstęp między kolejkami w dniach.'),
        meetings: z
          .union([z.literal(1), z.literal(2)])
          .default(1)
          .describe('1 to jedna runda, 2 to mecz i rewanż.'),
      },
      outputSchema: {
        roundsCount: z.number(),
        matchesCount: z.number(),
        rounds: z.array(
          z.object({
            name: z.string(),
            matches: z.array(z.object({ home: z.string(), away: z.string(), kickoff: z.string().nullable() })),
          }),
        ),
        panelUrl: z.string(),
      },
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    ({ tournamentId, startDate, kickoffTime, intervalDays, meetings }) =>
      run(async () => {
        const stageId = await leagueStageId(tournamentId);
        const stage = { params: { path: { stage: stageId } } };

        const generated = unwrap(
          await session.request((api) => api.POST('/stages/{stage}/schedule', { ...stage, body: { meetings } })),
        ).data;
        // Bez `venueIds`: demo nie ma obiektów, więc cała kolejka gra o jednej godzinie.
        unwrap(
          await session.request((api) =>
            api.POST('/stages/{stage}/schedule/dates', {
              ...stage,
              body: {
                mode: 'interval',
                startAt: warsawDateTime(startDate, kickoffTime),
                timeZone: TIME_ZONE,
                intervalDays,
              },
            }),
          ),
        );

        const rounds = groupByRound(await stageMatches(tournamentId, stageId));
        const panelUrl = `${config.panelUrl}/tournaments/${tournamentId}/schedule`;

        return success(
          {
            roundsCount: generated.roundsCount,
            matchesCount: generated.matchesCount,
            rounds: rounds.map(({ name, matches }) => ({ name, matches })),
            panelUrl,
          },
          [
            `Terminarz gotowy: ${generated.roundsCount} kolejek, ${generated.matchesCount} meczów.`,
            ...rounds.map(describeRound),
            `Terminarz w panelu: ${panelUrl}`,
            'Turniej jest szkicem. Organizer przegląda terminarz w panelu i sam publikuje turniej przyciskiem „Opublikuj” w ustawieniach.',
          ].join('\n\n'),
        );
      }),
  );

  return server;
}
