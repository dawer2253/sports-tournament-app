import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { type AdminMatch, isValidationError, type Stage, type StageType } from '@tournament/api-client';
import * as z from 'zod/v4';
import { type Session, ToolFailure, unwrap } from '../api.ts';
import type { Config } from '../config.ts';
import { warsawLocal } from '../time.ts';

/** To, czego potrzebuje każdy moduł narzędzi: serwer do rejestracji, sesja API i adresy. */
export interface ToolKit {
  server: McpServer;
  session: Session;
  config: Config;
}

/**
 * Podpowiedzi dla klienta wg specyfikacji MCP. Wszystkie narzędzia działają
 * w zamkniętej domenie naszego API, więc `openWorldHint` jest zawsze `false`.
 * „Destrukcyjne” znaczy tu: nadpisuje albo usuwa, także przy zwykłej edycji.
 */
export const READ: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };
export const ADD: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};
/** Nadpisuje wartości, a ponowienie z tymi samymi danymi niczego więcej nie zmienia. */
export const EDIT: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};
/** Usunięcie: destrukcyjne, a ponowienie niczego już nie zmienia (API odpowie 404). */
export const REMOVE: ToolAnnotations = EDIT;
/** Zastępuje całość i za każdym razem daje inny wynik (losowanie). */
export const REPLACE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  openWorldHint: false,
};

/** Wynik narzędzia: dane dla agenta w `structuredContent` i to samo zdaniami w `content`. */
export function success(structured: Record<string, unknown>, text: string): CallToolResult {
  return { structuredContent: structured, content: [{ type: 'text', text }] };
}

export function failure(text: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text }] };
}

/** Zamienia `ToolFailure` na `isError`; inne wyjątki zostawia SDK. */
export async function run(handler: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof ToolFailure) {
      return failure(error.message);
    }
    throw error;
  }
}

/**
 * Dla odpowiedzi bez treści (`204` przy usuwaniu): `openapi-fetch` nie daje
 * wtedy `data`, więc `unwrap` uznałby sukces za błąd.
 */
export function ensureOk(result: { error?: unknown; response: Response }): void {
  if (!result.response.ok) {
    unwrap(result);
  }
}

/** Wynik zapisu, którego 422 ma trafić do raportu paczki, a nie przerwać narzędzie. */
export function rejection(result: { error?: unknown; response: Response }): string | null {
  return result.response.status === 422 && isValidationError(result.error) ? result.error.message : null;
}

export const id = (what: string) => z.number().int().positive().describe(what);

/** Lokalny czas warszawski w tym samym zapisie, w jakim narzędzia go oddają. */
export const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d$/, 'Zapis „YYYY-MM-DD HH:MM”, np. „2026-11-01 18:00”.');

export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Zapis „YYYY-MM-DD”, np. „2026-11-01”.');

export const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Zapis „HH:MM”, np. „18:00”.');

export const panelLink = (config: Config, tournamentId: number, page = '') =>
  `${config.panelUrl}/tournaments/${tournamentId}${page ? `/${page}` : ''}`;

export async function stagesOf(session: Session, tournamentId: number): Promise<Stage[]> {
  return unwrap(
    await session.request((api) =>
      api.GET('/tournaments/{tournament}/stages', { params: { path: { tournament: tournamentId } } }),
    ),
  ).data;
}

const STAGE_NAMES: Record<StageType, string> = {
  league: 'fazy ligowej',
  group: 'fazy grupowej',
  knockout: 'fazy pucharowej',
};

/** Faza danego typu albo błąd, który mówi, jakie fazy turniej ma. */
export async function stageOfType(session: Session, tournamentId: number, types: StageType[]): Promise<Stage> {
  const stages = await stagesOf(session, tournamentId);
  const stage = stages.find((candidate) => types.includes(candidate.type));
  if (!stage) {
    const wanted = types.map((type) => STAGE_NAMES[type]).join(' ani ');
    const has = stages.map((candidate) => `${candidate.name} (${candidate.type})`).join(', ') || 'żadnych';
    throw new ToolFailure(`Turniej ${tournamentId} nie ma ${wanted}. Jego fazy: ${has}.`);
  }
  return stage;
}

/** Wszystkie mecze fazy, strona po stronie (200 to maksimum API na stronę). */
export async function stageMatches(session: Session, tournamentId: number, stageId: number): Promise<AdminMatch[]> {
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

const TBD = 'do ustalenia';

/** Wynik do zdania: „2:1”, „1:1, karne 4:3”, „3:1 (25:20, 23:25, 25:18, 25:22)”. */
export function scoreText(match: AdminMatch): string | null {
  if (match.homeScore === null || match.awayScore === null) {
    return null;
  }
  let text = `${match.homeScore}:${match.awayScore}`;
  if (match.sets && match.sets.length > 0) {
    text += ` (${match.sets.map((set) => `${set.home}:${set.away}`).join(', ')})`;
  }
  if (match.homePenalties !== null && match.awayPenalties !== null) {
    text += `, karne ${match.homePenalties}:${match.awayPenalties}`;
  }
  return text;
}

const STATUS_LABELS: Record<AdminMatch['status'], string> = {
  scheduled: 'zaplanowany',
  live: 'trwa',
  finished: 'zakończony',
};

/** Mecz w kształcie, który narzędzia oddają agentowi. */
export function matchView(match: AdminMatch) {
  return {
    id: match.id,
    stageId: match.stageId,
    groupId: match.groupId,
    round: match.round.name,
    roundId: match.round.id,
    matchNumber: match.matchNumber,
    home: match.homeTeam ? { id: match.homeTeam.id, name: match.homeTeam.name } : null,
    away: match.awayTeam ? { id: match.awayTeam.id, name: match.awayTeam.name } : null,
    status: match.status,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    sets: match.sets,
    homePenalties: match.homePenalties,
    awayPenalties: match.awayPenalties,
    kickoff: match.kickoffAt ? warsawLocal(match.kickoffAt) : null,
    venue: match.venue ? { id: match.venue.id, name: match.venue.name } : null,
  };
}

const teamRef = z.object({ id: z.number(), name: z.string() }).nullable();

export const matchSchema = z.object({
  id: z.number(),
  stageId: z.number(),
  groupId: z.number().nullable(),
  round: z.string(),
  roundId: z.number(),
  matchNumber: z.number(),
  home: teamRef,
  away: teamRef,
  status: z.enum(['scheduled', 'live', 'finished']),
  homeScore: z.number().nullable(),
  awayScore: z.number().nullable(),
  sets: z.array(z.object({ home: z.number(), away: z.number() })).nullable(),
  homePenalties: z.number().nullable(),
  awayPenalties: z.number().nullable(),
  kickoff: z.string().nullable().describe('Czas warszawski, „YYYY-MM-DD HH:MM”.'),
  venue: z.object({ id: z.number(), name: z.string() }).nullable(),
});

/** Mecz jednym wierszem: „#41 Kolejka 2: Wilki – Sokoły 2:1, zakończony, 2026-11-08 18:00, Orlik”. */
export function matchLine(match: AdminMatch): string {
  const pair = `${match.homeTeam?.name ?? TBD} – ${match.awayTeam?.name ?? TBD}`;
  const parts = [`#${match.id} ${match.round.name}: ${pair}`];
  const score = scoreText(match);
  const details = [score, STATUS_LABELS[match.status]].filter(Boolean).join(', ');
  const when = match.kickoffAt ? warsawLocal(match.kickoffAt) : 'termin do ustalenia';
  parts.push(details, when);
  if (match.venue) {
    parts.push(match.venue.name);
  }
  return parts.join(', ');
}

/** Tasowanie Fishera–Yatesa na `crypto`, bo losowania nie robi ani backend, ani model. */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const pick = randomBelow(index + 1);
    [result[index], result[pick]] = [result[pick], result[index]];
  }
  return result;
}

function randomBelow(limit: number): number {
  // Odrzucanie wartości z niepełnego ostatniego przedziału, żeby nie faworyzować początku listy.
  const ceiling = Math.floor(0x1_0000_0000 / limit) * limit;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= ceiling);
  return buffer[0] % limit;
}

/** Liczba z rzeczownikiem w polskiej odmianie: 1 mecz, 2 mecze, 5 meczów, 22 mecze, 12 meczów. */
export function plural(count: number, one: string, few: string, many: string): string {
  const tens = count % 100;
  const units = count % 10;
  const word = count === 1 ? one : units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many;
  return `${count} ${word}`;
}
