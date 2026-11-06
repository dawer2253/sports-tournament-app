import type { Venue } from '@tournament/api-client';
import * as z from 'zod/v4';
import { ToolFailure, unwrap } from '../api.ts';
import { addEach, rejectedSchema } from './batch.ts';
import { ADD, EDIT, ensureOk, id, READ, REMOVE, run, success, type ToolKit } from './kit.ts';

const venueSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string().nullable(),
  scheduledMatchesCount: z.number(),
});

function venueView(venue: Venue) {
  return { id: venue.id, name: venue.name, address: venue.address, scheduledMatchesCount: venue.scheduledMatchesCount };
}

function venueLine(venue: z.infer<typeof venueSchema>): string {
  return `${venue.name} (id ${venue.id}${venue.address ? `, ${venue.address}` : ''})`;
}

const address = z.string().max(255).nullable();

export function registerVenueTools({ server, session }: ToolKit): void {
  server.registerTool(
    'list_venues',
    {
      title: 'Obiekty turnieju',
      description:
        'Zwraca obiekty (boiska, hale) turnieju: id, nazwę, adres i liczbę zaplanowanych na nich meczów. ' +
        'Id obiektów przyjmuje set_schedule_dates i update_match.',
      inputSchema: { tournamentId: id('Id turnieju.') },
      outputSchema: { venues: z.array(venueSchema) },
      annotations: { title: 'Obiekty turnieju', ...READ },
    },
    ({ tournamentId }) =>
      run(async () => {
        const venues = unwrap(
          await session.request((api) =>
            api.GET('/tournaments/{tournament}/venues', { params: { path: { tournament: tournamentId } } }),
          ),
        ).data.map(venueView);
        const text =
          venues.length === 0
            ? `Turniej ${tournamentId} nie ma obiektów.`
            : ['Obiekty:', ...venues.map((venue) => `- ${venueLine(venue)}, meczów zaplanowanych: ${venue.scheduledMatchesCount}`)].join('\n');
        return success({ venues }, text);
      }),
  );

  server.registerTool(
    'add_venues',
    {
      title: 'Dodaj obiekty',
      description:
        'Dodaje obiekty (boiska, hale) do turnieju po kolei. Obiekt odrzucony przez API (np. nazwa zajęta) pomija ' +
        'i idzie dalej; w wyniku są dodane z id i odrzucone z powodem. Turniej ma najwyżej 32 obiekty.',
      inputSchema: {
        tournamentId: id('Id turnieju.'),
        venues: z
          .array(
            z.object({
              name: z.string().min(1).max(120).describe('Nazwa, unikalna w turnieju, np. „Orlik Bemowo”.'),
              address: address.optional().describe('Adres, np. „ul. Powstańców Śląskich 50, Warszawa”.'),
            }),
          )
          .min(1),
      },
      outputSchema: { added: z.array(venueSchema), rejected: rejectedSchema },
      annotations: { title: 'Dodaj obiekty', ...ADD },
    },
    ({ tournamentId, venues }) =>
      run(() =>
        addEach({
          items: venues,
          noun: 'Obiekty',
          label: (venue) => venue.name,
          send: (venue) =>
            session.request((api) =>
              api.POST('/tournaments/{tournament}/venues', {
                params: { path: { tournament: tournamentId } },
                body: { name: venue.name, address: venue.address ?? null },
              }),
            ),
          view: venueView,
          line: venueLine,
        }),
      ),
  );

  server.registerTool(
    'update_venue',
    {
      title: 'Zmień obiekt',
      description: 'Zmienia nazwę albo adres obiektu. Zmienia tylko podane pola; null usuwa adres.',
      inputSchema: {
        venueId: id('Id obiektu (z list_venues).'),
        name: z.string().min(1).max(120).optional(),
        address: address.optional(),
      },
      outputSchema: venueSchema.shape,
      annotations: { title: 'Zmień obiekt', ...EDIT },
    },
    ({ venueId, ...fields }) =>
      run(async () => {
        if (Object.keys(fields).length === 0) {
          throw new ToolFailure('Nie podano żadnego pola do zmiany.');
        }
        const venue = venueView(
          unwrap(
            await session.request((api) => api.PATCH('/venues/{venue}', { params: { path: { venue: venueId } }, body: fields })),
          ).data,
        );
        return success(venue, `Zapisano obiekt: ${venueLine(venue)}.`);
      }),
  );

  server.registerTool(
    'delete_venue',
    {
      title: 'Usuń obiekt',
      description:
        'Usuwa obiekt z turnieju. Mecze zaplanowane na tym obiekcie zostają bez obiektu, z tym samym terminem. ' +
        'API odmawia, gdy na obiekcie trwa albo zakończył się jakiś mecz.',
      inputSchema: { venueId: id('Id obiektu do usunięcia.') },
      outputSchema: { id: z.number() },
      annotations: { title: 'Usuń obiekt', ...REMOVE },
    },
    ({ venueId }) =>
      run(async () => {
        ensureOk(await session.request((api) => api.DELETE('/venues/{venue}', { params: { path: { venue: venueId } } })));
        return success({ id: venueId }, `Usunięto obiekt ${venueId}. Jego mecze zaplanowane zostały bez obiektu.`);
      }),
  );
}
