import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  firstFieldErrors,
  isValidationError,
  type Sport,
  type StandingTable,
  type TiebreakerCode,
  type Tournament,
} from '@tournament/api-client';
import {
  Button,
  EmptyState,
  Heading,
  Skeleton,
  StandingsTable,
  TiebreakerEditor,
  TiebreakerSentence,
  toast,
  type TiebreakerItem,
} from '@tournament/ui';
import { ListOrdered } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { UnsavedChangesGuard } from '../components/unsaved-changes-guard';
import { api } from '../lib/api';
import { plural, TEAMS, TEAMS_CHANGING_PLACE } from '../lib/plural';
import { useSports } from '../lib/use-sports';
import { useTournament } from './tournament-layout';

const SAVE_FAILED = 'Nie udało się zapisać kolejności. Spróbuj ponownie.';

/**
 * Tabele turnieju pod `['tournament', id, 'standings', tiebreakers]`, czyli
 * pod kluczem turnieju: jego odświeżenie po zapisie kolejności odświeża też
 * tabele. `tiebreakers` to lista podglądu albo `null` dla zapisanej.
 *
 * Kolejne podglądy trzymają poprzednie dane do nadejścia nowych
 * (`keepPreviousData`), żeby tabela nie mrugała przy każdym kliknięciu.
 */
function useStandings(tournamentId: number, tiebreakers: string[] | null) {
  return useQuery({
    queryKey: ['tournament', tournamentId, 'standings', tiebreakers],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await api.GET('/tournaments/{tournament}/standings', {
        params: {
          path: { tournament: tournamentId },
          query: tiebreakers ? { tiebreakers: tiebreakers as TiebreakerCode[] } : {},
        },
      });
      if (error) throw new Error(error.message);
      return data.data;
    },
  });
}

/** Miejsca drużyn we wszystkich tabelach, po `team.id`; drużyna jest w jednej tabeli. */
function positionsOf(tables: StandingTable[]): Map<number, number> {
  return new Map(tables.flatMap((table) => table.rows.map((row) => [row.team.id, row.position] as const)));
}

function sameList(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((code, index) => code === b[index]);
}

/**
 * Błąd zapisu do stopki karty. `422` niesie powód pod `tiebreakers` albo
 * `tiebreakers.N`; reszta i padnięta sieć dostają komunikat ogólny, bo tekst
 * przeglądarki byłby po angielsku.
 */
function saveErrorMessage(error: unknown): string {
  if (isValidationError(error)) return Object.values(firstFieldErrors(error)).join(' ') || error.message;
  return SAVE_FAILED;
}

/**
 * Tabela ligi z kartą „Rozstrzyganie remisów” (#173, wariant z #163). Każda
 * zmiana szkicu odpytuje tabelę z parametrem podglądu, a odniesieniem dla
 * strzałek i podświetlenia jest tabela według zapisanej listy. Zapis idzie
 * osobno, przyciskiem, samym `{ tiebreakers }`.
 */
export function TournamentStandingsPage() {
  const tournament = useTournament();
  const sports = useSports();
  const sport = sports.data?.find((candidate) => candidate.id === tournament.sport.id);

  return (
    <AdminPage tournament={tournament} section="standings">
      <StandingsSection tournament={tournament} sport={sport} sportsFailed={sports.isError} />
    </AdminPage>
  );
}

function StandingsSection({
  tournament,
  sport,
  sportsFailed,
}: {
  tournament: Tournament;
  sport: Sport | undefined;
  sportsFailed: boolean;
}) {
  const queryClient = useQueryClient();
  const saved = tournament.tiebreakers;
  // `null`, dopóki organizer niczego nie ruszył: wtedy obowiązuje lista z
  // turnieju, także po jej odświeżeniu z zewnątrz.
  const [draft, setDraft] = useState<string[] | null>(null);
  const current = draft ?? saved;
  const dirty = !sameList(current, saved);

  const base = useStandings(tournament.id, null);
  const shown = useStandings(tournament.id, dirty ? current : null);

  const save = useMutation({
    mutationFn: async (tiebreakers: string[]) => {
      let result;
      try {
        result = await api.PATCH('/tournaments/{tournament}', {
          params: { path: { tournament: tournament.id } },
          body: { tiebreakers: tiebreakers as TiebreakerCode[] },
        });
      } catch (cause) {
        // `fetch` bez odpowiedzi (sieć) odrzuca `TypeError`.
        if (cause instanceof TypeError) throw new Error(SAVE_FAILED);
        throw cause;
      }
      const { error, response } = result;
      if (!response.ok) throw response.status === 422 ? error : new Error(SAVE_FAILED);
    },
    onSuccess: async () => {
      // Turniej niesie zapisaną listę, a tabele leżą pod jego kluczem.
      await queryClient.invalidateQueries({ queryKey: ['tournament', tournament.id] });
      setDraft(null);
      toast.success('Zapisano kolejność kryteriów.');
    },
  });

  /** Nowy szkic albo `null` („Odrzuć”), czyli powrót do listy z turnieju. */
  function change(next: string[] | null) {
    save.reset();
    setDraft(next);
  }

  const reference = useMemo(() => (base.data ? positionsOf(base.data) : undefined), [base.data]);
  const previousPositions = dirty ? reference : undefined;
  const tables = shown.data ?? base.data;

  let preview: string | undefined;
  if (dirty) {
    if (shown.isError) {
      preview = 'Nie udało się przeliczyć podglądu.';
    } else if (shown.isPlaceholderData || !shown.data || !reference) {
      preview = 'Podgląd: przeliczam tabelę…';
    } else {
      const moved = shown.data.flatMap((table) => table.rows).filter((row) => reference.get(row.team.id) !== row.position).length;
      preview = moved
        ? `Podgląd: ${moved} ${plural(moved, TEAMS_CHANGING_PLACE)} miejsce.`
        : 'Podgląd: kolejność w tabeli bez zmian.';
    }
  }

  const labels = sport?.config.tiebreakerLabels ?? {};
  const label = (code: string) => labels[code as TiebreakerCode] ?? code;
  const available: TiebreakerItem[] = (sport?.config.availableTiebreakers ?? []).map((code) => ({
    code,
    label: label(code),
  }));

  // Faza pucharowa nie ma tabeli, więc i kolejności nie ma czego ustawiać.
  if (tables && tables.length === 0) {
    return (
      <EmptyState
        icon={<ListOrdered />}
        title="Ten turniej nie ma tabeli"
        description="Tabelę ma faza ligowa i każda grupa. Faza pucharowa układa się w drabinkę."
      />
    );
  }

  let editor;
  if (sport) {
    editor = (
      <TiebreakerEditor
        value={current}
        onChange={change}
        available={available}
        dirty={dirty}
        pending={save.isPending}
        preview={preview}
        error={save.isError ? saveErrorMessage(save.error) : undefined}
        onSave={() => save.mutate(current)}
        onDiscard={() => change(null)}
      />
    );
  } else if (sportsFailed) {
    editor = <EmptyState variant="error" title="Nie udało się wczytać kryteriów sportu" />;
  } else {
    editor = <Skeleton role="status" aria-label="Wczytywanie kryteriów" className="h-80 w-full" />;
  }

  const teamsLink = (
    <Button asChild>
      <Link to={`/tournaments/${tournament.id}/teams`}>Przejdź do drużyn</Link>
    </Button>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-6">
        {/* Kolumnę R, jak nagłówek zdobyczy i zdanie pod tabelą, niesie
            odpowiedź tabeli (`allowsDraw`), więc tabela nie czeka na
            `GET /sports` — ten potrzebny jest już tylko edytorowi kryteriów. */}
        {tables ? (
          tables.map((table) => (
            <section key={`${table.stageId}-${table.groupId}`} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Heading level="card">
                  {table.groupName ? `${table.stageName} · ${table.groupName}` : table.stageName}
                </Heading>
                <span className="text-xs text-muted-foreground">
                  {table.rows.length} {plural(table.rows.length, TEAMS)}
                </span>
              </div>
              <StandingsTable
                rows={table.rows}
                scoreLabel={table.scoreLabel}
                allowsDraw={table.allowsDraw}
                previousPositions={previousPositions}
                emptyAction={teamsLink}
              />
            </section>
          ))
        ) : (
          <StandingsTable
            rows={[]}
            scoreLabel=""
            // Szkielet bez R: przed odpowiedzią nie wiadomo, czy sport zna remisy.
            allowsDraw={false}
            status={base.isError ? 'error' : 'pending'}
            errorMessage={base.error?.message}
            onRetry={() => void base.refetch()}
          />
        )}
        {/* Zdanie z `tiebreakers` odpowiedzi, a nie ze szkicu: zgadza się
            z wierszami, nad którymi stoi, także zanim podgląd dotrze. */}
        {tables?.[0] && <TiebreakerSentence items={tables[0].tiebreakers} />}
      </div>
      <div className="lg:sticky lg:top-4">{editor}</div>
      <UnsavedChangesGuard when={dirty} />
    </div>
  );
}
