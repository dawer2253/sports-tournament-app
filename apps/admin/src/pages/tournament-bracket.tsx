import { useMutation, useQueryClient } from '@tanstack/react-query';
import { firstFieldErrors, isValidationError, type AdminMatch, type Stage, type Team } from '@tournament/api-client';
import {
  BracketChampion,
  BracketMatchRow,
  Button,
  Card,
  CardContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  FirstRoundPreview,
  FormDialog,
  Label,
  RoundTabs,
  SeedingList,
  Skeleton,
  Switch,
  cn,
  toast,
  type SeedingTeam,
} from '@tournament/ui';
import { CalendarClock, GitFork, MoreHorizontal, RefreshCw, Trophy, UserX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { DatesDialog } from '../components/dates-dialog';
import { api } from '../lib/api';
import {
  bracketByes,
  bracketChampion,
  bracketRounds,
  bracketRow,
  bracketSizeSentence,
  type BracketRound,
} from '../lib/bracket';
import { BRACKET_ROUNDS_ACCUSATIVE, MATCHES, plural } from '../lib/plural';
import { defaultRound, hasStartedMatches, teamsWithoutMatches } from '../lib/schedule';
import { scheduleKeys, useStageMatches, useStages } from '../lib/schedule-queries';
import { teamKeys, useTeams } from '../lib/team-queries';
import { useTournament } from './tournament-layout';

/** Parametr adresu z wybraną rundą: jej `order`, jak `?round=` w Terminarzu. */
const ROUND_PARAM = 'round';

const GENERATE_FAILED = 'Nie udało się wygenerować drabinki. Spróbuj ponownie.';

/**
 * Drabinka pucharu w panelu (#227, wariant B z #217): karty rund nad listą
 * meczów wybranej rundy. Rundy, etykiety pozycji i krawędzie panel liczy
 * z kompletu meczów fazy (`lib/bracket.ts`), bo kontrakt nie ma listy rund.
 *
 * Generowanie z rozstawieniem i rozkład dat idą w oknach, otwieranych
 * z pustego stanu, z akcji nagłówka albo z podpowiedzi nad kartami. Wiersze
 * są tylko do odczytu; okno meczu z wynikiem i karnymi dokłada #228.
 */
export function TournamentBracketPage() {
  const tournament = useTournament();
  const stages = useStages(tournament.id);
  const cup = stages.data?.find((stage) => stage.type === 'knockout');
  const matches = useStageMatches(tournament.id, cup?.id);
  const teams = useTeams(tournament.id);
  const [generating, setGenerating] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [, setParams] = useSearchParams();

  const started = hasStartedMatches(matches.data ?? []);
  const hasBracket = (matches.data?.length ?? 0) > 0;
  const openGenerate = () => setGenerating(true);
  const openDates = () => setDistributing(true);

  /** Nowa drabinka zaczyna od rundy 1, a nie od rundy zapamiętanej w adresie. */
  function forgetRound() {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(ROUND_PARAM);
        return next;
      },
      { replace: true },
    );
  }

  let content;
  if (stages.isError || matches.isError) {
    const failed = stages.isError ? stages : matches;
    content = (
      <EmptyState
        variant="error"
        title="Nie udało się wczytać drabinki"
        description={failed.error?.message}
        action={
          <Button variant="outline" onClick={() => void failed.refetch()}>
            Spróbuj ponownie
          </Button>
        }
      />
    );
  } else if (stages.data && !cup) {
    content = (
      <EmptyState
        icon={<Trophy />}
        title="Ten turniej nie ma fazy pucharowej"
        description="Drabinka powstaje w turnieju pucharowym. Mecze ligi są na karcie Terminarz."
      />
    );
  } else if (!matches.data) {
    content = (
      <Card aria-busy="true" aria-label="Wczytywanie drabinki">
        <CardContent className="space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  } else if (!hasBracket) {
    content = <EmptyBracket tournamentId={tournament.id} teamsCount={teams.data?.length} onGenerate={openGenerate} />;
  } else {
    const rounds = bracketRounds(matches.data);
    const champion = bracketChampion(matches.data);
    content = (
      <>
        <OutsideBracketNotice
          teams={teamsWithoutMatches(teams.data ?? [], matches.data)}
          started={started}
          onGenerate={openGenerate}
        />
        <WithoutDatesNotice matches={matches.data} onDistribute={openDates} />
        <RoundsView rounds={rounds} matches={matches.data} />
        {champion && <BracketChampion team={champion} className="mt-4 max-w-sm" />}
      </>
    );
  }

  return (
    <AdminPage
      tournament={tournament}
      section="bracket"
      actions={
        cup &&
        hasBracket && (
          <>
            <Button variant="outline" onClick={openDates}>
              <CalendarClock className="size-4" /> Rozłóż daty
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Więcej akcji drabinki">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                {/* Wyłączona, a nie ukryta: organizer widzi, że akcja istnieje,
                    tylko faza ma już mecz rozpoczęty (#215). */}
                <DropdownMenuItem disabled={started} onSelect={openGenerate}>
                  <RefreshCw /> Wygeneruj ponownie
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )
      }
    >
      {content}
      {generating && cup && teams.data && (
        <GenerateBracketDialog
          tournamentId={tournament.id}
          stage={cup}
          teams={teams.data}
          currentMatches={matches.data?.length ?? 0}
          onClose={() => setGenerating(false)}
          onDone={() => {
            setGenerating(false);
            forgetRound();
          }}
        />
      )}
      {distributing && cup && matches.data && (
        <DatesDialog
          tournament={tournament}
          stage={cup}
          matches={matches.data}
          rounds={bracketRounds(matches.data)}
          unit="runda"
          onClose={() => setDistributing(false)}
        />
      )}
    </AdminPage>
  );
}

/**
 * Pusty stan: zdanie o rozmiarze drabinki i „Rozstaw i wygeneruj”. Przy
 * mniej niż dwóch drużynach przycisk jest wyłączony, a obok stoi odnośnik do
 * Drużyn, jak w pustym Terminarzu ligi.
 */
function EmptyBracket({
  tournamentId,
  teamsCount,
  onGenerate,
}: {
  tournamentId: number;
  teamsCount: number | undefined;
  onGenerate: () => void;
}) {
  const tooFew = teamsCount !== undefined && teamsCount < 2;
  return (
    <EmptyState
      icon={<GitFork />}
      title="Drabinka nie jest jeszcze wygenerowana"
      description={
        teamsCount === undefined
          ? undefined
          : tooFew
            ? 'Puchar potrzebuje co najmniej dwóch drużyn. Dodaj je w zakładce Drużyny.'
            : `${bracketSizeSentence(teamsCount)} Najpierw ustalisz rozstawienie, daty rozłożysz potem.`
      }
      action={
        tooFew ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button disabled>
              <RefreshCw className="size-4" /> Rozstaw i wygeneruj
            </Button>
            <Button asChild variant="outline">
              <Link to={`/tournaments/${tournamentId}/teams`}>Przejdź do drużyn</Link>
            </Button>
          </div>
        ) : (
          <Button disabled={teamsCount === undefined} onClick={onGenerate}>
            <RefreshCw className="size-4" /> Rozstaw i wygeneruj
          </Button>
        )
      }
    />
  );
}

/**
 * Drużyna dodana po wygenerowaniu nie stoi w drabince (#215), jak w lidze
 * (`MissingTeamsNotice` w Terminarzu). Przy meczu rozpoczętym akcja jest
 * wyłączona tak samo jak w menu „⋯”.
 */
function OutsideBracketNotice({
  teams,
  started,
  onGenerate,
}: {
  teams: Team[];
  started: boolean;
  onGenerate: () => void;
}) {
  if (teams.length === 0) return null;
  const names = teams.map((team) => team.name).join(', ');
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
      <UserX aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1">
        {names} {teams.length === 1 ? 'jest' : 'są'} w turnieju, ale nie w drabince — wygeneruj ją ponownie.
      </p>
      <Button size="sm" variant="outline" disabled={started} onClick={onGenerate}>
        Wygeneruj ponownie
      </Button>
    </div>
  );
}

/** Świeża drabinka nie ma dat; podpowiedź ma ten sam przycisk co nagłówek. */
function WithoutDatesNotice({ matches, onDistribute }: { matches: AdminMatch[]; onDistribute: () => void }) {
  if (matches.some((match) => match.kickoffAt !== null)) return null;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 p-3 text-sm">
      <CalendarClock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1">Drabinka nie ma jeszcze dat. Rozłóż je, żeby mecze dostały terminy i obiekty.</p>
      <Button size="sm" variant="outline" onClick={onDistribute}>
        Rozłóż daty
      </Button>
    </div>
  );
}

/**
 * Runda z adresu (`?round=2`, po `order`), więc wybór przetrwa odświeżenie.
 * Bez parametru albo z numerem, którego nie ma, otwiera się runda z pierwszym
 * meczem niezakończonym. Wolne losy opisuje notka pod 1. i 2. rundą: w 1.
 * brakuje po nich meczu, w 2. drużyna już stoi.
 */
function RoundsView({ rounds, matches }: { rounds: BracketRound[]; matches: AdminMatch[] }) {
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get(ROUND_PARAM));
  const round = rounds.find((candidate) => candidate.order === requested) ?? defaultRound(rounds);
  if (!round) return null;
  const byes = round.order <= 2 ? bracketByes(matches) : [];

  function select(id: number) {
    const target = rounds.find((candidate) => candidate.id === id);
    if (!target) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(ROUND_PARAM, String(target.order));
        return next;
      },
      { replace: true },
    );
  }

  return (
    <>
      <RoundTabs
        rounds={rounds.map((candidate) => candidate.summary)}
        value={round.id}
        onValueChange={select}
        className="mb-4"
      />
      <div role="tabpanel" aria-label={round.name}>
        <ul className="space-y-2">
          {round.matches.map((match) => (
            <li key={match.id}>
              {/* Tylko do odczytu: okno meczu z wynikiem i karnymi dokłada #228. */}
              <BracketMatchRow match={bracketRow(match, matches)} />
            </li>
          ))}
        </ul>
      </div>
      {byes.length > 0 && (
        <p className="mt-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Wolne losy (bez meczu w 1. rundzie): {byes.map((bye) => `${bye.team} → ${bye.target}`).join(', ')}
        </p>
      )}
    </>
  );
}

/**
 * Okno „Rozstaw i wygeneruj” (#217, ustalenia 1–2): lista rozstawienia
 * startująca od kolejności drużyn z listy (backend jej nie przechowuje, więc
 * nie ma „Poprzedniej”), obok podgląd par 1. rundy i mecz o 3. miejsce.
 * Przy istniejącej drabince tytuł, ostrzeżenie i przycisk mówią o zastąpieniu,
 * bez osobnego kroku potwierdzenia, bo API zastępuje bez pytania (#215).
 *
 * `422` pod `thirdPlaceMatch` siada przy przełączniku, reszta (`teamIds`,
 * `teams`, `stage`) nad przyciskami. Sukces unieważnia mecze i drużyny
 * (liczniki meczów zaplanowanych), a okno zamyka się po odświeżeniu listy.
 */
function GenerateBracketDialog({
  tournamentId,
  stage,
  teams,
  currentMatches,
  onClose,
  onDone,
}: {
  tournamentId: number;
  stage: Stage;
  teams: Team[];
  currentMatches: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<SeedingTeam[]>(() => teams.map(({ id, name }) => ({ id, name })));
  const [locked, setLocked] = useState(0);
  const thirdPlaceAllowed = order.length >= 4;
  const [thirdPlace, setThirdPlace] = useState(thirdPlaceAllowed);
  const [thirdPlaceError, setThirdPlaceError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const replacing = currentMatches > 0;

  const generate = useMutation({
    mutationFn: async (body: { teamIds: number[]; thirdPlaceMatch: boolean }) => {
      let result;
      try {
        result = await api.POST('/stages/{stage}/bracket', { params: { path: { stage: stage.id } }, body });
      } catch (cause) {
        // `fetch` bez odpowiedzi (sieć) odrzuca `TypeError`. Inny wyjątek to
        // błąd w kodzie i ma polecieć dalej, a nie udawać padniętej sieci.
        if (cause instanceof TypeError) throw new Error(GENERATE_FAILED);
        throw cause;
      }
      const { data, error, response } = result;
      if (data) return data.data;
      throw response.status === 422 && isValidationError(error) ? error : new Error(GENERATE_FAILED);
    },
    onSuccess: async ({ roundsCount, matchesCount }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleKeys.matches(tournamentId) }),
        queryClient.invalidateQueries({ queryKey: teamKeys.list(tournamentId) }),
      ]);
      toast.success(
        `Wygenerowano drabinkę: ${roundsCount} ${plural(roundsCount, BRACKET_ROUNDS_ACCUSATIVE)}, ${matchesCount} ${plural(matchesCount, MATCHES)}`,
      );
      onDone();
    },
    onError: (error) => {
      if (isValidationError(error)) {
        const { thirdPlaceMatch, ...rest } = firstFieldErrors(error);
        setThirdPlaceError(thirdPlaceMatch);
        setFormError(rest.teamIds ?? rest.teams ?? rest.stage ?? Object.values(rest)[0]);
      } else {
        setFormError(error.message);
      }
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    setThirdPlaceError(undefined);
    generate.mutate({ teamIds: order.map((team) => team.id), thirdPlaceMatch: thirdPlaceAllowed && thirdPlace });
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={submit}
      title={replacing ? 'Rozstaw i wygeneruj ponownie' : 'Rozstaw i wygeneruj'}
      description={`${stage.name} · ${bracketSizeSentence(order.length)}`}
      submitLabel={replacing ? 'Zastąp drabinkę' : 'Wygeneruj'}
      pending={generate.isPending}
      error={formError}
      contentClassName="max-h-[92vh] overflow-y-auto sm:max-w-3xl"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SeedingList
          value={order}
          onChange={setOrder}
          locked={locked}
          onLockedChange={setLocked}
          disabled={generate.isPending}
        />
        <div className="grid content-start gap-3">
          <FirstRoundPreview seeding={order} />
          <div data-slot="third-place-field" className="grid gap-1.5">
            <Label className={cn('flex items-start gap-3 rounded-md border p-3 font-normal', !thirdPlaceAllowed && 'opacity-60')}>
              <Switch
                checked={thirdPlaceAllowed && thirdPlace}
                disabled={!thirdPlaceAllowed || generate.isPending}
                onCheckedChange={setThirdPlace}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">Mecz o 3. miejsce</span>
                <span className="block text-xs text-muted-foreground">
                  {thirdPlaceAllowed
                    ? 'Grają przegrani półfinałów, w rundzie finału, przed finałem.'
                    : 'Wymaga co najmniej czterech drużyn.'}
                </span>
              </span>
            </Label>
            {thirdPlaceError && <p className="text-sm text-destructive">{thirdPlaceError}</p>}
          </div>
        </div>
      </div>
      {replacing && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Obecna drabinka ({currentMatches} {plural(currentMatches, MATCHES)}) zniknie razem z terminami i obiektami,
          także poprawionymi ręcznie.
        </p>
      )}
    </FormDialog>
  );
}
