// PROTOTYP (#217) — cztery warianty ekranu drabinki. Nie do main.
//
// A — kolumny rund z łącznikami (przewijane w poziomie), rozstawienie ↑/↓
//     w oknie, pełne okno meczu, Terminarz pucharu na osobnej karcie.
// B — runda po rundzie (karty rund jak lista kolejek), losowanie z podglądem
//     par i blokadą górnych seedów, lekkie okno wyniku; Drabinka zastępuje
//     Terminarz.
// C — drabinka z dwóch stron do finału na środku, rozstawienie przez
//     przypisanie drużyn wprost do slotów 1. rundy; osobny Terminarz.
// D — lista meczów po rundach z mapą drabinki obok, losowanie z wybraną
//     liczbą rozstawionych; Drabinka zastępuje Terminarz.
import {
  Button,
  EmptyState,
  FormDialog,
  Heading,
  Label,
  MatchRow,
  MatchStatusBadge,
  RoundList,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  formatKickoff,
  formatRoundDates,
} from '@tournament/ui';
import { ChevronDown, GitFork, Map as MapIcon, RefreshCw, RotateCcw, Shuffle, Trophy } from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { plural, TEAMS } from '../lib/plural';
import { useTournament } from '../pages/tournament-layout';
import {
  bracketSize,
  byeSlots,
  champion,
  isThirdPlace,
  matchLabel,
  seedPositions,
  useBracket,
  winnerSide,
  type BMatch,
  type Team,
} from './bracket-store';
import {
  BracketActions,
  BracketMatchDialog,
  BracketNotices,
  ChampionBadge,
  DatesButton,
  MatchCard,
  ReplaceWarning,
  scoreText,
  SeedingList,
  shuffle,
  ShuffleButton,
  slotSource,
  ThirdPlaceSwitch,
  useGenerate,
} from './shared';

// ——— Wspólna rama wariantów ———

function useSeedingDefault(): Team[] {
  const s = useBracket();
  // Podpowiedź poprzedniej kolejności: backend jej nie trzyma, więc pamięta ją tylko ta karta.
  if (!s.lastSeeding) return s.teams;
  const prev = s.lastSeeding.map((id) => s.teams.find((t) => t.id === id)).filter((t): t is Team => !!t);
  return [...prev, ...s.teams.filter((t) => !s.lastSeeding!.includes(t.id))];
}

function sizeSentence(n: number): string {
  const size = bracketSize(n);
  const byes = size - n;
  return `${n} ${plural(n, TEAMS)}: drabinka na ${size}${byes > 0 ? `, ${byes} ${byes === 1 ? 'wolny los' : byes < 5 ? 'wolne losy' : 'wolnych losów'} dla najwyżej rozstawionych` : ''}.`;
}

function EmptyBracket({ onGenerate, tournamentId, label = 'Wygeneruj drabinkę' }: { onGenerate: () => void; tournamentId: number; label?: string }) {
  const s = useBracket();
  const n = s.teams.length;
  return (
    <EmptyState
      icon={<GitFork />}
      title="Drabinka nie jest jeszcze wygenerowana"
      description={n < 2 ? 'Puchar potrzebuje co najmniej dwóch drużyn. Dodaj je w zakładce Drużyny.' : `${sizeSentence(n)} Najpierw ustalisz rozstawienie, daty rozłożysz potem.`}
      action={
        n < 2 ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button disabled>
              <RefreshCw className="size-4" /> {label}
            </Button>
            <Button asChild variant="outline">
              <Link to={`/tournaments/${tournamentId}/teams`}>Przejdź do drużyn</Link>
            </Button>
          </div>
        ) : (
          <Button onClick={onGenerate}>
            <RefreshCw className="size-4" /> {label}
          </Button>
        )
      }
    />
  );
}

function useOpenMatch() {
  const s = useBracket();
  const [openId, setOpenId] = useState<number | null>(null);
  const open = s.matches.find((m) => m.id === openId) ?? null;
  return { open, setOpen: (m: BMatch | null) => setOpenId(m?.id ?? null) };
}

/** Pierwsza pozycja 1. rundy dla seeda — do podglądu par przed generowaniem. */
function firstRoundPreview(order: Team[]): { m: number; home: Team; away: Team | null }[] {
  const size = bracketSize(order.length);
  const pos = seedPositions(size);
  return Array.from({ length: size / 2 }, (_, i) => ({
    m: i + 1,
    home: order[pos[2 * i] - 1],
    away: pos[2 * i + 1] <= order.length ? order[pos[2 * i + 1] - 1] : null,
  }));
}

// ——— Drzewo w kolumnach (A, C) ———

/**
 * Kolumny rund z łącznikami. Każda kolumna ma tyle komórek, ile pozycji
 * w pełnej drabince, więc pary równają się same, a wolny los zostaje
 * dziurą z duchem drużyny. `range` wycina połowę drabinki (wariant C),
 * `rtl` odwraca kierunek łączników.
 */
function BracketColumns({
  matches,
  onSelect,
  range,
  rtl,
  withFinal = true,
}: {
  matches: BMatch[];
  onSelect: (m: BMatch) => void;
  range?: [number, number];
  rtl?: boolean;
  withFinal?: boolean;
}) {
  const roundsCount = Math.max(...matches.map((m) => m.round.order));
  const size = 2 ** roundsCount;
  const rounds = Array.from({ length: withFinal ? roundsCount : roundsCount - 1 }, (_, i) => i + 1);
  const [from, to] = range ?? [0, 1];
  const roundName = (r: number) => matches.find((m) => m.round.order === r)?.round.name ?? '';

  const columns = rounds.map((r) => {
    const cells = size / 2 ** r;
    const start = Math.round(cells * from);
    const end = Math.round(cells * to);
    const list = Array.from({ length: Math.max(end - start, 1) }, (_, k) => {
      const i = start + k;
      return { i, match: matches.find((m) => m.round.order === r && m.matchNumber === i + 1 && !isThirdPlace(m, matches)) ?? null };
    });
    return { r, list };
  });
  const firstCount = columns[0].list.length;

  return (
    <div className={cn('flex', rtl && 'flex-row-reverse')}>
      {columns.map(({ r, list }, ci) => (
        <div key={r} className="w-60 shrink-0 snap-start px-4">
          <div className={cn('mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground', rtl && 'text-right')}>{roundName(r)}</div>
          <div className="flex flex-col" style={{ height: `${firstCount * 5.5}rem` }}>
            {list.map(({ i, match }) => {
              const last = ci === columns.length - 1;
              const pairTop = i % 2 === 0;
              return (
                <div key={i} className="relative flex flex-1 items-center">
                  {match ? (
                    <MatchCard match={match} matches={matches} onSelect={onSelect} dense />
                  ) : (
                    <ByeGhost r={r} i={i} matches={matches} />
                  )}
                  {!last && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute w-4 border-border',
                        rtl ? '-left-4 border-l' : '-right-4 border-r',
                        pairTop ? 'top-1/2 h-1/2 border-t' : 'top-0 h-1/2 border-b',
                        !match && 'border-dashed',
                      )}
                    />
                  )}
                  {ci > 0 && <span aria-hidden className={cn('absolute top-1/2 w-4 border-t border-border', rtl ? '-right-4' : '-left-4')} />}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ByeGhost({ r, i, matches }: { r: number; i: number; matches: BMatch[] }) {
  const next = matches.find((m) => m.round.order === r + 1 && m.matchNumber === Math.floor(i / 2) + 1);
  const team = next ? (i % 2 === 0 ? next.homeTeam : next.awayTeam) : null;
  const bye = next && byeSlots(next, matches).includes(i % 2 === 0 ? 'home' : 'away');
  return (
    <div className="w-full rounded-lg border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground">
      {bye && team ? (
        <>
          <span className="font-medium text-foreground">{team.name}</span> · wolny los
        </>
      ) : (
        'wolny los'
      )}
    </div>
  );
}

function ThirdPlaceBlock({ matches, onSelect }: { matches: BMatch[]; onSelect: (m: BMatch) => void }) {
  const bronze = matches.find((m) => isThirdPlace(m, matches));
  if (!bronze) return null;
  return (
    <div className="w-60 px-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">O 3. miejsce</div>
      <MatchCard match={bronze} matches={matches} onSelect={onSelect} dense />
    </div>
  );
}

// ——— Wariant A ———

export function VariantA() {
  const tournament = useTournament();
  const s = useBracket();
  const [generating, setGenerating] = useState(false);
  const { open, setOpen } = useOpenMatch();
  const champ = champion(s.matches);

  return (
    <AdminPage tournament={tournament} section="bracket" actions={<BracketActions onRegenerate={() => setGenerating(true)} />}>
      {s.matches.length === 0 ? (
        <EmptyBracket onGenerate={() => setGenerating(true)} tournamentId={tournament.id} />
      ) : (
        <>
          <BracketNotices onRegenerate={() => setGenerating(true)} />
          <div className="-mx-4 snap-x overflow-x-auto pb-4">
            <div className="flex w-max items-start">
              <BracketColumns matches={s.matches} onSelect={setOpen} />
              {champ && (
                <div className="w-60 shrink-0 self-center px-4">
                  <ChampionBadge team={champ} />
                </div>
              )}
            </div>
            <div className="mt-2 flex justify-end pr-4" style={{ width: 'max-content', minWidth: '100%' }}>
              <ThirdPlaceBlock matches={s.matches} onSelect={setOpen} />
            </div>
          </div>
        </>
      )}
      {generating && <GenerateDialogA onClose={() => setGenerating(false)} />}
      {open && <BracketMatchDialog key={open.id} match={open} onClose={() => setOpen(null)} />}
    </AdminPage>
  );
}

function GenerateDialogA({ onClose }: { onClose: () => void }) {
  const s = useBracket();
  const initial = useSeedingDefault();
  const [order, setOrder] = useState<Team[]>(initial);
  const [third, setThird] = useState(s.teams.length >= 4);
  const { pending, errors, run } = useGenerate(onClose);
  const replacing = s.matches.length > 0;

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void run(order.map((t) => t.id), third && order.length >= 4);
      }}
      title={replacing ? 'Wygeneruj drabinkę ponownie' : 'Wygeneruj drabinkę'}
      description={`${sizeSentence(order.length)} Kolejność to rozstawienie: pierwsza drużyna jest najwyżej rozstawiona.`}
      submitLabel={replacing ? 'Zastąp drabinkę' : 'Wygeneruj'}
      pending={pending}
      error={errors.form ?? errors.thirdPlaceMatch}
      contentClassName="sm:max-w-lg"
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label>Rozstawienie</Label>
          <ShuffleButton value={order} onChange={setOrder} label="Wylosuj kolejność" />
        </div>
        {s.lastSeeding && <p className="text-xs text-muted-foreground">Podpowiedź: kolejność z poprzedniego generowania (pamięta ją tylko ta przeglądarka).</p>}
        <SeedingList value={order} onChange={setOrder} />
        <ThirdPlaceSwitch teamsCount={order.length} value={third} onChange={setThird} />
        <ReplaceWarning />
        <p className="text-xs text-muted-foreground">Mecze powstaną bez dat.</p>
      </div>
    </FormDialog>
  );
}

// ——— Wariant B ———

export function VariantB() {
  const tournament = useTournament();
  const s = useBracket();
  const [generating, setGenerating] = useState(false);
  const { open, setOpen } = useOpenMatch();
  const [params, setParams] = useSearchParams();

  const rounds = useMemo(() => {
    const orders = [...new Set(s.matches.map((m) => m.round.order))].sort((a, b) => a - b);
    return orders.map((o) => {
      const ms = s.matches.filter((m) => m.round.order === o).sort((a, b) => Number(isThirdPlace(a, s.matches)) - Number(isThirdPlace(b, s.matches)) || a.matchNumber - b.matchNumber);
      return { order: o, name: ms[0].round.name, matches: ms };
    });
  }, [s.matches]);
  const requested = Number(params.get('round'));
  const current =
    rounds.find((r) => r.order === requested) ?? rounds.find((r) => r.matches.some((m) => m.status !== 'finished')) ?? rounds[rounds.length - 1];

  return (
    <AdminPage
      tournament={tournament}
      section="bracket"
      actions={<BracketActions onRegenerate={() => setGenerating(true)} />}
    >
      {s.matches.length === 0 ? (
        <EmptyBracket onGenerate={() => setGenerating(true)} tournamentId={tournament.id} label="Rozstaw i wygeneruj" />
      ) : (
        <>
          <BracketNotices onRegenerate={() => setGenerating(true)} />
          <div role="tablist" aria-label="Rundy" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
            {rounds.map((r) => {
              const done = r.matches.filter((m) => m.status === 'finished').length;
              const active = r.order === current.order;
              return (
                <button
                  key={r.order}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setParams((p) => ({ ...Object.fromEntries(p), round: String(r.order) }), { replace: true })}
                  className={cn(
                    'shrink-0 rounded-lg border px-3 py-2 text-left text-sm',
                    active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  <span className="block font-medium">{r.name}</span>
                  <span className={cn('block text-xs', active ? 'opacity-80' : 'text-muted-foreground')}>
                    {formatRoundDates(r.matches.map((m) => m.kickoffAt))} · {done}/{r.matches.length}
                  </span>
                </button>
              );
            })}
          </div>
          <RoundDetailB matches={current.matches} all={s.matches} onSelect={setOpen} />
          {champion(s.matches) && (
            <div className="mt-4 max-w-sm">
              <ChampionBadge team={champion(s.matches)} />
            </div>
          )}
        </>
      )}
      {generating && <GenerateDialogB onClose={() => setGenerating(false)} />}
      {open && <BracketMatchDialog key={open.id} match={open} light onClose={() => setOpen(null)} />}
    </AdminPage>
  );
}

function RoundDetailB({ matches, all, onSelect }: { matches: BMatch[]; all: BMatch[]; onSelect: (m: BMatch) => void }) {
  const byes = matches.flatMap((m) => byeSlots(m, all).map((side) => ({ m, team: side === 'home' ? m.homeTeam : m.awayTeam })));
  return (
    <div className="space-y-2">
      {matches.map((m) => {
        const w = winnerSide(m);
        const next = all.find((x) => x.id === m.winnerToMatchId);
        const loser = all.find((x) => x.id === m.loserToMatchId);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m)}
            className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-1 rounded-lg border p-3 text-left text-sm hover:bg-muted/50 sm:grid-cols-[8rem_1fr_auto_1fr_11rem]"
          >
            <span className="col-span-3 text-xs text-muted-foreground sm:col-span-1">
              {matchLabel(m, all)}
              <span className="block">{m.kickoffAt ? formatKickoff(m.kickoffAt) : 'bez terminu'}</span>
            </span>
            <span className={cn('truncate text-right', w === 'home' && 'font-semibold', w === 'away' && 'text-muted-foreground', !m.homeTeam && 'text-xs italic text-muted-foreground')}>
              {m.homeTeam?.name ?? slotSource(m, 'home', all)}
            </span>
            <span className="rounded bg-muted px-2 py-0.5 text-center tabular-nums">{scoreText(m)}</span>
            <span className={cn('truncate', w === 'away' && 'font-semibold', w === 'home' && 'text-muted-foreground', !m.awayTeam && 'text-xs italic text-muted-foreground')}>
              {m.awayTeam?.name ?? slotSource(m, 'away', all)}
            </span>
            <span className="col-span-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground sm:col-span-1 sm:justify-end">
              {m.status !== 'scheduled' && <MatchStatusBadge status={m.status} />}
              {next && <span className="whitespace-nowrap">zwycięzca → {matchLabel(next, all)}</span>}
              {loser && <span className="whitespace-nowrap">przegrany → o 3. miejsce</span>}
            </span>
          </button>
        );
      })}
      {byes.length > 0 && (
        <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          Wolne losy (bez meczu w 1. rundzie): {byes.map((b) => `${b.team?.name} → ${matchLabel(b.m, all)}`).join(', ')}
        </p>
      )}
    </div>
  );
}

const LOCK_OPTIONS = [0, 1, 2, 4, 8];

function GenerateDialogB({ onClose }: { onClose: () => void }) {
  const s = useBracket();
  const initial = useSeedingDefault();
  const [order, setOrder] = useState<Team[]>(initial);
  const [locked, setLocked] = useState(0);
  const [third, setThird] = useState(s.teams.length >= 4);
  const { pending, errors, run } = useGenerate(onClose);
  const preview = firstRoundPreview(order);
  const replacing = s.matches.length > 0;

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void run(order.map((t) => t.id), third && order.length >= 4);
      }}
      title={replacing ? 'Rozstaw i wygeneruj ponownie' : 'Rozstaw i wygeneruj'}
      description={sizeSentence(order.length)}
      submitLabel={replacing ? 'Zastąp drabinkę' : 'Wygeneruj'}
      pending={pending}
      error={errors.form ?? errors.thirdPlaceMatch}
      contentClassName="max-h-[92vh] overflow-y-auto sm:max-w-3xl"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid content-start gap-2">
          <Label>Rozstawienie (od najwyżej)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(locked)} onValueChange={(v) => setLocked(Number(v))}>
              <SelectTrigger className="w-auto" aria-label="Rozstawieni na stałe">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCK_OPTIONS.filter((n) => n < order.length).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 0 ? 'Bez rozstawionych' : `Zablokuj ${n} pierwsz${n === 1 ? 'ą' : 'e'}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ShuffleButton value={order} onChange={setOrder} locked={locked} label={locked > 0 ? 'Wylosuj resztę' : 'Wylosuj wszystko'} />
            {s.lastSeeding && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setOrder(initial)}>
                <RotateCcw className="size-4" /> Poprzednia
              </Button>
            )}
          </div>
          <SeedingList value={order} onChange={setOrder} locked={locked} dense maxHeight="max-h-[22rem]" />
        </div>
        <div className="grid content-start gap-2">
          <Label>Podgląd 1. rundy</Label>
          <ol className="max-h-[25rem] space-y-1 overflow-y-auto text-sm">
            {preview.map((p) => (
              <li key={p.m} className={cn('flex items-center gap-2 rounded-md border px-2 py-1', !p.away && 'border-dashed text-muted-foreground')}>
                <span className="w-5 text-xs tabular-nums text-muted-foreground">{p.m}</span>
                <span className="min-w-0 flex-1 truncate">{p.home.name}</span>
                <span className="text-xs">{p.away ? '–' : ''}</span>
                <span className="min-w-0 flex-1 truncate text-right">{p.away?.name ?? 'wolny los → 2. runda'}</span>
              </li>
            ))}
          </ol>
          <ThirdPlaceSwitch teamsCount={order.length} value={third} onChange={setThird} />
        </div>
      </div>
      <ReplaceWarning />
    </FormDialog>
  );
}

// ——— Wariant C ———

export function VariantC() {
  const tournament = useTournament();
  const s = useBracket();
  const [generating, setGenerating] = useState(false);
  const { open, setOpen } = useOpenMatch();
  const roundsCount = Math.max(0, ...s.matches.map((m) => m.round.order));
  const final = s.matches.find((m) => m.round.order === roundsCount && !isThirdPlace(m, s.matches));
  const bronze = s.matches.find((m) => isThirdPlace(m, s.matches));

  return (
    <AdminPage tournament={tournament} section="bracket" actions={<BracketActions onRegenerate={() => setGenerating(true)} />}>
      {s.matches.length === 0 ? (
        <EmptyBracket onGenerate={() => setGenerating(true)} tournamentId={tournament.id} label="Rozstaw drużyny w drabince" />
      ) : (
        <>
          <BracketNotices onRegenerate={() => setGenerating(true)} />
          {roundsCount === 1 ? (
            <div className="max-w-xs">{final && <MatchCard match={final} matches={s.matches} onSelect={setOpen} />}</div>
          ) : (
            <div className="flex flex-col items-stretch gap-6 xl:flex-row xl:items-center xl:justify-center">
              <div className="overflow-x-auto">
                <BracketColumns matches={s.matches} onSelect={setOpen} range={[0, 0.5]} withFinal={false} />
              </div>
              <div className="mx-auto grid w-64 shrink-0 gap-3 xl:mx-0">
                <div className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">Finał</div>
                {final && <MatchCard match={final} matches={s.matches} onSelect={setOpen} className="shadow-lg" />}
                <ChampionBadge team={champion(s.matches)} />
                {bronze && (
                  <>
                    <div className="mt-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">O 3. miejsce</div>
                    <MatchCard match={bronze} matches={s.matches} onSelect={setOpen} dense />
                  </>
                )}
              </div>
              <div className="overflow-x-auto">
                <BracketColumns matches={s.matches} onSelect={setOpen} range={[0.5, 1]} rtl withFinal={false} />
              </div>
            </div>
          )}
        </>
      )}
      {generating && <GenerateDialogC onClose={() => setGenerating(false)} />}
      {open && <BracketMatchDialog key={open.id} match={open} onClose={() => setOpen(null)} />}
    </AdminPage>
  );
}

/** Rozstawienie wprost w slotach 1. rundy: przy każdym miejscu numer seeda i wybór drużyny. */
function GenerateDialogC({ onClose }: { onClose: () => void }) {
  const s = useBracket();
  const initial = useSeedingDefault();
  const [seeds, setSeeds] = useState<(Team | null)[]>(s.lastSeeding ? initial : initial.map(() => null));
  const [third, setThird] = useState(s.teams.length >= 4);
  const { pending, errors, run } = useGenerate(onClose);
  const n = s.teams.length;
  const size = bracketSize(n);
  const pos = seedPositions(size);
  const missing = seeds.filter((t) => t === null).length;
  const [localError, setLocalError] = useState<string>();

  function assign(seed: number, teamId: string) {
    const team = s.teams.find((t) => t.id === Number(teamId)) ?? null;
    setSeeds((cur) => {
      const next = [...cur];
      const prevIdx = next.findIndex((t) => t?.id === team?.id);
      // Drużyna z innego miejsca zamienia się z obecną (żadna nie znika).
      if (prevIdx >= 0) next[prevIdx] = next[seed - 1];
      next[seed - 1] = team;
      return next;
    });
  }

  const slot = (seed: number) =>
    seed > n ? (
      <div className="flex h-9 items-center rounded-md border border-dashed px-2 text-xs text-muted-foreground">wolny los</div>
    ) : (
      <div className="flex items-center gap-1.5">
        <span className="w-6 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{seed}</span>
        <Select value={seeds[seed - 1] ? String(seeds[seed - 1]!.id) : ''} onValueChange={(v) => assign(seed, v)}>
          <SelectTrigger className="h-9 w-full min-w-0" aria-label={`Miejsce rozstawienia ${seed}`}>
            <SelectValue placeholder="— wybierz —" />
          </SelectTrigger>
          <SelectContent>
            {s.teams.map((t) => {
              const at = seeds.findIndex((x) => x?.id === t.id);
              return (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                  {at >= 0 && at !== seed - 1 ? ` (teraz ${at + 1})` : ''}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
    );

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (missing > 0) {
          setLocalError(`Brakuje drużyn na ${missing} miejscach.`);
          return;
        }
        setLocalError(undefined);
        void run(seeds.map((t) => t!.id), third && n >= 4);
      }}
      title="Rozstaw drużyny w drabince"
      description={`${sizeSentence(n)} Numer przy miejscu to rozstawienie: 1 i 2 spotkają się najwcześniej w finale.`}
      submitLabel={s.matches.length > 0 ? 'Zastąp drabinkę' : 'Wygeneruj'}
      pending={pending}
      error={localError ?? errors.form ?? errors.thirdPlaceMatch}
      contentClassName="max-h-[92vh] overflow-y-auto sm:max-w-3xl"
    >
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setSeeds(shuffle(s.teams))}>
          <Shuffle className="size-4" /> Wylosuj wszystkie miejsca
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const rest = shuffle(s.teams.filter((t) => !seeds.some((x) => x?.id === t.id)));
            setSeeds(seeds.map((t) => t ?? rest.shift()!));
          }}
        >
          <Shuffle className="size-4" /> Wylosuj puste
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setSeeds(seeds.map(() => null))}>
          Wyczyść
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: size / 2 }, (_, i) => (
          <div key={i} className="grid gap-1 rounded-lg border p-2">
            <span className="text-[11px] text-muted-foreground">{pos[2 * i + 1] > n ? `Wolny los → 2. runda` : `1. runda · mecz ${i + 1}`}</span>
            {slot(pos[2 * i])}
            {slot(pos[2 * i + 1])}
          </div>
        ))}
      </div>
      <ThirdPlaceSwitch teamsCount={n} value={third} onChange={setThird} />
      <ReplaceWarning />
    </FormDialog>
  );
}

// ——— Wariant D ———

export function VariantD() {
  const tournament = useTournament();
  const s = useBracket();
  const [generating, setGenerating] = useState(false);
  const { open, setOpen } = useOpenMatch();
  const [hover, setHover] = useState<number | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const orders = [...new Set(s.matches.map((m) => m.round.order))].sort((a, b) => a - b);
  const currentOrder = orders.find((o) => s.matches.some((m) => m.round.order === o && m.status !== 'finished')) ?? orders[orders.length - 1];
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const path = useMemo(() => {
    // Ścieżka wybranego meczu: skąd przyszli rywale i dokąd idzie zwycięzca.
    const ids = new Set<number>();
    if (hover === null) return ids;
    let cur = s.matches.find((m) => m.id === hover);
    while (cur) {
      ids.add(cur.id);
      cur = s.matches.find((m) => m.id === cur!.winnerToMatchId);
    }
    s.matches.filter((m) => m.winnerToMatchId === hover || m.loserToMatchId === hover).forEach((m) => ids.add(m.id));
    return ids;
  }, [hover, s.matches]);

  return (
    <AdminPage tournament={tournament} section="bracket" actions={<BracketActions onRegenerate={() => setGenerating(true)} />}>
      {s.matches.length === 0 ? (
        <EmptyBracket onGenerate={() => setGenerating(true)} tournamentId={tournament.id} label="Losuj drabinkę" />
      ) : (
        <>
          <BracketNotices onRegenerate={() => setGenerating(true)} />
          <Button variant="outline" size="sm" className="mb-3 lg:hidden" onClick={() => setMapOpen(!mapOpen)}>
            <MapIcon className="size-4" /> {mapOpen ? 'Ukryj mapę drabinki' : 'Pokaż mapę drabinki'}
          </Button>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0 space-y-4">
              {orders.map((o) => {
                const ms = s.matches
                  .filter((m) => m.round.order === o)
                  .sort((a, b) => Number(isThirdPlace(a, s.matches)) - Number(isThirdPlace(b, s.matches)) || a.matchNumber - b.matchNumber);
                const isCollapsed = collapsed[o] ?? o !== currentOrder;
                const done = ms.filter((m) => m.status === 'finished').length;
                return (
                  <section key={o}>
                    <button
                      type="button"
                      aria-expanded={!isCollapsed}
                      onClick={() => setCollapsed({ ...collapsed, [o]: !isCollapsed })}
                      className="mb-2 flex w-full items-baseline gap-2 text-left"
                    >
                      <ChevronDown className={cn('size-4 self-center transition-transform', isCollapsed && '-rotate-90')} />
                      <Heading level="card" as="h2">
                        {ms[0].round.name}
                      </Heading>
                      <span className="text-sm text-muted-foreground">
                        {formatRoundDates(ms.map((m) => m.kickoffAt))} · {done}/{ms.length}
                      </span>
                    </button>
                    {!isCollapsed && (
                      <ul className="space-y-2">
                        {ms.map((m) => (
                          <li key={m.id} onMouseEnter={() => setHover(m.id)} onMouseLeave={() => setHover(null)} className="grid gap-1">
                            <span className="flex gap-2 px-1 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{matchLabel(m, s.matches)}</span>
                              {m.homePenalties !== null && <span>karne {m.homePenalties}:{m.awayPenalties}</span>}
                              {m.winnerToMatchId && <span>→ {matchLabel(s.matches.find((x) => x.id === m.winnerToMatchId)!, s.matches)}</span>}
                            </span>
                            <MatchRow
                              match={{
                                ...m,
                                homeTeam: m.homeTeam ?? { id: -1, name: slotSource(m, 'home', s.matches) },
                                awayTeam: m.awayTeam ?? { id: -2, name: slotSource(m, 'away', s.matches) },
                              }}
                              onSelect={() => setOpen(m)}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
              {champion(s.matches) && (
                <div className="max-w-sm">
                  <ChampionBadge team={champion(s.matches)} />
                </div>
              )}
            </div>
            <aside className={cn('lg:sticky lg:top-4 lg:block', mapOpen ? 'block' : 'hidden', 'order-first lg:order-none')}>
              <MiniMap matches={s.matches} path={path} onHover={setHover} onSelect={setOpen} />
            </aside>
          </div>
        </>
      )}
      {generating && <GenerateDialogD onClose={() => setGenerating(false)} />}
      {open && <BracketMatchDialog key={open.id} match={open} onClose={() => setOpen(null)} />}
    </AdminPage>
  );
}

/** Mapa drabinki: same skróty i wyniki, do orientacji i skoku do meczu. */
function MiniMap({ matches, path, onHover, onSelect }: { matches: BMatch[]; path: Set<number>; onHover: (id: number | null) => void; onSelect: (m: BMatch) => void }) {
  const roundsCount = Math.max(...matches.map((m) => m.round.order));
  const size = 2 ** roundsCount;
  const short = (t: { name: string } | null) => (t ? t.name.split(' ')[0] : '?');
  return (
    <div className="max-h-[80vh] overflow-auto rounded-lg border p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">Mapa drabinki</div>
      <div className="flex gap-2">
        {Array.from({ length: roundsCount }, (_, r) => {
          const cells = size / 2 ** (r + 1);
          return (
            <div key={r} className="flex w-24 flex-col" style={{ height: `${(size / 2) * 2.25}rem` }}>
              {Array.from({ length: cells }, (_, i) => {
                const m = matches.find((x) => x.round.order === r + 1 && x.matchNumber === i + 1 && !isThirdPlace(x, matches));
                const w = m && winnerSide(m);
                return (
                  <div key={i} className="flex flex-1 items-center">
                    {m ? (
                      <button
                        type="button"
                        onMouseEnter={() => onHover(m.id)}
                        onMouseLeave={() => onHover(null)}
                        onClick={() => onSelect(m)}
                        className={cn(
                          'w-full rounded border px-1 py-0.5 text-left text-[10px] leading-tight',
                          path.has(m.id) && 'border-amber-500 bg-amber-500/10',
                          m.status === 'live' && 'border-destructive',
                        )}
                      >
                        <span className={cn('flex justify-between gap-1', w === 'home' && 'font-semibold')}>
                          <span className="truncate">{short(m.homeTeam)}</span>
                          <span>{m.homeScore ?? ''}</span>
                        </span>
                        <span className={cn('flex justify-between gap-1', w === 'away' && 'font-semibold')}>
                          <span className="truncate">{short(m.awayTeam)}</span>
                          <span>{m.awayScore ?? ''}</span>
                        </span>
                      </button>
                    ) : (
                      <span className="w-full rounded border border-dashed px-1 text-[10px] text-muted-foreground">wolny los</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SEEDED_OPTIONS = [0, 2, 4, 8];

/** Losowanie: N rozstawionych z listy drużyn (↑/↓), reszta losowana od razu, z podglądem par. */
function GenerateDialogD({ onClose }: { onClose: () => void }) {
  const s = useBracket();
  const [seededCount, setSeededCount] = useState(0);
  const [seeded, setSeeded] = useState<Team[]>(s.teams);
  const [drawn, setDrawn] = useState<Team[]>(() => shuffle(s.teams));
  const [third, setThird] = useState(s.teams.length >= 4);
  const { pending, errors, run } = useGenerate(onClose);
  const top = seeded.slice(0, seededCount);
  const order = [...top, ...drawn.filter((t) => !top.some((x) => x.id === t.id))];
  const preview = firstRoundPreview(order);

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        void run(order.map((t) => t.id), third && order.length >= 4);
      }}
      title={s.matches.length > 0 ? 'Losuj drabinkę ponownie' : 'Losuj drabinkę'}
      description={sizeSentence(order.length)}
      submitLabel={s.matches.length > 0 ? 'Zastąp drabinkę' : 'Zatwierdź losowanie'}
      pending={pending}
      error={errors.form ?? errors.thirdPlaceMatch}
      contentClassName="max-h-[92vh] overflow-y-auto sm:max-w-2xl"
    >
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Rozstawieni</legend>
        <div className="flex flex-wrap gap-2">
          {SEEDED_OPTIONS.filter((n) => n < order.length).map((n) => (
            <Button key={n} type="button" size="sm" variant={seededCount === n ? 'default' : 'outline'} onClick={() => setSeededCount(n)}>
              {n === 0 ? 'Bez rozstawienia' : `${n} rozstawionych`}
            </Button>
          ))}
        </div>
        {seededCount > 0 && (
          <>
            <p className="text-xs text-muted-foreground">Ustaw kolejność: pierwsze {seededCount} stają na swoich miejscach, reszta jest losowana.</p>
            <SeedingList value={seeded} onChange={setSeeded} locked={seededCount} dense maxHeight="max-h-48" />
          </>
        )}
      </fieldset>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>Wynik losowania — 1. runda</Label>
          <Button type="button" size="sm" variant="outline" onClick={() => setDrawn(shuffle(s.teams))}>
            <Shuffle className="size-4" /> Losuj jeszcze raz
          </Button>
        </div>
        <ol className="grid max-h-64 gap-1 overflow-y-auto text-sm sm:grid-cols-2">
          {preview.map((p) => (
            <li key={p.m} className={cn('flex items-center gap-1 rounded-md border px-2 py-1', !p.away && 'border-dashed text-muted-foreground')}>
              <span className="min-w-0 flex-1 truncate">{p.home.name}</span>
              <span className="text-xs">{p.away ? '–' : '·'}</span>
              <span className="min-w-0 flex-1 truncate text-right">{p.away?.name ?? 'wolny los'}</span>
            </li>
          ))}
        </ol>
      </div>
      <ThirdPlaceSwitch teamsCount={order.length} value={third} onChange={setThird} />
      <ReplaceWarning />
    </FormDialog>
  );
}

// ——— Terminarz pucharu (A, C) ———

export function CupScheduleA({ actions }: { actions?: ReactNode }) {
  const tournament = useTournament();
  const s = useBracket();
  const { open, setOpen } = useOpenMatch();
  const [params, setParams] = useSearchParams();
  const orders = [...new Set(s.matches.map((m) => m.round.order))].sort((a, b) => a - b);
  const rounds = orders.map((o) => {
    const ms = s.matches.filter((m) => m.round.order === o).sort((a, b) => Number(isThirdPlace(b, s.matches)) - Number(isThirdPlace(a, s.matches)) || a.matchNumber - b.matchNumber);
    return {
      order: o,
      matches: ms,
      summary: {
        id: o,
        name: ms[0].round.name,
        dates: formatRoundDates(ms.map((m) => m.kickoffAt)),
        finished: ms.filter((m) => m.status === 'finished').length,
        total: ms.length,
      },
    };
  });
  const requested = Number(params.get('round'));
  const round = rounds.find((r) => r.order === requested) ?? rounds.find((r) => r.matches.some((m) => m.status !== 'finished')) ?? rounds[rounds.length - 1];

  return (
    <AdminPage tournament={tournament} section="schedule" actions={s.matches.length > 0 ? (actions ?? <DatesButton />) : undefined}>
      {s.matches.length === 0 ? (
        <EmptyState
          icon={<Trophy />}
          title="Terminarz pucharu powstaje z drabinki"
          description="Wygeneruj drabinkę, a mecze pojawią się tu po rundach."
          action={
            <Button asChild>
              <Link to={`/tournaments/${tournament.id}/bracket${window.location.search}`}>Przejdź do drabinki</Link>
            </Button>
          }
        />
      ) : (
        <>
          <BracketNotices onRegenerate={() => undefined} />
          <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <RoundList
              rounds={rounds.map((r) => r.summary)}
              value={round.order}
              onValueChange={(id) => setParams((p) => ({ ...Object.fromEntries(p), round: String(id) }), { replace: true })}
              className="lg:sticky lg:top-4"
            />
            <ul className="space-y-2">
              {round.matches.map((m) => (
                <li key={m.id} className="grid gap-1">
                  <span className="px-1 text-xs text-muted-foreground">{matchLabel(m, s.matches)}</span>
                  <MatchRow
                    match={{
                      ...m,
                      homeTeam: m.homeTeam ?? { id: -1, name: slotSource(m, 'home', s.matches) },
                      awayTeam: m.awayTeam ?? { id: -2, name: slotSource(m, 'away', s.matches) },
                    }}
                    onSelect={() => setOpen(m)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {open && <BracketMatchDialog key={open.id} match={open} onClose={() => setOpen(null)} />}
    </AdminPage>
  );
}

export function CupScheduleC() {
  const tournament = useTournament();
  const s = useBracket();
  const { open, setOpen } = useOpenMatch();
  const orders = [...new Set(s.matches.map((m) => m.round.order))].sort((a, b) => a - b);

  return (
    <AdminPage tournament={tournament} section="schedule" actions={s.matches.length > 0 ? <DatesButton /> : undefined}>
      {s.matches.length === 0 ? (
        <EmptyState icon={<Trophy />} title="Terminarz pucharu powstaje z drabinki" description="Wygeneruj drabinkę na karcie Drabinka." />
      ) : (
        <div className="space-y-6">
          <BracketNotices onRegenerate={() => undefined} />
          {orders.map((o) => {
            const ms = s.matches.filter((m) => m.round.order === o).sort((a, b) => Number(isThirdPlace(b, s.matches)) - Number(isThirdPlace(a, s.matches)) || a.matchNumber - b.matchNumber);
            return (
              <section key={o} className="space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Heading level="card" as="h2">
                    {ms[0].round.name}
                  </Heading>
                  <span className="text-sm text-muted-foreground">{formatRoundDates(ms.map((m) => m.kickoffAt))}</span>
                </div>
                <ul className="space-y-2">
                  {ms.map((m) => (
                    <li key={m.id} className="grid gap-1">
                      <span className="px-1 text-xs text-muted-foreground">{matchLabel(m, s.matches)}</span>
                      <MatchRow
                        match={{
                          ...m,
                          homeTeam: m.homeTeam ?? { id: -1, name: slotSource(m, 'home', s.matches) },
                          awayTeam: m.awayTeam ?? { id: -2, name: slotSource(m, 'away', s.matches) },
                        }}
                        onSelect={() => setOpen(m)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      {open && <BracketMatchDialog key={open.id} match={open} onClose={() => setOpen(null)} />}
    </AdminPage>
  );
}

/** Karta Terminarz w wariantach B i D: zastąpiona przez Drabinkę. */
export function ScheduleReplaced() {
  const tournament = useTournament();
  return (
    <AdminPage tournament={tournament} section="schedule">
      <EmptyState
        icon={<GitFork />}
        title="W pucharze terminarz jest częścią drabinki"
        description="W tym wariancie karta Terminarz jest nieczynna, a daty rozkłada się z Drabinki."
        action={
          <Button asChild>
            <Link to={`/tournaments/${tournament.id}/bracket${window.location.search}`}>Przejdź do drabinki</Link>
          </Button>
        }
      />
    </AdminPage>
  );
}
