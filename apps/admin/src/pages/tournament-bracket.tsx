import { useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  firstFieldErrors,
  isValidationError,
  type AdminMatch,
  type BracketSeed,
  type Group,
  type Stage,
  type Team,
} from '@tournament/api-client';
import {
  BracketChampion,
  BracketMatchRow,
  bracketByes,
  bracketChampion,
  bracketSeeding,
  isThirdPlaceMatch,
  matchLabel,
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
import { CalendarClock, GitFork, Info, MoreHorizontal, RefreshCw, TriangleAlert, Trophy, UserX } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { DatesDialog } from '../components/dates-dialog';
import { MatchDialog } from '../components/match-dialog';
import { SectionActions } from '../components/section-actions';
import { api } from '../lib/api';
import { bracketRounds, bracketRow, bracketSizeSentence, type BracketRound } from '../lib/bracket';
import { BRACKET_ROUNDS_ACCUSATIVE, MATCHES, QUALIFY, UNPLAYED_GROUP_MATCHES, plural } from '../lib/plural';
import {
  bracketDivergence,
  divergenceSentence,
  groupTeamsFromTables,
  seedingFromProposal,
  type GroupDivergence,
} from '../lib/qualification';
import { defaultRound, hasStartedMatches, teamsWithoutMatches } from '../lib/schedule';
import { scheduleKeys, useBracketSeeding, useStageMatches, useStages } from '../lib/schedule-queries';
import { useStandings } from '../lib/standings-queries';
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
 * z pustego stanu, z akcji nagłówka albo z podpowiedzi nad kartami. Wiersz
 * meczu otwiera to samo okno meczu co Terminarz ligi, z karnymi i notką przed
 * zapisem (#228). Po zapisie okno odświeża mecze turnieju, więc drużyna
 * podmieniona w meczu zależnym pojawia się na karcie rund.
 *
 * W turnieju z fazą grupową (#260, wariant A z #251) drabinka powstaje
 * z wyjścia z grup: okno startuje z propozycji z tabel, pusty stan mówi
 * o liczbie wychodzących i nierozegranych meczach grup, a po wygenerowaniu
 * notka opisuje rozjazd drabinki z tabelami. Drużyny spoza drabinki są wtedy
 * normalne (nie wyszły z grup), więc notki o nich nie ma.
 */
export function TournamentBracketPage() {
  const tournament = useTournament();
  const stages = useStages(tournament.id);
  const cup = stages.data?.find((stage) => stage.type === 'knockout');
  const matches = useStageMatches(tournament.id, cup?.id);
  const teams = useTeams(tournament.id);
  const [generating, setGenerating] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [openMatchId, setOpenMatchId] = useState<number | null>(null);
  const [, setParams] = useSearchParams();

  const started = hasStartedMatches(matches.data ?? []);
  const selectedMatch = matches.data?.find((match) => match.id === openMatchId);
  const hasBracket = (matches.data?.length ?? 0) > 0;

  const groupStage = stages.data?.find((stage) => stage.type === 'group');
  const hasComposition = (groupStage?.groups.length ?? 0) > 0;
  const groupMatches = useStageMatches(tournament.id, groupStage?.id);
  const unplayed = (groupMatches.data ?? []).filter((match) => match.status !== 'finished').length;
  // Propozycja jest potrzebna tylko pustemu stanowi, a tabele — notce o rozjeździe.
  const proposal = useBracketSeeding(tournament.id, cup?.id, hasComposition && matches.data !== undefined && !hasBracket);
  const tables = useStandings(tournament.id, null, hasComposition && hasBracket);
  const openGenerate = () => setGenerating(true);
  const openDates = () => setDistributing(true);

  /**
   * Otwiera okno meczu i przełącza karty na jego rundę — przy kliknięciu
   * wiersza i przy kliknięciu kolizji, która prowadzi do meczu innej rundy.
   */
  function openMatch(match: AdminMatch) {
    setOpenMatchId(match.id);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set(ROUND_PARAM, String(match.round.order));
        return next;
      },
      { replace: true },
    );
  }

  /** Po wygenerowaniu okno znika, a nowa drabinka zaczyna od rundy 1. */
  function finishGenerate() {
    setGenerating(false);
    forgetRound();
  }

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
    content = groupStage ? (
      <EmptyPlayoffBracket
        tournamentId={tournament.id}
        hasComposition={hasComposition}
        proposal={proposal}
        unplayed={unplayed}
        onGenerate={openGenerate}
      />
    ) : (
      <EmptyBracket tournamentId={tournament.id} teamsCount={teams.data?.length} onGenerate={openGenerate} />
    );
  } else {
    const rounds = bracketRounds(matches.data);
    const champion = bracketChampion(matches.data);
    content = (
      <>
        {groupStage ? (
          <DivergenceNotice
            divergences={tables.data ? bracketDivergence(bracketTeamIds(matches.data), tables.data, groupStage.groups) : []}
            started={started}
            onGenerate={openGenerate}
          />
        ) : (
          <OutsideBracketNotice
            teams={teamsWithoutMatches(teams.data ?? [], matches.data)}
            started={started}
            onGenerate={openGenerate}
          />
        )}
        <WithoutDatesNotice matches={matches.data} onDistribute={openDates} />
        <RoundsView
          rounds={rounds}
          matches={matches.data}
          penaltySlot={tournament.sport.allowsDraw}
          onSelectMatch={openMatch}
        />
        {champion && <BracketChampion team={champion} className="mt-4 max-w-sm" />}
      </>
    );
  }

  return (
    <>
      <SectionActions>
        {cup && hasBracket && (
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
        )}
      </SectionActions>
      {content}
      {generating &&
        cup &&
        teams.data &&
        (groupStage ? (
          <PlayoffSeedingDialog
            tournamentId={tournament.id}
            stage={cup}
            groups={groupStage.groups}
            teams={teams.data}
            current={matches.data ?? []}
            unplayed={unplayed}
            onClose={() => setGenerating(false)}
            onDone={finishGenerate}
          />
        ) : (
          <GenerateBracketDialog
            tournamentId={tournament.id}
            stage={cup}
            initialOrder={initialSeeding(teams.data, matches.data ?? [])}
            current={matches.data ?? []}
            onClose={() => setGenerating(false)}
            onDone={finishGenerate}
          />
        ))}
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
      {selectedMatch && matches.data && (
        <MatchDialog
          key={selectedMatch.id}
          match={selectedMatch}
          tournamentId={tournament.id}
          matches={matches.data}
          onOpenMatch={openMatch}
          onClose={() => setOpenMatchId(null)}
          sportCode={tournament.sport.code}
          knockout
        />
      )}
    </>
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
 * Pusty stan w turnieju z fazą grupową (#260): drabinka czeka na wyjście
 * z grup. Z propozycją zdanie mówi, ile drużyn wychodzi i jaka będzie
 * drabinka; bez składu albo przy odmowie propozycji (grupa mniejsza niż
 * liczba wychodzących) przycisk jest wyłączony, a obok stoi odnośnik do Grup.
 * Nierozegrane mecze grup tylko ostrzegają: generować wolno zawsze (#250).
 */
function EmptyPlayoffBracket({
  tournamentId,
  hasComposition,
  proposal,
  unplayed,
  onGenerate,
}: {
  tournamentId: number;
  hasComposition: boolean;
  proposal: UseQueryResult<BracketSeed[], Error>;
  unplayed: number;
  onGenerate: () => void;
}) {
  const blocked = !hasComposition || proposal.isError;
  let description: string | undefined;
  if (!hasComposition) {
    description = 'Drabinka powstaje z wyjścia z grup. Najpierw ustal skład grup w zakładce Grupy.';
  } else if (proposal.isError) {
    description = proposal.error.message;
  } else if (proposal.data) {
    const count = proposal.data.length;
    description = `Z grup ${plural(count, QUALIFY)} ${bracketSizeSentence(count)} Rozstawienie startuje z tabel grup.`;
  }
  const generate = (
    <Button disabled={blocked || !proposal.data} onClick={onGenerate}>
      <RefreshCw className="size-4" /> Rozstaw i wygeneruj
    </Button>
  );
  return (
    <>
      {hasComposition && <UnplayedGroupMatchesNotice count={unplayed} className="mb-4" />}
      <EmptyState
        icon={<GitFork />}
        title="Drabinka nie jest jeszcze wygenerowana"
        description={description}
        action={
          blocked ? (
            <div className="flex flex-wrap justify-center gap-2">
              {generate}
              <Button asChild variant="outline">
                <Link to={`/tournaments/${tournamentId}/groups`}>Przejdź do grup</Link>
              </Button>
            </div>
          ) : (
            generate
          )
        }
      />
    </>
  );
}

/** Ostrzeżenie, że tabele grup mogą się jeszcze zmienić; nie blokuje generowania (#250). */
function UnplayedGroupMatchesNotice({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <div role="status" className={cn('flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 p-3 text-sm', className)}>
      <TriangleAlert aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1">
        {count} {plural(count, UNPLAYED_GROUP_MATCHES)}. Drabinkę wygenerujesz już teraz, ale tabele mogą się jeszcze
        zmienić.
      </p>
    </div>
  );
}

/** Drużyny stojące w drabince: z wszystkich meczów fazy, także z wolnym losem. */
function bracketTeamIds(matches: AdminMatch[]): Set<number> {
  return new Set(
    matches.flatMap((match) => [match.homeTeam?.id, match.awayTeam?.id]).filter((id): id is number => id !== undefined),
  );
}

/**
 * Rozjazd drabinki z tabelami grup (#250): opis neutralny, bo podmiana to
 * zwykle świadome rozstrzygnięcie remisu na linii. Panel liczy go sam
 * (`bracketDivergence`) i niczego nie zapisuje. „Wygeneruj ponownie” liczy
 * propozycję od nowa i jest wyłączone po starcie playoffu, jak w menu „⋯”.
 */
function DivergenceNotice({
  divergences,
  started,
  onGenerate,
}: {
  divergences: GroupDivergence[];
  started: boolean;
  onGenerate: () => void;
}) {
  if (divergences.length === 0) return null;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3 text-sm">
      <Info aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <p className="min-w-0 flex-1">
        {divergenceSentence(divergences)} Wynik meczu grupy wpisany po wygenerowaniu drabinki jej nie rusza.
      </p>
      <Button size="sm" variant="outline" disabled={started} onClick={onGenerate}>
        Wygeneruj ponownie
      </Button>
    </div>
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
function RoundsView({
  rounds,
  matches,
  penaltySlot,
  onSelectMatch,
}: {
  rounds: BracketRound[];
  matches: AdminMatch[];
  /** Sport z remisem: pole wyniku ma miejsce na karne (#234). */
  penaltySlot: boolean;
  onSelectMatch: (match: AdminMatch) => void;
}) {
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
              <BracketMatchRow
                match={bracketRow(match, matches)}
                penaltySlot={penaltySlot}
                onSelect={() => onSelectMatch(match)}
              />
            </li>
          ))}
        </ul>
      </div>
      {byes.length > 0 && (
        <p className="mt-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Wolne losy (bez meczu w 1. rundzie): {byes.map((bye) => `${bye.team.name} → ${matchLabel(bye.target, matches)}`).join(', ')}
        </p>
      )}
    </>
  );
}

/**
 * Okno „Rozstaw i wygeneruj” w turnieju z fazą grupową (#260). Propozycja
 * i tabele liczą się przy odczycie, więc okno czeka na odczyt świeższy niż
 * ono samo (także przy „Wygeneruj ponownie”: propozycja z bieżących tabel,
 * a nie z obecnej drabinki). Do tego czasu stoi szkielet, a odmowa
 * propozycji (`422`) siada w miejscu błędu okna.
 */
function PlayoffSeedingDialog({
  tournamentId,
  stage,
  groups,
  teams,
  current,
  unplayed,
  onClose,
  onDone,
}: {
  tournamentId: number;
  stage: Stage;
  groups: Group[];
  teams: Team[];
  current: AdminMatch[];
  unplayed: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const proposal = useBracketSeeding(tournamentId, stage.id);
  const tables = useStandings(tournamentId);
  const fresh = proposal.isFetchedAfterMount && tables.isFetchedAfterMount;

  if (fresh && proposal.data && tables.data && !proposal.isError && !tables.isError) {
    return (
      <GenerateBracketDialog
        tournamentId={tournamentId}
        stage={stage}
        initialOrder={seedingFromProposal(proposal.data, teams, groups)}
        groupTeams={groupTeamsFromTables(tables.data, groups)}
        notice={<UnplayedGroupMatchesNotice count={unplayed} />}
        current={current}
        onClose={onClose}
        onDone={onDone}
      />
    );
  }

  const replacing = current.length > 0;
  const failed = fresh ? (proposal.error ?? tables.error) : null;
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={(event) => event.preventDefault()}
      title={replacing ? 'Rozstaw i wygeneruj ponownie' : 'Rozstaw i wygeneruj'}
      description={stage.name}
      submitLabel={replacing ? 'Zastąp drabinkę' : 'Wygeneruj'}
      error={failed?.message}
      contentClassName="max-h-[92vh] overflow-y-auto sm:max-w-3xl"
    >
      {!failed && (
        <div aria-busy="true" aria-label="Wczytywanie propozycji rozstawienia" className="grid gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )}
    </FormDialog>
  );
}

/**
 * Okno „Rozstaw i wygeneruj” (#217, ustalenia 1–2): lista rozstawienia
 * startująca od kolejności drużyn z listy, obok podgląd par 1. rundy i mecz
 * o 3. miejsce. Przy istniejącej drabince lista i przełącznik startują od niej
 * (#239): rozstawienie odczytane z pozycji 1. rundy i wolnych losów
 * (`bracketSeeding`), drużyny spoza drabinki na końcu. Backend rozstawienia
 * nie przechowuje, więc innej „Poprzedniej” nie ma. Tytuł, ostrzeżenie
 * i przycisk mówią wtedy o zastąpieniu, bez osobnego kroku potwierdzenia, bo
 * API zastępuje bez pytania (#215).
 *
 * Z `groupTeams` (turniej z fazą grupową, #260) lista ma pochodzenie
 * i podmianę w obrębie grupy, ale bez blokady i losowania, które
 * zniszczyłyby rozstawienie krzyżowe; listę startową daje propozycja.
 *
 * `422` pod `thirdPlaceMatch` siada przy przełączniku, reszta (`teamIds`,
 * `groups`, `teams`, `stage`) nad przyciskami. Sukces unieważnia mecze i drużyny
 * (liczniki meczów zaplanowanych), a okno zamyka się po odświeżeniu listy.
 */
function GenerateBracketDialog({
  tournamentId,
  stage,
  initialOrder,
  groupTeams,
  notice,
  current,
  onClose,
  onDone,
}: {
  tournamentId: number;
  stage: Stage;
  /** Lista rozstawienia na start okna. */
  initialOrder: SeedingTeam[];
  /** Drużyny grup do podmiany; tylko w turnieju z fazą grupową. */
  groupTeams?: SeedingTeam[];
  /** Uprzedzenie nad listą, np. o nierozegranych meczach grup. */
  notice?: ReactNode;
  /** Mecze obecnej drabinki; pusta lista, gdy generujemy pierwszy raz. */
  current: AdminMatch[];
  onClose: () => void;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const currentMatches = current.length;
  const replacing = currentMatches > 0;
  const [order, setOrder] = useState<SeedingTeam[]>(initialOrder);
  const [locked, setLocked] = useState(0);
  const thirdPlaceAllowed = order.length >= 4;
  const [thirdPlace, setThirdPlace] = useState(() =>
    replacing ? current.some((match) => isThirdPlaceMatch(match, current)) : thirdPlaceAllowed,
  );
  const [thirdPlaceError, setThirdPlaceError] = useState<string>();
  const [formError, setFormError] = useState<string>();

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
        setFormError(rest.teamIds ?? rest.groups ?? rest.teams ?? rest.stage ?? Object.values(rest)[0]);
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
      {notice}
      <div className="grid gap-4 md:grid-cols-2">
        {groupTeams ? (
          <SeedingList value={order} onChange={setOrder} groupTeams={groupTeams} disabled={generate.isPending} />
        ) : (
          <SeedingList
            value={order}
            onChange={setOrder}
            locked={locked}
            onLockedChange={setLocked}
            disabled={generate.isPending}
          />
        )}
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

/**
 * Lista rozstawienia na start okna: rozstawienie obecnej drabinki, potem
 * drużyny, których w niej nie ma (dodane po generowaniu), w kolejności
 * z listy drużyn. Bez drabinki to sama lista drużyn. Nazwy idą z listy
 * drużyn, bo w meczach mogą być sprzed zmiany nazwy.
 */
function initialSeeding(teams: Team[], current: AdminMatch[]): SeedingTeam[] {
  const byId = new Map(teams.map((team) => [team.id, team]));
  const seeded = bracketSeeding(current).flatMap(({ id }) => {
    const team = byId.get(id);
    return team ? [team] : [];
  });
  const placed = new Set(seeded.map((team) => team.id));
  return [...seeded, ...teams.filter((team) => !placed.has(team.id))].map(({ id, name }) => ({ id, name }));
}
