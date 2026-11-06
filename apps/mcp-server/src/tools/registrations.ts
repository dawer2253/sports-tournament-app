import type { TeamRegistration } from '@tournament/api-client';
import * as z from 'zod/v4';
import { unwrap } from '../api.ts';
import { warsawLocal } from '../time.ts';
import { ADD, EDIT, id, READ, run, success, type ToolKit } from './kit.ts';

const STATUS_LABELS: Record<TeamRegistration['status'], string> = {
  pending: 'czeka na decyzję',
  accepted: 'przyjęte',
  rejected: 'odrzucone',
};

const registrationSchema = z.object({
  id: z.number(),
  teamName: z.string(),
  status: z.enum(['pending', 'accepted', 'rejected']),
  contact: z
    .object({ name: z.string(), email: z.string(), phone: z.string().nullable() })
    .nullable()
    .describe('Dane zgłaszającego; po odrzuceniu API je kasuje.'),
  players: z.array(z.object({ name: z.string(), number: z.number().nullable() })),
  teamId: z.number().nullable().describe('Drużyna utworzona z przyjętego zgłoszenia.'),
  createdAt: z.string().describe('Czas warszawski, „YYYY-MM-DD HH:MM”.'),
});

function registrationView(registration: TeamRegistration) {
  return {
    id: registration.id,
    teamName: registration.teamName,
    status: registration.status,
    contact: registration.contact,
    players: registration.players,
    teamId: registration.teamId,
    createdAt: warsawLocal(registration.createdAt),
  };
}

export function registerRegistrationTools({ server, session }: ToolKit): void {
  server.registerTool(
    'list_registrations',
    {
      title: 'Zgłoszenia drużyn',
      description:
        'Zwraca zgłoszenia drużyn wysłane przez stronę publiczną: nazwę drużyny, status, dane kontaktowe ' +
        'zgłaszającego i skład. Można zawęzić do jednego statusu.',
      inputSchema: {
        tournamentId: id('Id turnieju.'),
        status: z
          .enum(['pending', 'accepted', 'rejected'])
          .optional()
          .describe('pending = czeka na decyzję, accepted = przyjęte, rejected = odrzucone.'),
      },
      outputSchema: { registrations: z.array(registrationSchema) },
      annotations: { title: 'Zgłoszenia drużyn', ...READ },
    },
    ({ tournamentId, status }) =>
      run(async () => {
        const registrations = unwrap(
          await session.request((api) =>
            api.GET('/tournaments/{tournament}/registrations', {
              params: { path: { tournament: tournamentId }, query: status === undefined ? {} : { status: [status] } },
            }),
          ),
        ).data.map(registrationView);
        const text =
          registrations.length === 0
            ? 'Brak zgłoszeń.'
            : [
                'Zgłoszenia:',
                ...registrations.map(
                  (registration) =>
                    `- ${registration.teamName} (id ${registration.id}): ${STATUS_LABELS[registration.status]}, ` +
                    `zawodników: ${registration.players.length}` +
                    `${registration.contact ? `, kontakt: ${registration.contact.name} <${registration.contact.email}>` : ''}`,
                ),
              ].join('\n');
        return success({ registrations }, text);
      }),
  );

  server.registerTool(
    'accept_registration',
    {
      title: 'Przyjmij zgłoszenie',
      description:
        'Przyjmuje zgłoszenie: tworzy z niego drużynę w turnieju razem z zawodnikami ze zgłoszenia. API odmawia, ' +
        'gdy nazwa drużyny jest już zajęta, turniej ma 128 drużyn albo zaczął się w nim jakiś mecz.',
      inputSchema: { registrationId: id('Id zgłoszenia (z list_registrations).') },
      outputSchema: { teamId: z.number(), teamName: z.string(), playersCount: z.number() },
      annotations: { title: 'Przyjmij zgłoszenie', ...ADD },
    },
    ({ registrationId }) =>
      run(async () => {
        const team = unwrap(
          await session.request((api) =>
            api.POST('/registrations/{registration}/accept', { params: { path: { registration: registrationId } } }),
          ),
        ).data;
        return success(
          { teamId: team.id, teamName: team.name, playersCount: team.playersCount },
          `Przyjęto zgłoszenie ${registrationId}: drużyna „${team.name}” (id ${team.id}), zawodników: ${team.playersCount}.`,
        );
      }),
  );

  server.registerTool(
    'reject_registration',
    {
      title: 'Odrzuć zgłoszenie',
      description:
        'Odrzuca zgłoszenie, które czeka na decyzję. Odrzucenie kasuje dane kontaktowe zgłaszającego i nie da ' +
        'się go cofnąć.',
      inputSchema: { registrationId: id('Id zgłoszenia (z list_registrations).') },
      outputSchema: { id: z.number(), teamName: z.string(), status: z.literal('rejected') },
      annotations: { title: 'Odrzuć zgłoszenie', ...EDIT },
    },
    ({ registrationId }) =>
      run(async () => {
        const registration = unwrap(
          await session.request((api) =>
            api.POST('/registrations/{registration}/reject', { params: { path: { registration: registrationId } } }),
          ),
        ).data;
        return success(
          { id: registration.id, teamName: registration.teamName, status: 'rejected' },
          `Odrzucono zgłoszenie drużyny „${registration.teamName}” (id ${registration.id}).`,
        );
      }),
  );
}
