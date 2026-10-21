import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  firstFieldErrors,
  isValidationError,
  type Group,
  type Sport,
  type StandingTable,
  type TiebreakerCode,
  type Tournament,
} from '@tournament/api-client';
import {
  Button,
  EmptyState,
  Heading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  StandingsTable,
  TiebreakerEditor,
  TiebreakerSentence,
  toast,
  withQualifiers,
  type TiebreakerItem,
} from '@tournament/ui';
import { ListOrdered } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { UnsavedChangesGuard } from '../components/unsaved-changes-guard';
import { api } from '../lib/api';
import { plural, QUALIFY, TEAMS, TEAMS_CHANGING_PLACE } from '../lib/plural';
import { scheduleKeys, useStages } from '../lib/schedule-queries';
import { useStandings } from '../lib/standings-queries';
import { useSports } from '../lib/use-sports';
import { useTournament } from './tournament-layout';

const SAVE_FAILED = 'Nie udało się zapisać kolejności. Spróbuj ponownie.';

const QUALIFIERS_FAILED = 'Nie udało się zmienić liczby wychodzących. Spróbuj ponownie.';

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
 * Tabela ligi albo tabele grup z kartą „Rozstrzyganie remisów” (#173, wariant
 * z #163). Każda zmiana szkicu odpytuje tabele z parametrem podglądu,
 * a odniesieniem dla strzałek i podświetlenia są tabele według zapisanej
 * listy. Zapis idzie osobno, przyciskiem, samym `{ tiebreakers }`. Lista
 * kryteriów jest jedna na turniej, więc edytor jest wspólny dla wszystkich
 * tabel.
 *
 * Tabela grupy (#259, wariant A z #251) dostaje linię wyjścia, plakietkę
 * remisu na linii i sterowanie liczbą wychodzących. Liczby wychodzących
 * odpowiedź tabeli nie niesie, więc panel bierze ją z grup fazy
 * (`GET /tournaments/{tournament}/stages`).
 */
export function TournamentStandingsPage() {
  const tournament = useTournament();
  const sports = useSports();
  const sport = sports.data?.find((candidate) => candidate.id === tournament.sport.id);

  return <StandingsSection tournament={tournament} sport={sport} sportsFailed={sports.isError} />;
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
  const stages = useStages(tournament.id);
  const groups = useMemo(
    () => new Map((stages.data ?? []).flatMap((stage) => stage.groups).map((group) => [group.id, group] as const)),
    [stages.data],
  );

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
        {/* Bez faz tabela grupy wygląda jak tabela ligi: bez linii i sterowania. */}
        {stages.isError && <EmptyState variant="error" title="Nie udało się wczytać liczby wychodzących z grup" />}
        {tables ? (
          tables.map((table) => {
            const group = table.groupId === null ? undefined : groups.get(table.groupId);
            // Grupa sama: tabele grup stoją tylko w fazie grupowej, więc nazwa fazy nic nie dodaje (#306).
            const heading = table.groupName ?? table.stageName;
            return (
              <section key={`${table.stageId}-${table.groupId}`} aria-label={heading} className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Heading level="card">{heading}</Heading>
                  {group ? (
                    <GroupQualifiersControl tournamentId={tournament.id} group={group} teamsCount={table.rows.length} />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {table.rows.length} {plural(table.rows.length, TEAMS)}
                    </span>
                  )}
                </div>
                <StandingsTable
                  rows={group ? withQualifiers(table.rows, group.qualifiers) : table.rows}
                  scoreLabel={table.scoreLabel}
                  allowsDraw={table.allowsDraw}
                  rallyPointsLabel={table.rallyPointsLabel}
                  previousPositions={previousPositions}
                  emptyAction={teamsLink}
                />
                {group && <QualifiersLegend qualifiers={group.qualifiers} />}
              </section>
            );
          })
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

/**
 * Liczba wychodzących z grupy przy jej tabeli (#259; prototyp #251: „liczbę
 * wychodzących zmienia się przy tabeli”). Wybór od razu idzie
 * `PATCH /groups/{group}`, bez okna: to jedna wartość, a nie formularz.
 * Działa także po zamrożeniu składu, do pierwszego meczu rozpoczętego fazy
 * pucharowej — potem `422` pod `stage` siada tu, pod listą.
 *
 * Po zapisie unieważnia fazy (tam żyje `Group.qualifiers`) i tabele, choć
 * te liczby wychodzących nie niosą — linia i plakietka liczą się z obu.
 */
function GroupQualifiersControl({
  tournamentId,
  group,
  teamsCount,
}: {
  tournamentId: number;
  group: Group;
  teamsCount: number;
}) {
  const queryClient = useQueryClient();
  const change = useMutation({
    mutationFn: async (qualifiers: number) => {
      let result;
      try {
        result = await api.PATCH('/groups/{group}', {
          params: { path: { group: group.id } },
          body: { qualifiers },
        });
      } catch (cause) {
        // `fetch` bez odpowiedzi (sieć) odrzuca `TypeError`.
        if (cause instanceof TypeError) throw new Error(QUALIFIERS_FAILED);
        throw cause;
      }
      const { error, response } = result;
      if (!response.ok) throw response.status === 422 && isValidationError(error) ? error : new Error(QUALIFIERS_FAILED);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleKeys.stages(tournamentId) }),
        queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId, 'standings'] }),
      ]),
  });

  // Grupa mogła stracić drużynę po zapisie składu: bieżąca wartość zostaje
  // na liście, żeby wybór pokazywał to, co zapisane.
  const options = Array.from({ length: Math.max(teamsCount, group.qualifiers, 1) }, (_, index) => index + 1);
  const error = change.isError
    ? isValidationError(change.error)
      ? Object.values(firstFieldErrors(change.error)).join(' ') || change.error.message
      : change.error.message
    : undefined;

  return (
    <div className="space-y-1 text-right">
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>{plural(group.qualifiers, QUALIFY)}</span>
        <Select
          value={String(group.qualifiers)}
          onValueChange={(next) => change.mutate(Number(next))}
          disabled={change.isPending}
        >
          <SelectTrigger size="sm" className="w-16" aria-label={`Ile drużyn wychodzi z grupy ${group.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((count) => (
              <SelectItem key={count} value={String(count)}>
                {count}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>
          z {teamsCount}
        </span>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Zdanie pod tabelą grupy, jak w #259 (wzór: `QualificationLegend` z prototypu #251). */
function QualifiersLegend({ qualifiers }: { qualifiers: number }) {
  return (
    <p className="text-xs text-muted-foreground">
      Z grupy {plural(qualifiers, QUALIFY)} {qualifiers} {plural(qualifiers, TEAMS)} — miejsca nad przerywaną linią.
      Remis na linii rozstrzyga organizer, podmieniając drużynę przy generowaniu drabinki.
    </p>
  );
}
