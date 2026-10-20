import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { firstFieldErrors, isValidationError, type Tournament, type TeamRegistration } from '@tournament/api-client';
import {
  Button,
  ConfirmDeleteDialog,
  EmptyState,
  RegistrationsBoard,
  registrationsEmptyDescription,
  Skeleton,
  toast,
} from '@tournament/ui';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { ApiError } from '../lib/api-error';
import { apiErrorMessage } from '../lib/form-errors';
import { scheduleKeys, useStages } from '../lib/schedule-queries';
import { useTournament } from './tournament-layout';

/** Zgłoszenia turnieju, pod `['tournament', id]` jak inne listy (`apps/admin/AGENTS.md`). */
const registrationKeys = {
  list: (tournamentId: number) => ['tournament', tournamentId, 'registrations'] as const,
};

const ACCEPT_FAILED = 'Nie udało się przyjąć zgłoszenia. Spróbuj ponownie.';
const REJECT_FAILED = 'Nie udało się odrzucić zgłoszenia. Spróbuj ponownie.';

/** Komunikat błędu decyzji: z `422` pierwszy błąd (`name`, `teams`, `registration`), inaczej treść odpowiedzi. */
function decisionError(error: unknown, fallback: string): string {
  if (isValidationError(error)) return Object.values(firstFieldErrors(error))[0] || error.message;
  return apiErrorMessage(error) || fallback;
}

function useRegistrations(tournamentId: number) {
  return useQuery({
    queryKey: registrationKeys.list(tournamentId),
    queryFn: async () => {
      const { data, error, response } = await api.GET('/tournaments/{tournament}/registrations', {
        params: { path: { tournament: tournamentId } },
      });
      if (error) throw new ApiError(error.message, response.status);
      return data.data;
    },
  });
}

/**
 * Czy turniej ma już skład grup albo terminarz. Przyjęta drużyna dochodzi
 * wtedy jak każda inna: bez grupy i poza terminarzem (`CONTEXT.md`, „Team”),
 * więc panel uprzedza o tym przy „Przyjmij”. Terminarz rozpoznajemy po
 * jednym meczu z listy turnieju.
 */
function useAcceptNote(tournamentId: number): string | undefined {
  const stages = useStages(tournamentId);
  const anyMatch = useQuery({
    queryKey: [...scheduleKeys.matches(tournamentId), 'any'],
    queryFn: async () => {
      const { data, error, response } = await api.GET('/tournaments/{tournament}/matches', {
        params: { path: { tournament: tournamentId }, query: { perPage: 1 } },
      });
      if (error) throw new ApiError(error.message, response.status);
      return data.meta.total > 0;
    },
  });
  const groups = (stages.data ?? []).some((stage) => stage.groups.length > 0);
  if (groups) return 'Skład grup jest już ustalony: przyjęta drużyna nie będzie miała grupy, dopóki nie zapiszesz składu od nowa.';
  if (anyMatch.data) return 'Terminarz jest już ułożony: przyjęta drużyna nie zagra w nim, dopóki nie wygenerujesz go od nowa.';
  return undefined;
}

/**
 * Zgłoszenia drużyn (#300): oczekujące z „Przyjmij” i „Odrzuć”, pod nimi
 * rozpatrzone. Przyjęcie tworzy drużynę od razu, a jego błąd (`422`: nazwa
 * zajęta, komplet drużyn, mecz rozpoczęty) siada przy zgłoszeniu. Odrzucenie
 * kasuje dane zgłaszającego, więc idzie przez okno potwierdzenia.
 *
 * Każda decyzja unieważnia `['tournament', id]`: stamtąd idą licznik
 * oczekujących w karcie, `teamsCount` i lista drużyn.
 */
export function RegistrationsPage() {
  const tournament = useTournament();
  const registrations = useRegistrations(tournament.id);
  const note = useAcceptNote(tournament.id);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [rejecting, setRejecting] = useState<TeamRegistration | null>(null);

  if (registrations.isError && !registrations.data) {
    return (
      <EmptyState
        variant="error"
        icon={<AlertTriangle />}
        title="Nie udało się wczytać zgłoszeń"
        description={registrations.error.message}
        action={
          <Button variant="outline" onClick={() => void registrations.refetch()}>
            Spróbuj ponownie
          </Button>
        }
      />
    );
  }

  if (!registrations.data) return <Skeleton role="status" aria-label="Wczytywanie zgłoszeń" className="h-64 w-full" />;

  return (
    <>
      <RegistrationsBoard
        registrations={registrations.data}
        emptyDescription={registrationsEmptyDescription(tournament.registration.open)}
        pendingCard={(registration) => ({
          note,
          error: errors[registration.id],
          actions: (
            <>
              <AcceptButton
                tournament={tournament}
                registration={registration}
                onError={(message) => setErrors((current) => ({ ...current, [registration.id]: message }))}
                onAccepted={() => setErrors((current) => Object.fromEntries(Object.entries(current).filter(([id]) => Number(id) !== registration.id)))}
              />
              <Button variant="outline" onClick={() => setRejecting(registration)}>
                Odrzuć
              </Button>
            </>
          ),
        })}
      />
      {rejecting && <RejectDialog tournament={tournament} registration={rejecting} onClose={() => setRejecting(null)} />}
    </>
  );
}

function AcceptButton({
  tournament,
  registration,
  onError,
  onAccepted,
}: {
  tournament: Tournament;
  registration: TeamRegistration;
  onError: (message: string) => void;
  onAccepted: () => void;
}) {
  const queryClient = useQueryClient();
  const accept = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/registrations/{registration}/accept', {
        params: { path: { registration: registration.id } },
      });
      if (!data) throw error ?? new Error(ACCEPT_FAILED);
      return data.data;
    },
    onSuccess: async (team) => {
      onAccepted();
      toast.success(`Przyjęto zgłoszenie. Drużyna „${team.name}” jest na liście drużyn.`);
      await queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] });
    },
    // Zgłoszenie mogło zniknąć albo zmienić się w tle: lista pokaże stan z API.
    onError: async (error) => {
      onError(error instanceof TypeError ? ACCEPT_FAILED : decisionError(error, ACCEPT_FAILED));
      await queryClient.invalidateQueries({ queryKey: registrationKeys.list(tournament.id) });
    },
  });

  return (
    <Button disabled={accept.isPending} onClick={() => accept.mutate()}>
      {accept.isPending ? 'Przyjmowanie…' : 'Przyjmij'}
    </Button>
  );
}

function RejectDialog({ tournament, registration, onClose }: { tournament: Tournament; registration: TeamRegistration; onClose: () => void }) {
  const queryClient = useQueryClient();
  const reject = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/registrations/{registration}/reject', {
        params: { path: { registration: registration.id } },
      });
      if (!data) throw error ?? new Error(REJECT_FAILED);
      return data.data;
    },
    onSuccess: async () => {
      toast.success(`Odrzucono zgłoszenie „${registration.teamName}”.`);
      onClose();
      await queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] });
    },
  });

  return (
    <ConfirmDeleteDialog
      open
      onOpenChange={(open) => !open && onClose()}
      entity="zgłoszenie"
      name={registration.teamName}
      title={`Odrzucić zgłoszenie „${registration.teamName}”?`}
      confirmLabel="Odrzuć zgłoszenie"
      description="Dane osoby kontaktowej i skład zostaną usunięte. Zostanie sama nazwa drużyny z datą decyzji. Tego nie da się cofnąć."
      pending={reject.isPending}
      error={reject.isError ? (reject.error instanceof TypeError ? REJECT_FAILED : decisionError(reject.error, REJECT_FAILED)) : undefined}
      onConfirm={() => reject.mutate()}
    />
  );
}
