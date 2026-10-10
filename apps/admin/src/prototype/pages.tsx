// PROTOTYP (#163) — ekrany wariantów. Nie do main.
//
// Turniej (nagłówek, karty) przychodzi z mocka przez `TournamentLayout`,
// etykiety kryteriów z `GET /sports`. Tabela i zapisane kryteria są lokalne
// (`standings-data.ts`, `standings-store.ts`), bo mock nie liczy i nie pamięta.
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  Heading,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TiebreakerList,
  cn,
  toast,
} from '@tournament/ui';
import { CalendarDays, Loader2, Radio } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { useTournament } from '../pages/tournament-layout';
import { useSports } from '../lib/use-sports';
import { FIXTURES, computeStandings, liveCount, type TiebreakerCode } from './standings-data';
import { SaveError, saveTiebreakers, sim, useProto } from './standings-store';
import { CriteriaSentence, StandingsTable, type Labels } from './standings-table';
import { ButtonsEditor, ChipsEditor, DragEditor } from './tiebreaker-editors';
import { useVariant } from './variant';

/** Sport z panelu stanu, z etykietami i listą dostępnych kryteriów z `GET /sports`. */
function useProtoSport() {
  const proto = useProto();
  const sports = useSports();
  const sport = sports.data?.find((s) => s.code === proto.sport);
  const fixture = FIXTURES[proto.sport];
  return {
    proto,
    fixture,
    ready: !!sport,
    labels: (sport?.config.tiebreakerLabels ?? {}) as Labels,
    available: (sport?.config.availableTiebreakers ?? []) as TiebreakerCode[],
    allowsDraw: sport?.config.allowsDraw ?? true,
    scoreLabel: proto.sport === 'football' ? 'Bramki' : 'Punkty',
    saved: proto.saved[proto.sport],
  };
}

function useHref() {
  const location = useLocation();
  return (path: string) => `${path}${location.search}`;
}

function LiveNote({ count }: { count: number }) {
  if (!count) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Radio className="size-3.5 text-rose-600" /> {count} mecz w trakcie — tabela liczy tylko mecze zakończone.
    </p>
  );
}

function StageHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <Heading level="card">{title}</Heading>
      <span className="text-xs text-muted-foreground">{meta}</span>
    </div>
  );
}

const playedMeta = (rows: { played: number }[]) =>
  `${rows.length} drużyn · ${Math.max(0, ...rows.map((r) => r.played))} kolejek rozegranych`;

// ---------------------------------------------------------------- trasa /standings (A, B)

export function StandingsPrototypePage() {
  const variant = useVariant();
  const tournament = useTournament();
  return (
    <AdminPage tournament={tournament} section="standings">
      {variant === 'A' && <VariantA />}
      {variant === 'B' && <VariantB />}
      {variant === 'C' && (
        <EmptyState
          title="W wariancie C tabela jest w Terminarzu"
          description="Sekcji „Tabela” nie ma, karta jest schowana."
          action={
            <Button asChild>
              <Link to={`/tournaments/${tournament.id}/schedule?variant=C`}>Przejdź do Terminarza</Link>
            </Button>
          }
        />
      )}
      <StatePanel />
    </AdminPage>
  );
}

/** A: sama tabela, kryteria zdaniem pod nią i odnośnik do ustawień. */
function VariantA() {
  const s = useProtoSport();
  const href = useHref();
  const tournament = useTournament();
  const rows = useMemo(() => computeStandings(s.fixture, s.saved), [s.fixture, s.saved]);
  if (!s.ready) return null;
  return (
    <div className="max-w-4xl space-y-3">
      <StageHeader title="Faza zasadnicza" meta={playedMeta(rows)} />
      <StandingsTable
        rows={rows}
        scoreLabel={s.scoreLabel}
        allowsDraw={s.allowsDraw}
        labels={s.labels}
        showSeparators={s.proto.showSeparators}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CriteriaSentence tiebreakers={s.saved} labels={s.labels} />
          <LiveNote count={liveCount(s.fixture)} />
        </div>
        <Button variant="link" size="sm" asChild className="h-auto p-0">
          <Link to={href(`/tournaments/${tournament.id}/settings`)}>Zmień kolejność w ustawieniach</Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * B: tabela i panel kryteriów obok. Zmiana w panelu od razu przelicza tabelę
 * jako podgląd (strzałki i podświetlenie przy przesuniętych drużynach), a zapis
 * idzie dopiero przyciskiem.
 */
function VariantB() {
  const s = useProtoSport();
  const [draft, setDraft] = useState<TiebreakerCode[]>(s.saved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Zmiana sportu w panelu stanu albo zapis z innego wariantu: szkic od nowa.
  useEffect(() => setDraft(s.saved), [s.saved]);

  const savedRows = useMemo(() => computeStandings(s.fixture, s.saved), [s.fixture, s.saved]);
  const rows = useMemo(() => computeStandings(s.fixture, draft), [s.fixture, draft]);
  const dirty = draft.join() !== s.saved.join();
  const previous = useMemo(
    () => (dirty ? new Map(savedRows.map((r) => [r.team.id, r.position])) : undefined),
    [dirty, savedRows],
  );
  const moved = previous ? rows.filter((r) => previous.get(r.team.id) !== r.position).length : 0;

  async function save() {
    setPending(true);
    setError(null);
    try {
      await saveTiebreakers(draft);
      toast.success('Zapisano kolejność kryteriów.');
    } catch (e) {
      setError((e as SaveError).message);
    } finally {
      setPending(false);
    }
  }

  if (!s.ready) return null;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-3">
        <StageHeader title="Faza zasadnicza" meta={playedMeta(rows)} />
        <StandingsTable
          rows={rows}
          scoreLabel={s.scoreLabel}
          allowsDraw={s.allowsDraw}
          labels={s.labels}
          showSeparators={s.proto.showSeparators}
          previousPositions={previous}
        />
        <LiveNote count={liveCount(s.fixture)} />
      </div>
      <Card className="lg:sticky lg:top-4">
        <CardHeader>
          <CardTitle>Rozstrzyganie remisów</CardTitle>
          <CardDescription>
            Przeciągnij, żeby zmienić kolejność. Tabela obok pokazuje skutek przed zapisem.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DragEditor value={draft} onChange={setDraft} available={s.available} labels={s.labels} disabled={pending} />
        </CardContent>
        {(dirty || error) && (
          <CardFooter className="flex-col items-stretch gap-2 border-t">
            {dirty && (
              <p className="text-xs text-muted-foreground">
                {moved ? `Podgląd: ${moved} drużyn zmienia miejsce.` : 'Podgląd: kolejność w tabeli bez zmian.'}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" disabled={pending || !dirty} onClick={() => setDraft(s.saved)}>
                Odrzuć
              </Button>
              <Button disabled={pending || !dirty} onClick={() => void save()}>
                {pending && <Loader2 className="size-4 animate-spin" />} Zapisz kolejność
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- trasa /schedule (C)

export function SchedulePrototypePage() {
  const variant = useVariant();
  const tournament = useTournament();
  const [tab, setTab] = useState('standings');
  return (
    <AdminPage tournament={tournament} section="schedule">
      {variant === 'C' ? (
        <Tabs value={tab} onValueChange={setTab} className="max-w-4xl">
          <TabsList>
            <TabsTrigger value="matches">Mecze</TabsTrigger>
            <TabsTrigger value="standings">Tabela</TabsTrigger>
          </TabsList>
          <TabsContent value="matches">
            <EmptyState
              icon={<CalendarDays />}
              title="Lista meczów"
              description="Ekran meczów prototypuje #162. Tu stoi tylko po to, żeby zakładka „Tabela” miała sąsiada."
            />
          </TabsContent>
          <TabsContent value="standings">
            <VariantC />
          </TabsContent>
        </Tabs>
      ) : (
        <EmptyState
          icon={<CalendarDays />}
          title="Terminarz prototypuje #162"
          description="W wariantach A i B tabela ma własną sekcję „Tabela”."
        />
      )}
      <StatePanel />
    </AdminPage>
  );
}

/**
 * C: kryteria jako zdanie z chipów nad tabelą. Każda zmiana idzie od razu
 * `PATCH`-em; tabela przelicza się dopiero po odpowiedzi, a toast daje „Cofnij”.
 */
function VariantC() {
  const s = useProtoSport();
  const [pending, setPending] = useState(false);
  const rows = useMemo(() => computeStandings(s.fixture, s.saved), [s.fixture, s.saved]);

  async function change(next: TiebreakerCode[]) {
    const before = s.saved;
    setPending(true);
    try {
      await saveTiebreakers(next);
      toast.success('Zapisano kolejność kryteriów.', {
        action: { label: 'Cofnij', onClick: () => void change(before) },
      });
    } catch (e) {
      toast.error((e as SaveError).message);
    } finally {
      setPending(false);
    }
  }

  if (!s.ready) return null;
  return (
    <div className="space-y-3 pt-2">
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2',
          pending && 'opacity-60',
        )}
      >
        <ChipsEditor
          value={s.saved}
          onChange={(next) => void change(next)}
          available={s.available}
          labels={s.labels}
          disabled={pending}
        />
        {pending && <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground" />}
      </div>
      <StandingsTable
        rows={rows}
        scoreLabel={s.scoreLabel}
        allowsDraw={s.allowsDraw}
        labels={s.labels}
        showSeparators={s.proto.showSeparators}
        compact
      />
      <LiveNote count={liveCount(s.fixture)} />
    </div>
  );
}

// ---------------------------------------------------------------- Ustawienia

/**
 * Wstawka w miejsce dzisiejszej `TiebreakerList` na ekranie ustawień.
 *
 * - A: edytor ↑/↓ w formularzu; szkic wraca do `SettingsForm`, który zapisuje
 *   go razem z resztą pól przez „Zapisz zmiany”.
 * - B, C: lista do odczytu jak dziś, z odnośnikiem do miejsca edycji.
 */
export function SettingsTiebreakers({
  draft,
  onDraft,
  disabled,
}: {
  draft: TiebreakerCode[];
  onDraft: (next: TiebreakerCode[]) => void;
  disabled: boolean;
}) {
  const variant = useVariant();
  const s = useProtoSport();
  const tournament = useTournament();
  const href = useHref();
  if (!s.ready) return null;

  if (variant === 'A') {
    return (
      <div role="group" aria-labelledby="tiebreakers-label" className="space-y-2">
        <p id="tiebreakers-label" className="text-sm font-medium">
          Kolejność rozstrzygania remisów w tabeli
        </p>
        <p className="text-xs text-muted-foreground">Zmiana przelicza tabelę wstecz, także po rozegranych meczach.</p>
        <ButtonsEditor value={draft} onChange={onDraft} available={s.available} labels={s.labels} disabled={disabled} />
      </div>
    );
  }
  const target = variant === 'B' ? `/tournaments/${tournament.id}/standings` : `/tournaments/${tournament.id}/schedule`;
  return (
    <div role="group" aria-labelledby="tiebreakers-label" className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p id="tiebreakers-label" className="text-sm font-medium">
          Kolejność rozstrzygania remisów w tabeli
        </p>
        <Button variant="link" size="sm" asChild className="h-auto p-0">
          <Link to={href(target)}>{variant === 'B' ? 'Zmień przy tabeli' : 'Zmień w Terminarzu → Tabela'}</Link>
        </Button>
      </div>
      <TiebreakerList items={s.saved.map((code) => ({ code, label: s.labels[code] ?? code }))} />
    </div>
  );
}

/** Stan prototypu dla wariantu A w `SettingsForm`: szkic, „brudność” i zapis. */
export function useSettingsTiebreakers() {
  const variant = useVariant();
  const { proto } = useProtoSport();
  const saved = proto.saved[proto.sport];
  const [draft, setDraft] = useState<TiebreakerCode[]>(saved);
  useEffect(() => setDraft(saved), [saved]);
  const dirty = variant === 'A' && draft.join() !== saved.join();
  return {
    draft,
    setDraft,
    dirty,
    discard: () => setDraft(saved),
    save: async () => {
      if (dirty) await saveTiebreakers(draft);
    },
  };
}

// ---------------------------------------------------------------- panel stanu

export function StatePanel() {
  const { proto } = useProtoSport();
  const variant = useVariant();
  const [open, setOpen] = useState(false);
  return (
    <aside className="fixed right-4 bottom-4 z-40 w-80 space-y-2 rounded-xl border border-fuchsia-500/60 bg-zinc-900/95 p-3 text-xs text-zinc-100 shadow-2xl">
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left font-semibold text-fuchsia-300">
        PROTOTYP #163 · stan (wariant {variant}) {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(['football', 'basketball'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => sim.setSport(code)}
                className={cn(
                  'rounded px-2 py-0.5 ring-1 ring-zinc-600',
                  proto.sport === code && 'bg-fuchsia-600 ring-fuchsia-400',
                )}
              >
                {code === 'football' ? 'Piłka' : 'Kosz'}
              </button>
            ))}
            <button
              type="button"
              onClick={() => sim.toggle('showSeparators')}
              className={cn(
                'rounded px-2 py-0.5 ring-1 ring-zinc-600',
                proto.showSeparators && 'bg-fuchsia-600 ring-fuchsia-400',
              )}
            >
              co rozstrzygnęło
            </button>
            <button
              type="button"
              onClick={() => sim.toggle('failNext')}
              className={cn('rounded px-2 py-0.5 ring-1 ring-zinc-600', proto.failNext && 'bg-rose-600 ring-rose-400')}
            >
              następny zapis → 500
            </button>
            <button type="button" onClick={() => sim.reset()} className="rounded px-2 py-0.5 ring-1 ring-zinc-600">
              reset
            </button>
          </div>
          <p className="font-mono text-[11px] text-zinc-300">zapisane: [{proto.saved[proto.sport].join(', ')}]</p>
          <ul className="space-y-0.5 font-mono text-[10px] text-zinc-400">
            {proto.log.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}
