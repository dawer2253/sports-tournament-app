import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isValidationError, type AdminMatch, type MatchEvent, type Sport, type SportEventType } from '@tournament/api-client';
import {
  Button,
  EventTypeButtons,
  MatchTimeline,
  PlayerNumberGrid,
  Skeleton,
  toast,
} from '@tournament/ui';
import { Play } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/form-errors';
import { matchEventKeys, useEventTypes, useMatchEvents } from '../lib/match-event-queries';
import { usePlayers } from '../lib/team-queries';
import { MatchEventDialog } from './match-event-dialog';

const SAVE_FAILED = 'Nie udało się zapisać zdarzenia. Spróbuj ponownie.';

/**
 * Nazwa zdobyczy w linii zgodności. Ta sama para co `StandingTable.scoreLabel`
 * (ADR-0006); kontrakt nie niesie jej przy sporcie, a etykiety statystyk
 * (`statLabels`, #190) jeszcze nie stoją.
 */
const SCORE_LABELS: Record<Sport['code'], string> = {
  football: 'Bramki',
  basketball: 'Punkty',
};

/** Samobój należy do drużyny strzelca, a zdobycz daje przeciwnikowi (#188, reguła 9). */
const OWN_GOAL = 'own_goal';

export interface MatchEventsSectionProps {
  match: AdminMatch;
  sportCode: Sport['code'];
  /** Mecz zapisany jako trwający albo zakończony — tylko taki przyjmuje zdarzenia. */
  started: boolean;
  /** Wynik z pól okna, także niezapisany: linia zgodności porównuje z tym, co widać. */
  homeScore: string;
  awayScore: string;
  onStart: () => void;
  starting: boolean;
}

/**
 * Sekcja zdarzeń okna meczu (#200, wariant E z #191): przy każdej drużynie
 * przyciski typów, po kliknięciu siatka numerów, a klik w numer od razu zapisuje
 * zdarzenie. Pod spodem oś meczu, z której klik otwiera pod-okno edycji.
 *
 * Zdarzenia zapisują się osobnym zasobem, od razu — niezależnie od „Zapisz”
 * okna, które dotyczy wyniku, stanu, terminu i obiektu. Dlatego sekcja stoi
 * w `FormDialog` jako `aside`, poza formularzem meczu.
 */
export function MatchEventsSection({ match, sportCode, started, homeScore, awayScore, onStart, starting }: MatchEventsSectionProps) {
  const queryClient = useQueryClient();
  const events = useMatchEvents(match.id, started);
  const { types, scoringStat } = useEventTypes(sportCode);
  const [picking, setPicking] = useState<{ teamId: number; type: SportEventType } | null>(null);
  // Minuta zostaje między wpisami, dopóki okno jest otwarte: przy stoliku
  // organizator tylko ją podbija.
  const [minute, setMinute] = useState('');
  const [editing, setEditing] = useState<MatchEvent | null>(null);

  const home = match.homeTeam;
  const away = match.awayTeam;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: matchEventKeys.list(match.id) });

  const undo = useMutation({
    mutationFn: async (eventId: number) => {
      const { error } = await api.DELETE('/match-events/{event}', { params: { path: { event: eventId } } });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Cofnięto zdarzenie.');
    },
    onError: (error) => toast.error(apiErrorMessage(error) || 'Nie udało się cofnąć zdarzenia.'),
  });

  const create = useMutation({
    mutationFn: async ({ teamId, type, playerId }: { teamId: number; type: SportEventType; playerId: number }) => {
      const { data, error } = await api.POST('/matches/{match}/events', {
        params: { path: { match: match.id } },
        body: { type: type.code, teamId, playerId, minute: minute === '' ? null : Number(minute) },
      });
      if (data) return data.data;
      throw error;
    },
    onSuccess: async (event) => {
      setPicking(null);
      await invalidate();
      const minuteLabel = event.minute === null ? '' : `${event.minute}′ `;
      toast.success(`${minuteLabel}${event.typeLabel}: ${event.player?.name ?? event.team.name}`, {
        action: { label: 'Cofnij', onClick: () => undo.mutate(event.id) },
      });
    },
    // Siatka nie ma pól, przy których dałoby się posadzić błąd, więc idzie
    // w toast — bez gubienia komunikatu (zawodnik spoza drużyny, minuta 151).
    onError: (error) => {
      const message = isValidationError(error) ? Object.values(error.errors).flat().join(' ') || error.message : apiErrorMessage(error);
      toast.error(message || SAVE_FAILED);
    },
  });

  if (!home || !away) return null;

  return (
    <section aria-label="Zdarzenia" className="grid gap-3 border-t pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="text-sm font-medium">Zdarzenia</p>
        <p className="text-xs text-muted-foreground">Zapisują się od razu. „Zapisz” dotyczy wyniku, stanu, terminu i obiektu.</p>
      </div>

      {!started ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed px-3 py-2">
          <p className="mr-auto text-sm text-muted-foreground">Zdarzenia wpiszesz, gdy mecz się zacznie.</p>
          <Button type="button" size="sm" onClick={onStart} disabled={starting}>
            <Play className="size-4" /> Rozpocznij mecz
          </Button>
        </div>
      ) : !types || !scoringStat ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {[home, away].map((team) => (
            <TeamColumn
              key={team.id}
              team={team}
              types={types}
              scoringStat={scoringStat}
              picking={picking?.teamId === team.id ? picking.type : null}
              otherPicking={picking !== null && picking.teamId !== team.id}
              minute={minute}
              onMinuteChange={setMinute}
              pending={create.isPending}
              onPick={(type) => setPicking({ teamId: team.id, type })}
              onBack={() => setPicking(null)}
              onSelectPlayer={(type, playerId) => create.mutate({ teamId: team.id, type, playerId })}
            />
          ))}
        </div>
      )}

      {started && events.data && types && (
        <>
          <MismatchLine match={match} sportCode={sportCode} events={events.data} types={types} scoringStat={scoringStat} homeScore={homeScore} awayScore={awayScore} />
          <MatchTimeline events={events.data} homeTeamId={home.id} types={types} onSelect={(row) => setEditing(events.data.find((event) => event.id === row.id) ?? null)} />
        </>
      )}
      {started && events.isError && (
        <p role="alert" className="text-sm text-destructive">
          Nie udało się wczytać zdarzeń. {events.error.message}
        </p>
      )}

      {editing && types && (
        <MatchEventDialog key={editing.id} match={match} event={editing} types={types} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

function TeamColumn({
  team,
  types,
  scoringStat,
  picking,
  otherPicking,
  minute,
  onMinuteChange,
  pending,
  onPick,
  onBack,
  onSelectPlayer,
}: {
  team: { id: number; name: string };
  types: SportEventType[];
  scoringStat: string;
  picking: SportEventType | null;
  otherPicking: boolean;
  minute: string;
  onMinuteChange: (minute: string) => void;
  pending: boolean;
  onPick: (type: SportEventType) => void;
  onBack: () => void;
  onSelectPlayer: (type: SportEventType, playerId: number) => void;
}) {
  // Skład pobiera dopiero wybór typu: przy samym podglądzie osi niepotrzebny.
  const players = usePlayers(picking ? team.id : null);

  return (
    <div className="grid content-start gap-2 rounded-lg border p-3">
      <p className="truncate text-sm font-semibold">{team.name}</p>
      {picking ? (
        players.data ? (
          players.data.length === 0 ? (
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">Drużyna nie ma zawodników. Dodaj ich w składzie drużyny.</p>
              <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={onBack}>
                Wróć
              </Button>
            </div>
          ) : (
            <PlayerNumberGrid
              title={`${picking.label} — kto?`}
              players={players.data}
              minute={minute}
              onMinuteChange={onMinuteChange}
              onBack={onBack}
              onSelect={(playerId) => onSelectPlayer(picking, playerId)}
              disabled={pending}
            />
          )
        ) : players.isError ? (
          <p role="alert" className="text-sm text-destructive">
            Nie udało się wczytać składu. {players.error.message}
          </p>
        ) : (
          <Skeleton className="h-28 w-full" />
        )
      ) : (
        <EventTypeButtons
          teamName={team.name}
          types={types}
          scoringStat={scoringStat}
          disabled={otherPicking || pending}
          onSelect={(code) => onPick(types.find((type) => type.code === code)!)}
        />
      )}
    </div>
  );
}

/**
 * Cicha linia zgodności (#191): tylko przy rozjeździe zdobyczy ze zdarzeń
 * z wynikiem w polach okna. Niczego nie blokuje — API zgodności nie sprawdza
 * (#188, reguła 11).
 */
function MismatchLine({
  match,
  sportCode,
  events,
  types,
  scoringStat,
  homeScore,
  awayScore,
}: {
  match: AdminMatch;
  sportCode: Sport['code'];
  events: MatchEvent[];
  types: SportEventType[];
  scoringStat: string | undefined;
  homeScore: string;
  awayScore: string;
}) {
  if (homeScore === '' || awayScore === '') return null;

  let home = 0;
  let away = 0;
  for (const event of events) {
    const type = types.find((candidate) => candidate.code === event.type);
    if (!type || (type.stat !== scoringStat && type.code !== OWN_GOAL)) continue;
    const forHome = event.team.id === match.homeTeam?.id;
    const creditedHome = type.code === OWN_GOAL ? !forHome : forHome;
    if (creditedHome) home += type.value;
    else away += type.value;
  }

  if (home === Number(homeScore) && away === Number(awayScore)) return null;

  return (
    <p className="text-xs text-muted-foreground">
      {SCORE_LABELS[sportCode]} ze zdarzeń: {home}:{away} · wynik meczu {homeScore}:{awayScore}
    </p>
  );
}
