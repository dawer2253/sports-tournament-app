import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isValidationError, type AdminMatch, type MatchEvent, type SportEventType } from '@tournament/api-client';
import {
  Button,
  ConfirmDeleteDialog,
  eventMinuteText,
  formatEventMinute,
  FormDialog,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@tournament/ui';
import { Trash2 } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { api } from '../lib/api';
import { apiErrorMessage, applyApiError } from '../lib/form-errors';
import { BAD_MINUTE, MinuteError, minuteFromField } from '../lib/match-event-minute';
import { matchEventKeys } from '../lib/match-event-queries';
import { usePlayers } from '../lib/team-queries';
import { TextField } from './text-field';

const SAVE_FAILED = 'Nie udało się zapisać zdarzenia. Spróbuj ponownie.';
const DELETE_FAILED = 'Nie udało się usunąć zdarzenia. Spróbuj ponownie.';

/** Pola, których `422` umiemy posadzić przy polu; reszta (np. `match`) idzie nad przyciski. */
const FIELDS = ['type', 'teamId', 'playerId', 'minute', 'addedTime'] as const;


/** Wartość „bez zawodnika” w `Select`; pusty napis `Select` traktuje jak brak wyboru. */
const NO_PLAYER = 'none';

export interface MatchEventDialogProps {
  match: AdminMatch;
  event: MatchEvent;
  types: SportEventType[];
  /** Wołane po zapisie, poprawce i usunięciu: okno meczu przepisuje wynik z serwera (#317). */
  onScoreChanged?: () => Promise<unknown>;
  onClose: () => void;
}

/**
 * Pod-okno edycji zdarzenia z osi meczu (#200): typ, drużyna, zawodnik
 * i minuta, zapisywane jednym `PATCH`-em, który API waliduje po scaleniu.
 * Wysyłamy wszystkie cztery pola, więc formularz mówi dokładnie to, co widać.
 * W tym samym oknie „Usuń zdarzenie” z potwierdzeniem.
 */
export function MatchEventDialog({ match, event, types, onScoreChanged, onClose }: MatchEventDialogProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState(event.type);
  const [teamId, setTeamId] = useState(event.team.id);
  const [playerId, setPlayerId] = useState(event.player ? String(event.player.id) : NO_PLAYER);
  const [minute, setMinute] = useState(eventMinuteText(event.minute, event.addedTime));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<(typeof FIELDS)[number], string>>>({});
  const [formError, setFormError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const players = usePlayers(teamId);
  const teams = [match.homeTeam, match.awayTeam].filter((team) => team !== null);

  const invalidate = () => Promise.all([queryClient.invalidateQueries({ queryKey: matchEventKeys.list(match.id) }), onScoreChanged?.()]);

  const save = useMutation({
    mutationFn: async () => {
      const at = minuteFromField(minute);
      const result = await api.PATCH('/match-events/{event}', {
        params: { path: { event: event.id } },
        body: {
          type,
          teamId,
          playerId: playerId === NO_PLAYER ? null : Number(playerId),
          minute: at.minute,
          addedTime: at.addedTime,
        },
      });
      if (result.data) return result.data.data;
      throw result.response.status === 422 && isValidationError(result.error) ? result.error : new Error(SAVE_FAILED);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Zapisano zdarzenie.');
      onClose();
    },
    onError: (error) => {
      setFieldErrors({});
      setFormError(undefined);
      if (error instanceof MinuteError) {
        setFieldErrors({ minute: BAD_MINUTE });
        return;
      }
      applyApiError(
        error,
        FIELDS,
        (field, { message }) => {
          if (field === 'root') setFormError(message);
          else setFieldErrors((current) => ({ ...current, [field]: message }));
        },
        SAVE_FAILED,
      );
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE('/match-events/{event}', { params: { path: { event: event.id } } });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Usunięto zdarzenie.');
      onClose();
    },
  });

  function submit(submitEvent: FormEvent) {
    submitEvent.preventDefault();
    setFieldErrors({});
    setFormError(undefined);
    save.mutate();
  }

  const minuteLabel = event.minute === null ? '' : `${formatEventMinute(event.minute, event.addedTime)} `;

  return (
    <>
      <FormDialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        onSubmit={submit}
        title="Edytuj zdarzenie"
        description={`${minuteLabel}${event.typeLabel}, ${event.player?.name ?? event.team.name}`}
        submitLabel="Zapisz"
        pending={save.isPending}
        error={formError}
      >
        <div className="grid gap-3">
          <SelectField id="event-type" label="Typ" error={fieldErrors.type}>
            <Select value={type} onValueChange={setType} disabled={save.isPending}>
              <SelectTrigger id="event-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SelectField>

          <SelectField id="event-team" label="Drużyna" error={fieldErrors.teamId}>
            <Select
              value={String(teamId)}
              onValueChange={(next) => {
                setTeamId(Number(next));
                // Zawodnik należy do drużyny, więc zmiana drużyny go zdejmuje.
                setPlayerId(NO_PLAYER);
              }}
              disabled={save.isPending}
            >
              <SelectTrigger id="event-team" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={String(team.id)}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SelectField>

          <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
            <SelectField id="event-player" label="Zawodnik" error={fieldErrors.playerId}>
              <Select value={playerId} onValueChange={setPlayerId} disabled={save.isPending}>
                <SelectTrigger id="event-player" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PLAYER}>Wybierz zawodnika</SelectItem>
                  {(players.data ?? []).map((player) => (
                    <SelectItem key={player.id} value={String(player.id)}>
                      {player.number === null ? player.name : `${player.number}. ${player.name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SelectField>
            <TextField
              label="Minuta"
              inputMode="numeric"
              value={minute}
              error={fieldErrors.minute}
              disabled={save.isPending}
              onChange={(change) => setMinute(change.target.value.replace(/[^\d+]/g, '').slice(0, 6))}
            />
          </div>
          <p className="text-xs text-muted-foreground">Puste pole minuty to zdarzenie bez minuty. Doliczony czas wpisz jako „90+3”.</p>

          <Button
            type="button"
            variant="destructive"
            className="justify-self-start"
            disabled={save.isPending}
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-4" /> Usuń zdarzenie
          </Button>
        </div>
      </FormDialog>

      <ConfirmDeleteDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!open) {
            setConfirming(false);
            remove.reset();
          }
        }}
        onConfirm={() => remove.mutate()}
        entity="zdarzenie"
        name={`${minuteLabel}${event.typeLabel}, ${event.player?.name ?? event.team.name}`}
        pending={remove.isPending}
        error={remove.error ? apiErrorMessage(remove.error) || DELETE_FAILED : undefined}
      />
    </>
  );
}

/** Etykieta, `Select` i błąd pod nim — jak `TextField`, tylko dla listy wyboru. */
function SelectField({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
