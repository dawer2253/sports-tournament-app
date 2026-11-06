import type { AdminMatch, Stage, Team } from '@tournament/api-client';
import * as z from 'zod/v4';
import { type Session, ToolFailure, unwrap } from '../api.ts';
import { TIME_ZONE, warsawDateTime, warsawLocal, warsawLong } from '../time.ts';
import {
  clock,
  date,
  EDIT,
  id,
  panelLink,
  plural,
  REPLACE,
  run,
  shuffle,
  stageMatches,
  stageOfType,
  stagesOf,
  success,
  type ToolKit,
} from './kit.ts';

/** Powyżej tylu meczów wynik podaje same liczby, żeby nie zalać rozmowy; szczegóły daje list_matches. */
const LISTED_MATCHES_LIMIT = 120;

interface RoundView {
  name: string;
  /** Pierwszy mecz kolejki w czasie warszawskim albo `null`, gdy kolejka nie ma terminu. */
  startsAt: string | null;
  matches: Array<{
    id: number;
    group: string | null;
    home: string;
    away: string;
    kickoff: string | null;
    venue: string | null;
  }>;
}

interface RoundDraft {
  name: string;
  /** Najwcześniejszy termin w kolejce, chwila z API (UTC). */
  firstKickoff: string | null;
  matches: AdminMatch[];
}

/** Mecze przychodzą posortowane po kolejce i numerze meczu, więc wystarczy je pociąć. */
function groupByRound(matches: AdminMatch[]): RoundDraft[] {
  const rounds = new Map<number, RoundDraft>();
  for (const match of matches) {
    let round = rounds.get(match.round.id);
    if (!round) {
      round = { name: match.round.name, firstKickoff: null, matches: [] };
      rounds.set(match.round.id, round);
    }
    // Chwile z API są w UTC w jednym zapisie, więc porównanie napisów porównuje czas.
    if (match.kickoffAt && (round.firstKickoff === null || match.kickoffAt < round.firstKickoff)) {
      round.firstKickoff = match.kickoffAt;
    }
    round.matches.push(match);
  }
  return [...rounds.values()];
}

function roundView(round: RoundDraft, groupNames: Map<number, string>): RoundView {
  return {
    name: round.name,
    startsAt: round.firstKickoff ? warsawLocal(round.firstKickoff) : null,
    matches: round.matches.map((match) => ({
      id: match.id,
      group: match.groupId === null ? null : (groupNames.get(match.groupId) ?? null),
      home: match.homeTeam?.name ?? 'do ustalenia',
      away: match.awayTeam?.name ?? 'do ustalenia',
      kickoff: match.kickoffAt ? warsawLocal(match.kickoffAt) : null,
      venue: match.venue?.name ?? null,
    })),
  };
}

/** Kolejka do czatu: nagłówek z dniem słownie, pod nim mecze z id; godzina przy meczu tylko, gdy inna niż start kolejki. */
function describeRound(round: RoundDraft, view: RoundView): string {
  const when = round.firstKickoff ? warsawLong(round.firstKickoff) : 'termin do ustalenia';
  const lines = view.matches.map((match) => {
    const extras = [match.group, match.kickoff !== view.startsAt ? match.kickoff : null, match.venue]
      .filter(Boolean)
      .join(', ');
    return `- #${match.id} ${match.home} – ${match.away}${extras ? ` (${extras})` : ''}`;
  });
  return [`${view.name}, ${when}:`, ...lines].join('\n');
}

const roundSchema = z.object({
  name: z.string(),
  startsAt: z.string().nullable().describe('Pierwszy mecz kolejki, czas warszawski „YYYY-MM-DD HH:MM”.'),
  matches: z.array(
    z.object({
      id: z.number(),
      group: z.string().nullable(),
      home: z.string(),
      away: z.string(),
      kickoff: z.string().nullable(),
      venue: z.string().nullable(),
    }),
  ),
});

/** Kolejki fazy do odpowiedzi, albo pusta lista i zdanie o list_matches przy dużej fazie. */
async function roundsOf(session: Session, tournamentId: number, stage: Stage) {
  const matches = await stageMatches(session, tournamentId, stage.id);
  if (matches.length > LISTED_MATCHES_LIMIT) {
    return {
      rounds: [],
      text: `Mecze w fazie: ${matches.length}. Przy tylu meczach wynik ich nie wypisuje; zwraca je list_matches z filtrem stageId ${stage.id}.`,
    };
  }
  const groupNames = new Map(stage.groups.map((group) => [group.id, group.name]));
  const drafts = groupByRound(matches);
  const views = drafts.map((round) => roundView(round, groupNames));
  return { rounds: views, text: drafts.map((round, index) => describeRound(round, views[index])).join('\n\n') };
}

const groupResultSchema = z.object({
  id: z.number(),
  name: z.string(),
  qualifiers: z.number().describe('Ile drużyn wychodzi z grupy do fazy pucharowej.'),
  teams: z.array(z.object({ id: z.number(), name: z.string() })),
});

const GROUP_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function registerStageTools({ server, session, config }: ToolKit): void {
  async function teamsOf(tournamentId: number): Promise<Team[]> {
    return unwrap(
      await session.request((api) =>
        api.GET('/tournaments/{tournament}/teams', { params: { path: { tournament: tournamentId } } }),
      ),
    ).data;
  }

  /** Zapisuje skład grup i oddaje go z id grup nadanymi przez API i nazwami drużyn. */
  async function saveGroups(
    tournamentId: number,
    groups: Array<{ name: string; teamIds: number[]; qualifiers: number }>,
    teams: Team[],
  ) {
    const stage = await stageOfType(session, tournamentId, ['group']);
    const saved = unwrap(
      await session.request((api) =>
        api.PUT('/stages/{stage}/groups', { params: { path: { stage: stage.id } }, body: { groups } }),
      ),
    ).data;
    const names = new Map(teams.map((team) => [team.id, team.name]));
    const result = saved.groups.map((group) => ({
      id: group.id,
      name: group.name,
      qualifiers: group.qualifiers,
      teams: (groups.find((sent) => sent.name === group.name)?.teamIds ?? []).map((teamId) => ({
        id: teamId,
        name: names.get(teamId) ?? `drużyna ${teamId}`,
      })),
    }));
    const text = [
      `Skład grup zapisany (faza ${stage.name}, id ${stage.id}). Poprzedni terminarz fazy grupowej, jeśli był, został usunięty.`,
      ...result.map(
        (group) =>
          `${group.name} (id ${group.id}, wychodzi ${group.qualifiers}): ` +
          group.teams.map((team) => `${team.name} (id ${team.id})`).join(', '),
      ),
    ].join('\n');
    return success({ stageId: stage.id, groups: result }, text);
  }

  server.registerTool(
    'draw_groups',
    {
      title: 'Wylosuj grupy',
      description:
        'Losuje skład grup w turnieju z fazą grupową: tasuje wszystkie drużyny turnieju i rozdziela je na podaną ' +
        'liczbę grup o możliwie równych rozmiarach, nazwanych „Grupa A”, „Grupa B” itd. Zastępuje dotychczasowy ' +
        'skład i usuwa terminarz fazy grupowej. API odmawia, gdy w fazie grupowej zaczął się jakiś mecz. ' +
        'Każde wywołanie losuje od nowa.',
      inputSchema: {
        tournamentId: id('Id turnieju w formacie groups_playoff.'),
        groupsCount: z.number().int().min(1).max(26).describe('Liczba grup.'),
        qualifiers: z
          .number()
          .int()
          .min(1)
          .describe('Ile drużyn z każdej grupy wychodzi do fazy pucharowej; nie więcej niż drużyn w najmniejszej grupie.'),
      },
      outputSchema: { stageId: z.number(), groups: z.array(groupResultSchema) },
      annotations: { title: 'Wylosuj grupy', ...REPLACE },
    },
    ({ tournamentId, groupsCount, qualifiers }) =>
      run(async () => {
        const teams = await teamsOf(tournamentId);
        if (teams.length < groupsCount * 2) {
          throw new ToolFailure(
            `Turniej ma ${teams.length} drużyn, a każda z ${groupsCount} grup potrzebuje co najmniej dwóch. ` +
              `Najwięcej grup przy tej liczbie drużyn: ${Math.floor(teams.length / 2)}.`,
          );
        }
        const groups = Array.from({ length: groupsCount }, (_, index) => ({
          name: `Grupa ${GROUP_LETTERS[index]}`,
          teamIds: [] as number[],
          qualifiers,
        }));
        shuffle(teams).forEach((team, index) => groups[index % groupsCount].teamIds.push(team.id));
        return saveGroups(tournamentId, groups, teams);
      }),
  );

  server.registerTool(
    'set_groups',
    {
      title: 'Ustal skład grup',
      description:
        'Ustala skład grup ręcznie: każda drużyna turnieju musi trafić do dokładnie jednej grupy, grupa ma co ' +
        'najmniej dwie drużyny, a nazwy grup są unikalne. Zastępuje dotychczasowy skład i usuwa terminarz fazy ' +
        'grupowej. API odmawia, gdy w fazie grupowej zaczął się jakiś mecz.',
      inputSchema: {
        tournamentId: id('Id turnieju w formacie groups_playoff.'),
        groups: z
          .array(
            z.object({
              name: z.string().min(1).max(40).describe('Nazwa grupy, np. „Grupa A”.'),
              teamIds: z.array(z.number().int()).min(2).describe('Id drużyn tej grupy (z get_tournament).'),
              qualifiers: z.number().int().min(1).describe('Ile drużyn wychodzi z tej grupy do fazy pucharowej.'),
            }),
          )
          .min(1),
      },
      outputSchema: { stageId: z.number(), groups: z.array(groupResultSchema) },
      annotations: { title: 'Ustal skład grup', ...EDIT },
    },
    ({ tournamentId, groups }) => run(async () => saveGroups(tournamentId, groups, await teamsOf(tournamentId))),
  );

  server.registerTool(
    'set_group_qualifiers',
    {
      title: 'Zmień wyjście z grupy',
      description:
        'Zmienia, ile drużyn wychodzi z jednej grupy do fazy pucharowej. Nie rusza składu ani meczów grupy. ' +
        'API odmawia, gdy w fazie pucharowej zaczął się jakiś mecz.',
      inputSchema: {
        groupId: id('Id grupy (z get_tournament).'),
        qualifiers: z.number().int().min(1).describe('Ile drużyn wychodzi z grupy.'),
      },
      outputSchema: { id: z.number(), name: z.string(), qualifiers: z.number() },
      annotations: { title: 'Zmień wyjście z grupy', ...EDIT },
    },
    ({ groupId, qualifiers }) =>
      run(async () => {
        const group = unwrap(
          await session.request((api) =>
            api.PATCH('/groups/{group}', { params: { path: { group: groupId } }, body: { qualifiers } }),
          ),
        ).data;
        return success(
          { id: group.id, name: group.name, qualifiers: group.qualifiers },
          `Z grupy „${group.name}” (id ${group.id}) wychodzi teraz ${group.qualifiers}.`,
        );
      }),
  );

  server.registerTool(
    'generate_schedule',
    {
      title: 'Ułóż terminarz',
      description:
        'Układa pary meczów w kolejkach systemem każdy z każdym: w lidze dla wszystkich drużyn, w fazie grupowej ' +
        'osobno w każdej grupie (kolejki są wspólne dla grup). Faza grupowa wymaga ustalonego składu grup. ' +
        'Mecze nie mają jeszcze terminów; nadaje je set_schedule_dates. Ponowne wywołanie losuje pary od nowa ' +
        'i zastępuje cały terminarz fazy. API odmawia, gdy w fazie zaczął się jakiś mecz.',
      inputSchema: {
        tournamentId: id('Id turnieju w formacie league albo groups_playoff.'),
        meetings: z
          .union([z.literal(1), z.literal(2)])
          .default(1)
          .describe('Ile razy gra ze sobą każda para: 1 to raz, 2 to mecz i rewanż.'),
      },
      outputSchema: {
        stageId: z.number(),
        roundsCount: z.number(),
        matchesCount: z.number(),
        rounds: z.array(roundSchema),
        panelUrl: z.string(),
      },
      annotations: { title: 'Ułóż terminarz', ...REPLACE },
    },
    ({ tournamentId, meetings }) =>
      run(async () => {
        const stage = await stageOfType(session, tournamentId, ['league', 'group']);
        const generated = unwrap(
          await session.request((api) =>
            api.POST('/stages/{stage}/schedule', { params: { path: { stage: stage.id } }, body: { meetings } }),
          ),
        ).data;
        const { rounds, text } = await roundsOf(session, tournamentId, stage);
        const panelUrl = panelLink(config, tournamentId, 'schedule');
        return success(
          { stageId: stage.id, roundsCount: generated.roundsCount, matchesCount: generated.matchesCount, rounds, panelUrl },
          [
            `Terminarz fazy ${stage.name} (id ${stage.id}): ${plural(generated.roundsCount, 'kolejka', 'kolejki', 'kolejek')}, ` +
              `${plural(generated.matchesCount, 'mecz', 'mecze', 'meczów')}, jeszcze bez terminów.`,
            text,
            `Terminarz w panelu: ${panelUrl}`,
          ].join('\n\n'),
        );
      }),
  );

  server.registerTool(
    'set_schedule_dates',
    {
      title: 'Nadaj terminy meczom',
      description:
        'Nadaje terminy zaplanowanym meczom fazy (ligowej, grupowej albo pucharowej), w czasie warszawskim. ' +
        'Tryb interval: kolejka co intervalDays dni od startDate. Tryb continuous: kolejki jedna po drugiej, ' +
        'mecz trwa tyle, ile ustawiona długość meczu, a mecz, który skończyłby się po dayEndTime, przechodzi na ' +
        'następny dzień. Z obiektami mecze rozchodzą się po obiektach i grają równolegle; bez obiektów cała ' +
        'kolejka gra o jednej godzinie. Nadpisuje terminy meczów zaplanowanych od kolejki fromRound, mecze ' +
        'rozpoczęte zostawia. Kolizje (drużyna albo obiekt w dwóch meczach naraz) tylko zgłasza.',
      inputSchema: {
        tournamentId: id('Id turnieju.'),
        stageId: id('Id fazy (z get_tournament albo create_tournament).'),
        startDate: date.describe('Dzień pierwszej kolejki, „YYYY-MM-DD”.'),
        kickoffTime: clock.default('18:00').describe('Godzina pierwszego meczu kolejki, czas warszawski „HH:MM”.'),
        mode: z.enum(['interval', 'continuous']).default('interval'),
        intervalDays: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Tylko tryb interval: odstęp między kolejkami w dniach; domyślnie 7.'),
        dayEndTime: clock.optional().describe('Tylko tryb continuous: do której godziny mogą trwać mecze danego dnia.'),
        venueIds: z
          .array(z.number().int())
          .max(20)
          .optional()
          .describe('Id obiektów (z list_venues), po których rozchodzą się mecze.'),
        fromRound: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Numer kolejki, od której nadać terminy; wcześniejsze zostają bez zmian.'),
      },
      outputSchema: {
        matchesCount: z.number().describe('Ilu meczom nadano termin.'),
        collisionsCount: z.number(),
        rounds: z.array(roundSchema),
        panelUrl: z.string(),
      },
      annotations: { title: 'Nadaj terminy meczom', ...EDIT },
    },
    ({ tournamentId, stageId, startDate, kickoffTime, mode, intervalDays, dayEndTime, venueIds, fromRound }) =>
      run(async () => {
        if (mode === 'interval' && dayEndTime !== undefined) {
          throw new ToolFailure('dayEndTime działa tylko w trybie continuous.');
        }
        if (mode === 'continuous' && intervalDays !== undefined) {
          throw new ToolFailure('intervalDays działa tylko w trybie interval.');
        }
        const stage = (await stagesOf(session, tournamentId)).find((candidate) => candidate.id === stageId);
        if (!stage) {
          throw new ToolFailure(`Turniej ${tournamentId} nie ma fazy ${stageId}. Fazy turnieju zwraca get_tournament.`);
        }

        const dated = unwrap(
          await session.request((api) =>
            api.POST('/stages/{stage}/schedule/dates', {
              params: { path: { stage: stageId } },
              body: {
                mode,
                startAt: warsawDateTime(startDate, kickoffTime),
                timeZone: TIME_ZONE,
                ...(mode === 'interval' ? { intervalDays: intervalDays ?? 7 } : {}),
                ...(dayEndTime !== undefined ? { dayEndTime } : {}),
                ...(venueIds !== undefined ? { venueIds } : {}),
                ...(fromRound !== undefined ? { fromRound } : {}),
              },
            }),
          ),
        ).data;
        const { rounds, text } = await roundsOf(session, tournamentId, stage);
        const panelUrl = panelLink(config, tournamentId, 'schedule');
        const collisions =
          dated.collisionsCount > 0
            ? ` Kolizji (drużyna albo obiekt w dwóch meczach naraz): ${dated.collisionsCount}; to ostrzeżenie, terminy są zapisane.`
            : '';
        return success(
          { matchesCount: dated.matchesCount, collisionsCount: dated.collisionsCount, rounds, panelUrl },
          [
            `Faza ${stage.name}: mecze z nowym terminem: ${dated.matchesCount}.${collisions}`,
            text,
            `Terminarz w panelu: ${panelUrl}`,
          ].join('\n\n'),
        );
      }),
  );

  server.registerTool(
    'generate_bracket',
    {
      title: 'Wygeneruj drabinkę',
      description:
        'Tworzy drabinkę fazy pucharowej z rozstawienia (kolejność drużyn, pierwsza = najwyżej rozstawiona). ' +
        'Gdy drużyn nie jest potęga dwójki, najwyżej rozstawione dostają wolny los do drugiej rundy. Tryby: ' +
        'from_groups bierze propozycję z tabel grup (tylko format groups_playoff; z każdej grupy tyle drużyn, ' +
        'ile z niej wychodzi), random tasuje teamIds albo, bez nich, wszystkie drużyny turnieju, manual bierze ' +
        'teamIds w podanej kolejności. W groups_playoff drabinka musi mieć dokładnie tyle drużyn z każdej grupy, ' +
        'ile z niej wychodzi. Zastępuje dotychczasową drabinkę; API odmawia, gdy jakiś mecz drabinki się zaczął. ' +
        'Zwycięzcy przechodzą dalej sami po wpisaniu wyniku.',
      inputSchema: {
        tournamentId: id('Id turnieju w formacie knockout albo groups_playoff.'),
        seeding: z.enum(['from_groups', 'random', 'manual']).describe('Skąd wziąć rozstawienie.'),
        teamIds: z
          .array(z.number().int())
          .min(2)
          .optional()
          .describe('Id drużyn: w trybie manual w kolejności rozstawienia, w trybie random do potasowania.'),
        thirdPlaceMatch: z.boolean().default(false).describe('Czy rozegrać mecz o 3. miejsce (wymaga 4 drużyn).'),
      },
      outputSchema: {
        stageId: z.number(),
        roundsCount: z.number(),
        matchesCount: z.number(),
        seeding: z.array(z.object({ seed: z.number(), id: z.number(), name: z.string() })),
        firstRound: z.array(z.object({ matchId: z.number(), home: z.string(), away: z.string() })),
        byes: z.array(z.object({ id: z.number(), name: z.string() })).describe('Drużyny z wolnym losem do drugiej rundy.'),
      },
      annotations: { title: 'Wygeneruj drabinkę', ...REPLACE },
    },
    ({ tournamentId, seeding, teamIds, thirdPlaceMatch }) =>
      run(async () => {
        const stage = await stageOfType(session, tournamentId, ['knockout']);
        const teams = await teamsOf(tournamentId);

        let order: number[];
        if (seeding === 'from_groups') {
          if (teamIds !== undefined) {
            throw new ToolFailure('W trybie from_groups rozstawienie liczy API; teamIds podaje się tylko w manual i random.');
          }
          order = unwrap(
            await session.request((api) =>
              api.GET('/stages/{stage}/bracket/seeding', { params: { path: { stage: stage.id } } }),
            ),
          ).data.map((seed) => seed.teamId);
        } else if (seeding === 'random') {
          order = shuffle(teamIds ?? teams.map((team) => team.id));
        } else {
          if (teamIds === undefined) {
            throw new ToolFailure('Tryb manual wymaga teamIds w kolejności rozstawienia.');
          }
          order = teamIds;
        }

        const generated = unwrap(
          await session.request((api) =>
            api.POST('/stages/{stage}/bracket', {
              params: { path: { stage: stage.id } },
              body: { teamIds: order, thirdPlaceMatch },
            }),
          ),
        ).data;

        const names = new Map(teams.map((team) => [team.id, team.name]));
        const nameOf = (teamId: number) => names.get(teamId) ?? `drużyna ${teamId}`;
        const matches = await stageMatches(session, tournamentId, stage.id);
        const firstOrder = Math.min(...matches.map((match) => match.round.order));
        const opening = matches.filter((match) => match.round.order === firstOrder);
        const playing = new Set(opening.flatMap((match) => [match.homeTeam?.id, match.awayTeam?.id]));
        const byes = order.filter((teamId) => !playing.has(teamId)).map((teamId) => ({ id: teamId, name: nameOf(teamId) }));
        const firstRound = opening.map((match) => ({
          matchId: match.id,
          home: match.homeTeam?.name ?? 'do ustalenia',
          away: match.awayTeam?.name ?? 'do ustalenia',
        }));
        const seeds = order.map((teamId, index) => ({ seed: index + 1, id: teamId, name: nameOf(teamId) }));

        return success(
          {
            stageId: stage.id,
            roundsCount: generated.roundsCount,
            matchesCount: generated.matchesCount,
            seeding: seeds,
            firstRound,
            byes,
          },
          [
            `Drabinka fazy ${stage.name} (id ${stage.id}): ${plural(generated.roundsCount, 'runda', 'rundy', 'rund')}, ` +
              `${plural(generated.matchesCount, 'mecz', 'mecze', 'meczów')}` +
              `${thirdPlaceMatch ? ' z meczem o 3. miejsce' : ''}, jeszcze bez terminów.`,
            `Rozstawienie: ${seeds.map((seed) => `${seed.seed}. ${seed.name}`).join(', ')}.`,
            `${opening[0]?.round.name ?? 'Pierwsza runda'}:`,
            ...firstRound.map((match) => `- #${match.matchId} ${match.home} – ${match.away}`),
            ...(byes.length > 0 ? [`Wolny los: ${byes.map((team) => team.name).join(', ')}.`] : []),
          ].join('\n'),
        );
      }),
  );
}
