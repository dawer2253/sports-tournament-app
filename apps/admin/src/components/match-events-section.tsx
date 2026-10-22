import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isValidationError, type AdminMatch, type MatchEvent, type Sport, type SportEventType } from '@tournament/api-client';
import {
  Button,
  EventTypeButtons,
  eventMinuteText,
  formatEventMinute,
  MatchTimeline,
  MetaList,
  parseEventMinute,
  PlayerNumberGrid,
  Skeleton,
  toast,
  type EventMinute,
} from '@tournament/ui';
import { Play } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/form-errors';
import { matchEventKeys, useEventTypes, useMatchEvents } from '../lib/match-event-queries';
import { usePlayers } from '../lib/team-queries';
import { MatchEventDialog } from './match-event-dialog';

const SAVE_FAILED = 'Nie udało się zapisać zdarzenia. Spróbuj ponownie.';

const BAD_MINUTE = 'Minuta to liczba od 1 do 150, np. 67 albo 45+3.';

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
  /**
   * Linia zgodności zdarzeń z wynikiem (#191). Domyślnie włączona; sport
   * z setami (#301) ją wyłącza, bo zdarzenia (as, blok, atak) to wybrane
   * akcje, a wynik to sety.
   */
  scoreCheck?: boolean;
  /**
   * Minuta zdarzenia z zegara meczu w tej chwili (#317) albo `null`, gdy zegar
   * jej nie podaje; liczona przy każdym kliknięciu rodzaju zdarzenia.
   */
  minuteFromClock?: () => EventMinute | null;
  /**
   * Wołane po zapisie i cofnięciu zdarzenia: okno meczu przepisuje wynik z
   * serwera (zdarzenie w meczu trwającym zmienia wynik, #317) i oddaje go do
   * toastu; `null`, gdy wynik się nie zmienia.
   */
  onScoreChanged?: () => Promise<{ home: number; away: number } | null>;
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
export function MatchEventsSection({
  match,
  sportCode,
  started,
  homeScore,
  awayScore,
  scoreCheck = true,
  minuteFromClock,
  onScoreChanged,
  onStart,
  starting,
}: MatchEventsSectionProps) {
  const queryClient = useQueryClient();
  const events = useMatchEvents(match.id, started);
  const { types, scoringStat, scoringLabel } = useEventTypes(sportCode);
  const [picking, setPicking] = useState<{ teamId: number; type: SportEventType } | null>(null);
  // Minutę wpisuje zegar meczu przy każdym kliknięciu rodzaju zdarzenia, a
  // organizator może ją poprawić przed wyborem zawodnika (#317). Tekst, bo
  // przyjmuje „67” i „45+3”.
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
      await Promise.all([invalidate(), onScoreChanged?.()]);
      toast.success('Cofnięto zdarzenie.');
    },
    onError: (error) => toast.error(apiErrorMessage(error) || 'Nie udało się cofnąć zdarzenia.'),
  });

  const create = useMutation({
    mutationFn: async ({ teamId, type, playerId }: { teamId: number; type: SportEventType; playerId: number }) => {
      const at = parseEventMinute(minute);
      if (at === null) throw new Error(BAD_MINUTE);
      const { data, error } = await api.POST('/matches/{match}/events', {
        params: { path: { match: match.id } },
        body: { type: type.code, teamId, playerId, minute: at.minute, addedTime: at.addedTime },
      });
      if (data) return data.data;
      throw error;
    },
    onSuccess: async (event) => {
      setPicking(null);
      const [, score] = await Promise.all([invalidate(), onScoreChanged?.()]);
      // Zdarzenie, które zmieniło wynik, mówi nowy wynik; reszta (kartka, faul) — kto i kiedy.
      const minuteLabel = event.minute === null ? '' : `${formatEventMinute(event.minute, event.addedTime)} `;
      const type = types?.find((candidate) => candidate.code === event.type);
      const gain = type !== undefined && (type.stat === scoringStat || type.code === OWN_GOAL);
      const text = score && gain ? `${event.typeLabel}, ${score.home}:${score.away}` : `${minuteLabel}${event.typeLabel}: ${event.player?.name ?? event.team.name}`;
      toast.success(text, {
        action: { label: 'Cofnij', onClick: () => undo.mutate(event.id) },
      });
    },
    // Siatka nie ma pól, przy których dałoby się posadzić błąd, więc idzie
    // w toast — bez gubienia komunikatu (zawodnik spoza drużyny, minuta 151).
    onError: (error) => {
      const message = isValidationError(error)
        ? Object.values(error.errors).flat().join(' ') || error.message
        : error instanceof Error && error.message === BAD_MINUTE
          ? BAD_MINUTE
          : apiErrorMessage(error);
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
              onPick={(type) => {
                setMinute(eventMinuteText(...minuteArgs(minuteFromClock?.() ?? null)));
                setPicking({ teamId: team.id, type });
              }}
              onBack={() => setPicking(null)}
              onSelectPlayer={(type, playerId) => create.mutate({ teamId: team.id, type, playerId })}
            />
          ))}
        </div>
      )}

      {started && events.data && types && (
        <>
          {scoreCheck && <MismatchLine match={match} scoringLabel={scoringLabel} events={events.data} types={types} scoringStat={scoringStat} homeScore={homeScore} awayScore={awayScore} />}
          <MatchTimeline events={events.data} homeTeamId={home.id} types={types} onSelect={(row) => setEditing(events.data.find((event) => event.id === row.id) ?? null)} />
        </>
      )}
      {started && events.isError && (
        <p role="alert" className="text-sm text-destructive">
          Nie udało się wczytać zdarzeń. {events.error.message}
        </p>
      )}

      {editing && types && (
        <MatchEventDialog
          key={editing.id}
          match={match}
          event={editing}
          types={types}
          onScoreChanged={onScoreChanged}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

/** Argumenty `eventMinuteText` z minuty zegara; brak minuty to puste pole. */
function minuteArgs(at: EventMinute | null): [number | null, number | null] {
  return at === null ? [null, null] : [at.minute, at.addedTime];
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
  scoringLabel,
  events,
  types,
  scoringStat,
  homeScore,
  awayScore,
}: {
  match: AdminMatch;
  /** Etykieta zdobyczy ze `statLabels` sportu, np. „Bramki”. */
  scoringLabel: string | undefined;
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
    // Dwa niezależne fakty rozdziela kreska `MetaList`, nie kropka (#192).
    <MetaList role="group" aria-label="Zgodność wyniku" className="text-xs text-muted-foreground">
      <>{scoringLabel} ze zdarzeń: {home}:{away}</>
      <>wynik meczu {homeScore}:{awayScore}</>
    </MetaList>
  );
}
