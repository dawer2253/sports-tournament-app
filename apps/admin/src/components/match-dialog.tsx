import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isValidationError, type AdminMatch, type MatchStatus, type Sport, type Tournament } from '@tournament/api-client';
import {
  Button,
  FormDialog,
  Label,
  MatchStatusToggle,
  ScoreInputs,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  collisionLabel,
  formatKickoff,
  matchClockMinute,
  matchLabel,
  periodLabelGenitive,
  setDraftsToScores,
  setScoresToDrafts,
  SetScoresField,
  setsWon,
  toast,
  type EventMinute,
  type SetDraft,
} from '@tournament/ui';
import { ChevronDown, Info, TriangleAlert } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { MatchEventsSection } from '../components/match-events-section';
import { TextField } from '../components/text-field';
import { api } from '../lib/api';
import { advanceNote, bracketRow, type AdvanceNote } from '../lib/bracket';
import { applyApiError } from '../lib/form-errors';
import { toLocalInputValue, toOffsetIso } from '../lib/local-datetime';
import { scheduleKeys, useVenues } from '../lib/schedule-queries';
import { useSports } from '../lib/use-sports';

const SAVE_FAILED = 'Nie udało się zapisać meczu. Spróbuj ponownie.';

const START_FAILED = 'Nie udało się rozpocząć meczu. Spróbuj ponownie.';

const PERIOD_FAILED = 'Nie udało się zmienić części meczu. Spróbuj ponownie.';

/** Wartość „bez obiektu” w `Select`; pusty napis `Select` traktuje jak brak wyboru. */
const NO_VENUE = 'none';

/**
 * Pola, których `422` umiemy posadzić przy polu (#159): cała para wyników pod
 * blokiem `__ : __` (kontrakt sadza błędy pary pod `homeScore`, a błąd zakresu
 * pod swoim polem), tak samo para karnych pod swoim blokiem (#216), termin
 * i obiekt przy swoich polach. Reszta idzie nad przyciskami.
 */
const FIELDS = ['homeScore', 'awayScore', 'homePenalties', 'awayPenalties', 'kickoffAt', 'venueId', 'sets'] as const;

/**
 * Klucze błędów pojedynczego seta (#301): `sets.{n}` z reguł seta i
 * `sets.{n}.home`/`away` z reguł pola. Wszystkie siadają pod rzędem seta.
 */
const SET_FIELDS = Array.from({ length: 5 }, (_, index) => [`sets.${index}`, `sets.${index}.home`, `sets.${index}.away`]).flat();

/** Zapisany zegar meczu (#297): stan i bieżąca część, jak przyszły z serwera. */
type SavedClock = Pick<AdminMatch, 'status' | 'livePeriod' | 'periodStartedAt' | 'onBreak'>;

/** Ciało `PATCH` przycisku części: przerwa albo start części. */
type PeriodBody = { periodRunning: false } | { livePeriod: number; periodRunning: true };

/**
 * Jeden przycisk części meczu trwającego (#297, rozstrzygnięcie #289):
 * „Przerwa”, gdy część biegnie i nie jest ostatnia; „Start N. połowy” w
 * przerwie i po powrocie z „Zakończony” (część nie biegnie); po ostatniej
 * części meczu pucharowego „Dogrywka / karne”, a w sporcie bez remisu (bez
 * karnych) „Dogrywka”. W lidze i grupie po ostatniej części, w dogrywce
 * i w turnieju bez podziału przed dogrywką przycisku nie ma. W sporcie
 * z setami dogrywki nie ma wcale (#301).
 */
function periodAction(
  clock: SavedClock,
  periods: Tournament['periods'],
  knockout: boolean,
  allowsDraw: boolean,
  hasSets: boolean,
): { label: string; body: PeriodBody } | null {
  const current = clock.livePeriod;
  if (clock.status !== 'live' || current === null || current > periods.count) return null;
  const next = { livePeriod: current + 1, periodRunning: true } as const;
  if (current < periods.count) {
    return clock.periodStartedAt !== null
      ? { label: 'Przerwa', body: { periodRunning: false } }
      : { label: `Start ${periodLabelGenitive(next.livePeriod, periods.count)}`, body: next };
  }
  return knockout && !hasSets ? { label: allowsDraw ? 'Dogrywka / karne' : 'Dogrywka', body: next } : null;
}

/** Pole liczby jako wartość dla API: pusty napis to `null`. */
function toNumber(value: string): number | null {
  return value === '' ? null : Number(value);
}

export interface MatchDialogProps {
  match: AdminMatch;
  tournamentId: number;
  /** Mecze turnieju, żeby opis kolizji mógł wskazać drugą stronę (`collisions` zna tylko `matchId`). */
  matches: AdminMatch[];
  /** Kliknięcie kolizji: otwiera okno tamtego meczu (panel przełącza też kolejkę). */
  onOpenMatch: (match: AdminMatch) => void;
  onClose: () => void;
  /** Sport turnieju: z niego idą typy zdarzeń i ich etykiety (`GET /sports`). */
  sportCode: Sport['code'];
  /** Podział meczu turnieju (`Tournament.periods`): z niego przycisk części meczu trwającego (#297). */
  periods: Tournament['periods'];
  /** Długość meczu turnieju (`Tournament.matchDuration`): zegar liczy z niej minutę w turnieju bez podziału (#317). */
  matchDuration: Tournament['matchDuration'];
  /**
   * Format seta turnieju (`Tournament.setFormat`, #301). Podany oznacza sport
   * z setami: zamiast pól wyniku okno ma wpis kolejnych setów.
   */
  setFormat?: Tournament['setFormat'];
  /**
   * Mecz drabinki (#228): nagłówek z etykietą pozycji, karne i notka przed
   * zapisem. `matches` to wtedy komplet meczów fazy, z którego liczą się
   * etykiety i krawędzie.
   */
  knockout?: boolean;
}

/**
 * Okno meczu (#176): wynik i stan (#159) oraz termin i obiekt (#158) w jednym
 * `PATCH`-u. Reguła przełącznika stanu: „Trwa” na meczu bez wyniku wstawia
 * `0:0`, a „Zaplanowany” czyści oba pola i wysyła jawne `null` — API nie gubi
 * wyniku po cichu.
 *
 * Edycja meczu `finished` idzie bez ostrzeżenia i bez potwierdzenia: tabela
 * liczy się przy odczycie, więc zmiana wyniku jest bezpieczna.
 *
 * Zdarzenia meczu (#200, wariant E z #191) stoją w tym samym oknie, ale poza
 * formularzem (`aside`): zapisują się od razu, osobnym zasobem. Termin i obiekt
 * są przy meczu rozpoczętym zwinięte, bo przy stoliku liczą się wynik
 * i zdarzenia; przy zaplanowanym — rozwinięte, bo to wtedy się je ustawia.
 *
 * W drabince (`knockout`, #228, wariant B z #217) to samo okno dokłada:
 * - nagłówek z etykietą pozycji i terminem, a pusty slot z podpisem źródła —
 *   tą samą funkcją co wiersz drabinki (`bracketRow`);
 * - pola karnych pod wynikiem, tylko w sporcie z remisem, przy remisie i stanie
 *   „Zakończony”; gdy znikają, idzie jawne `null` w obu (#216);
 * - notkę przed zapisem z krawędzi (`advanceNote`), a przy rozpoczętym meczu
 *   zależnym ostrzeżenie z treścią blokady. Zapis nie jest wyłączony: `422`
 *   z serwera i tak przychodzi.
 *
 * Mecz bez obu drużyn czeka na rywali: wynik, stan i zdarzenia są niedostępne,
 * a termin i obiekt zostają.
 *
 * W sporcie z setami (`setFormat`, #301) wynik wpisuje się setami
 * (`SetScoresField`), a wynik w setach liczy się na bieżąco; do API jadą
 * `sets`, bez `homeScore` i `awayScore`, które liczy serwer. Bez karnych,
 * bez dogrywki i bez linii zgodności zdarzeń z wynikiem.
 */
export function MatchDialog({
  match,
  tournamentId,
  matches,
  onOpenMatch,
  onClose,
  sportCode,
  periods,
  matchDuration,
  setFormat = null,
  knockout = false,
}: MatchDialogProps) {
  const queryClient = useQueryClient();
  const venues = useVenues(tournamentId);
  const sports = useSports();
  const sportConfig = sports.data?.find((sport) => sport.code === sportCode)?.config;
  const allowsDraw = sportConfig?.allowsDraw ?? false;
  const runningClock = sportConfig?.runningClock ?? false;
  const [status, setStatus] = useState<MatchStatus>(match.status);
  const [homeScore, setHomeScore] = useState(match.homeScore?.toString() ?? '');
  const [awayScore, setAwayScore] = useState(match.awayScore?.toString() ?? '');
  // „Zapisz” wysyła wynik tylko po ręcznej zmianie pól (#317): inaczej zmiana
  // stanu albo obiektu nadpisałaby bramkę, którą serwer zapisał od zdarzenia.
  const [scoreEdited, setScoreEdited] = useState(false);
  const [homePenalties, setHomePenalties] = useState(match.homePenalties?.toString() ?? '');
  const [awayPenalties, setAwayPenalties] = useState(match.awayPenalties?.toString() ?? '');
  const [sets, setSets] = useState<SetDraft[]>(setScoresToDrafts(match.sets));
  const [setErrors, setSetErrors] = useState<Record<number, string | undefined>>({});
  const [kickoffAt, setKickoffAt] = useState(toLocalInputValue(match.kickoffAt));
  const [venueId, setVenueId] = useState(match.venue ? String(match.venue.id) : NO_VENUE);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string>();
  const scoreErrorId = useId();
  const penaltiesErrorId = useId();
  const [scheduleOpen, setScheduleOpen] = useState(match.status === 'scheduled');
  // Po „Rozpocznij mecz” sekcja zdarzeń otwiera się od razu, nie dopiero po
  // odświeżeniu listy meczów.
  const [startedHere, setStartedHere] = useState(false);
  const started = match.status !== 'scheduled' || startedHere;
  // Zegar zapisany na serwerze, a nie stan przełącznika: przycisk części stoi
  // dopiero przy meczu zapisanym jako „Trwa” (#297).
  const [savedClock, setSavedClock] = useState<SavedClock>(match);

  const waiting = !match.homeTeam || !match.awayTeam;
  const row = knockout ? bracketRow(match, matches) : null;
  const home = match.homeTeam?.name ?? row?.home.source ?? 'Do ustalenia';
  const away = match.awayTeam?.name ?? row?.away.source ?? 'Do ustalenia';
  const hasSets = setFormat !== null;
  const showsPenalties = !hasSets && knockout && allowsDraw && status === 'finished' && homeScore !== '' && homeScore === awayScore;
  const penalties = {
    homePenalties: showsPenalties ? toNumber(homePenalties) : null,
    awayPenalties: showsPenalties ? toNumber(awayPenalties) : null,
  };
  // W sporcie z setami wynik to sety wygrane z pól setów, liczone jak na serwerze.
  const setScores = setDraftsToScores(sets);
  const [homeSets, awaySets] = setFormat ? setsWon(setScores, setFormat) : [0, 0];
  const score = hasSets
    ? { homeScore: status === 'scheduled' ? null : homeSets, awayScore: status === 'scheduled' ? null : awaySets }
    : { homeScore: toNumber(homeScore), awayScore: toNumber(awayScore) };
  const note = knockout ? advanceNote(match, { status, ...score, ...penalties }, matches) : null;

  /**
   * „Rozpocznij mecz” z sekcji zdarzeń: od razu `PATCH` ze stanem `live`
   * i wynikiem z pól, a pusty wynik dostaje zero — ta sama reguła co „Trwa”
   * na przełączniku (#159). Termin i obiekt nie jadą: ich niezapisana zmiana
   * zostaje w polach do „Zapisz”.
   */
  const start = useMutation({
    mutationFn: async () => {
      const result = await api.PATCH('/matches/{match}', {
        params: { path: { match: match.id } },
        body: hasSets
          ? { status: 'live', sets: setScores }
          : {
              status: 'live',
              homeScore: homeScore === '' ? 0 : Number(homeScore),
              awayScore: awayScore === '' ? 0 : Number(awayScore),
            },
      });
      if (result.data) return result.data.data;
      throw result.response.status === 422 && isValidationError(result.error) ? result.error : new Error(START_FAILED);
    },
    onSuccess: async (saved) => {
      // Wynik i stan przychodzą z serwera z pominięciem pól, więc stare błędy par znikają tu.
      clearPairErrors();
      setStartedHere(true);
      setSavedClock(saved);
      setStatus(saved.status);
      setHomeScore(saved.homeScore?.toString() ?? '');
      setAwayScore(saved.awayScore?.toString() ?? '');
      setScoreEdited(false);
      setScheduleOpen(false);
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.matches(tournamentId) });
      toast.success('Mecz trwa. Możesz wpisywać zdarzenia.');
    },
    onError: (error) => showErrors(error, START_FAILED),
  });

  /**
   * Przycisk części (#297): od razu własny `PATCH` z samymi polami części,
   * wzorem „Rozpocznij mecz”. Okno zostaje otwarte, a wynik, termin i obiekt
   * zostają w polach do „Zapisz”.
   */
  const period = useMutation({
    mutationFn: async (body: PeriodBody) => {
      const result = await api.PATCH('/matches/{match}', { params: { path: { match: match.id } }, body });
      if (result.data) return result.data.data;
      throw result.response.status === 422 && isValidationError(result.error) ? result.error : new Error(PERIOD_FAILED);
    },
    onSuccess: async (saved) => {
      setFormError(undefined);
      setSavedClock(saved);
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.matches(tournamentId) });
    },
    onError: (error) => showErrors(error, PERIOD_FAILED),
  });
  const action = periodAction(savedClock, periods, knockout, allowsDraw, hasSets);

  /**
   * Minuta zdarzenia z zegara meczu w tej chwili (#317); `null` poza meczem
   * trwającym i tam, gdzie zegar nie podaje minuty (przerwa, dogrywka, sport
   * bez biegnącego zegara, sety).
   */
  function minuteFromClock(): EventMinute | null {
    if (savedClock.status !== 'live' || hasSets) return null;
    return matchClockMinute(savedClock, { periods, matchDuration, runningClock }, new Date());
  }

  /**
   * Po zapisie, poprawce albo cofnięciu zdarzenia w meczu trwającym serwer
   * zmienia wynik (#317): odświeżamy mecze i przepisujemy pola wyniku z
   * serwera, także gdy organizator wpisał coś ręcznie i nie zapisał.
   * Zwraca nowy wynik albo `null`, gdy mecz nie jest zapisany jako trwający.
   */
  async function syncScore(): Promise<{ home: number; away: number } | null> {
    if (savedClock.status !== 'live' || hasSets) return null;
    await queryClient.invalidateQueries({ queryKey: scheduleKeys.matches(tournamentId) });
    const fresh = queryClient
      .getQueriesData<AdminMatch[]>({ queryKey: scheduleKeys.matches(tournamentId) })
      .flatMap(([, data]) => data ?? [])
      .find((candidate) => candidate.id === match.id);
    if (!fresh || fresh.homeScore === null || fresh.awayScore === null) return null;
    setHomeScore(fresh.homeScore.toString());
    setAwayScore(fresh.awayScore.toString());
    setScoreEdited(false);
    return { home: fresh.homeScore, away: fresh.awayScore };
  }

  function showErrors(error: unknown, fallback: string) {
    setFieldErrors({});
    setSetErrors({});
    setFormError(undefined);
    applyApiError(
      error,
      [...FIELDS, ...SET_FIELDS],
      (field, { message }) => {
        const set = /^sets\.(\d+)/.exec(field);
        if (field === 'root') setFormError(message);
        else if (set) setSetErrors((current) => ({ ...current, [Number(set[1])]: message }));
        // Błąd całego meczu w setach stoi pod setami, jak błąd pary pod wynikiem.
        else if (field === 'sets') setFieldErrors((current) => ({ ...current, homeScore: message }));
        // Para wyników dzieli jeden komunikat pod blokiem `__ : __`.
        else if (field === 'homeScore' || field === 'awayScore') setFieldErrors((current) => ({ ...current, homeScore: message }));
        // Tak samo para karnych; przy ukrytych polach komunikat idzie nad przyciski.
        else if (field === 'homePenalties' || field === 'awayPenalties') {
          if (showsPenalties) setFieldErrors((current) => ({ ...current, homePenalties: message }));
          else setFormError(message);
        } else {
          // Błąd przy zwiniętym polu nie może zniknąć z widoku.
          if (field === 'kickoffAt' || field === 'venueId') setScheduleOpen(true);
          setFieldErrors((current) => ({ ...current, [field]: message }));
        }
      },
      fallback,
    );
  }

  // Wynik jedzie, gdy organizator go zmienił albo gdy mecz dopiero startuje lub wraca do zaplanowanych.
  const sendsScore = scoreEdited || status === 'scheduled' || savedClock.status === 'scheduled';

  const save = useMutation({
    mutationFn: async () => {
      const result = await api.PATCH('/matches/{match}', {
        params: { path: { match: match.id } },
        body: {
          status,
          // W sporcie z setami wynik niesie lista setów, a sety wygrane liczy serwer.
          ...(hasSets
            ? { sets: status === 'scheduled' ? [] : setScores }
            : sendsScore && { homeScore: toNumber(homeScore), awayScore: toNumber(awayScore) }),
          // Liga wysyła ciało jak dotąd; karne należą tylko do drabinki.
          ...(knockout && !hasSets && penalties),
          kickoffAt: kickoffAt === '' ? null : toOffsetIso(kickoffAt),
          venueId: venueId === NO_VENUE ? null : Number(venueId),
        },
      });
      if (result.data) return result.data.data;
      throw result.response.status === 422 && isValidationError(result.error) ? result.error : new Error(SAVE_FAILED);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: scheduleKeys.matches(tournamentId) }),
        queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId, 'standings'] }),
      ]);
      toast.success('Zapisano mecz.');
      onClose();
    },
    onError: (error) => showErrors(error, SAVE_FAILED),
  });

  /**
   * Błędy par z `422` dotyczą wartości, które organizer właśnie poprawia, więc
   * znikają przy pierwszej zmianie wyniku, karnych albo stanu, a nie dopiero
   * przy kolejnym zapisie. Czyścimy obie pary naraz: blokada zmiany zwycięzcy
   * siada pod wynikiem także wtedy, gdy zwycięzcę zmieniły same karne, a błąd
   * karnych schowanych razem z polami nie może wrócić nieaktualny. Ostrzeżenie
   * o blokadzie przed zapisem liczy się z pól na bieżąco, więc zostaje, dopóki
   * blokada trwa.
   */
  function clearPairErrors() {
    setFieldErrors((current) =>
      current.homeScore || current.homePenalties ? { ...current, homeScore: undefined, homePenalties: undefined } : current,
    );
    setSetErrors({});
  }

  function changeSets(next: SetDraft[]) {
    setSets(next);
    clearPairErrors();
  }

  function changePair(setValue: (value: string) => void, value: string) {
    setValue(value);
    clearPairErrors();
  }

  function changeScore(setValue: (value: string) => void, value: string) {
    setScoreEdited(true);
    changePair(setValue, value);
  }

  function changeStatus(next: MatchStatus) {
    clearPairErrors();
    setStatus(next);
    if (next === 'scheduled') {
      setHomeScore('');
      setAwayScore('');
      // Mecz zaplanowany nie ma setów: API wymaga jawnego `sets: []`.
      setSets([]);
    } else if (next === 'live' && !hasSets) {
      // Mecz trwający potrzebuje obu wyników: puste pole dostaje zero, a wpisane
      // przez organizera zostaje (`0:0` na meczu bez wyniku).
      setHomeScore((value) => (value === '' ? '0' : value));
      setAwayScore((value) => (value === '' ? '0' : value));
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(undefined);
    save.mutate();
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onSubmit={submit}
      title={`${home} – ${away}`}
      description={row ? `${row.label}, ${formatKickoff(match.kickoffAt)}` : `${match.round.name}, mecz ${match.matchNumber}`}
      submitLabel="Zapisz"
      pending={save.isPending}
      error={formError}
      contentClassName="max-h-[92vh] overflow-y-auto sm:max-w-3xl"
      aside={
        <MatchEventsSection
          match={match}
          sportCode={sportCode}
          started={started}
          homeScore={homeScore}
          awayScore={awayScore}
          scoreCheck={!hasSets}
          minuteFromClock={minuteFromClock}
          onScoreChanged={syncScore}
          onStart={() => start.mutate()}
          starting={start.isPending}
        />
      }
    >
      <div className="grid gap-4">
        {waiting && (
          <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Mecz czeka na rywali z poprzedniej rundy. Do tego czasu ustawisz mu tylko termin i obiekt.
          </p>
        )}
        {/* Komunikaty par stoją pod polami na całą szerokość okna, poza rzędem
            z przełącznikiem: wewnątrz bloku wyniku długi tekst rozpychał go,
            przesuwał pola i spychał przełącznik do nowej linii. Karne mają
            własny rząd, więc ich pola leżą dokładnie pod polami wyniku. */}
        <div className="grid content-start gap-3">
          <div className="grid content-start gap-2">
            <div className="flex flex-wrap items-start gap-3">
              {setFormat ? (
                <SetScoresField
                  sets={status === 'scheduled' ? [] : sets}
                  onChange={changeSets}
                  format={setFormat}
                  homeName={home}
                  awayName={away}
                  setErrors={setErrors}
                  disabled={save.isPending || waiting || status === 'scheduled'}
                />
              ) : (
                <ScoreInputs
                  homeValue={homeScore}
                  awayValue={awayScore}
                  onHomeChange={(value) => changeScore(setHomeScore, value)}
                  onAwayChange={(value) => changeScore(setAwayScore, value)}
                  homeLabel={`Wynik ${home}`}
                  awayLabel={`Wynik ${away}`}
                  error={fieldErrors.homeScore}
                  errorId={scoreErrorId}
                  disabled={save.isPending || waiting}
                />
              )}
              <MatchStatusToggle value={status} onChange={changeStatus} disabled={save.isPending || waiting} />
            </div>
            {action && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-start"
                disabled={period.isPending || save.isPending}
                onClick={() => period.mutate(action.body)}
              >
                {action.label}
              </Button>
            )}
            {fieldErrors.homeScore && (
              <p id={scoreErrorId} className="text-sm text-destructive">
                {fieldErrors.homeScore}
              </p>
            )}
          </div>
          {showsPenalties && (
            <div className="grid content-start justify-items-start gap-1">
              <p className="text-xs font-medium text-muted-foreground">Rzuty karne</p>
              <div className="grid content-start gap-2">
                <ScoreInputs
                  homeValue={homePenalties}
                  awayValue={awayPenalties}
                  onHomeChange={(value) => changePair(setHomePenalties, value)}
                  onAwayChange={(value) => changePair(setAwayPenalties, value)}
                  homeLabel={`Karne ${home}`}
                  awayLabel={`Karne ${away}`}
                  error={fieldErrors.homePenalties}
                  errorId={penaltiesErrorId}
                  disabled={save.isPending}
                />
                {fieldErrors.homePenalties && (
                  <p id={penaltiesErrorId} className="text-sm text-destructive">
                    {fieldErrors.homePenalties}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          aria-expanded={scheduleOpen}
          aria-controls="match-schedule-fields"
          onClick={() => setScheduleOpen(!scheduleOpen)}
          className="flex items-center gap-1 justify-self-start text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronDown aria-hidden className={cn('size-4 transition-transform', !scheduleOpen && '-rotate-90')} />
          Termin i obiekt
        </button>

        <div id="match-schedule-fields" hidden={!scheduleOpen} className="grid content-start gap-3 sm:grid-cols-2">
          <TextField
            label="Termin"
            type="datetime-local"
            value={kickoffAt}
            error={fieldErrors.kickoffAt}
            hint="Puste pole to „Termin do ustalenia”."
            disabled={save.isPending}
            onChange={(event) => setKickoffAt(event.target.value)}
          />
          <div className="grid content-start gap-2">
            <Label htmlFor="match-venue">Obiekt</Label>
            <Select value={venueId} onValueChange={setVenueId} disabled={save.isPending}>
              <SelectTrigger id="match-venue" aria-label="Obiekt" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_VENUE}>Bez obiektu</SelectItem>
                {(venues.data ?? []).map((venue) => (
                  <SelectItem key={venue.id} value={String(venue.id)}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.venueId && <p className="text-sm text-destructive">{fieldErrors.venueId}</p>}
          </div>
        </div>

        <CollisionList match={match} matches={matches} knockout={knockout} onOpenMatch={onOpenMatch} />
        {note && <AdvanceNoteBox note={note} />}
      </div>
    </FormDialog>
  );
}

/**
 * Notka przed zapisem meczu drabinki, nad przyciskami. Ostrzeżenie o blokadzie
 * jest alertem, bo zapowiada odmowę serwera; zwykła notka to tylko status.
 */
function AdvanceNoteBox({ note }: { note: AdvanceNote }) {
  const block = note.tone === 'block';
  const Icon = block ? TriangleAlert : Info;
  return (
    <div
      role={block ? 'alert' : 'status'}
      className={cn('flex items-start gap-2 rounded-md p-3 text-sm', block ? 'bg-destructive/10 text-destructive' : 'bg-muted/50')}
    >
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', !block && 'text-muted-foreground')} />
      <ul className="space-y-0.5">
        {note.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Kolizje terminu tego meczu (#158). Kontrakt zna tylko `matchId`, więc opis
 * drugiej strony dokłada panel. Kolizja nie blokuje zapisu; kliknięcie otwiera
 * okno tamtego meczu, żeby organizator mógł od razu poprawić termin.
 *
 * W drabince drugi mecz podpisuje etykieta pozycji, a nie `round.name`, bo
 * mecz o 3. miejsce gra w rundzie „Finał” (#234).
 */
function CollisionList({
  match,
  matches,
  knockout,
  onOpenMatch,
}: {
  match: AdminMatch;
  matches: AdminMatch[];
  knockout: boolean;
  onOpenMatch: (match: AdminMatch) => void;
}) {
  const collisions = match.collisions ?? [];
  if (collisions.length === 0) return null;

  return (
    <div className="grid content-start gap-1">
      <p className="text-sm font-medium">Kolizje</p>
      <ul className="space-y-1">
        {collisions.map((collision, index) => {
          const other = matches.find((candidate) => candidate.id === collision.matchId);
          const type = collisionLabel(collision.type);
          if (!other) {
            return (
              <li key={`${collision.type}-${index}`} className="flex items-center gap-2 px-2 text-sm">
                <TriangleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
                <span>{type} z meczem innej fazy</span>
              </li>
            );
          }
          const description = `${other.homeTeam?.name ?? 'Do ustalenia'} – ${other.awayTeam?.name ?? 'Do ustalenia'} (${knockout ? matchLabel(other, matches) : other.round.name}, ${formatKickoff(other.kickoffAt)})`;
          return (
            <li key={`${collision.type}-${index}`}>
              <button
                type="button"
                onClick={() => onOpenMatch(other)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
              >
                <TriangleAlert aria-hidden className="size-4 shrink-0 text-destructive" />
                <span className="min-w-0">
                  {type}: {description}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="px-2 text-xs text-muted-foreground">Kolizja nie blokuje zapisu.</p>
    </div>
  );
}
