// PROTOTYP (#162) — cztery układy ekranu terminarza. Nie do main.
//
// Pytania z ticketu, na które warianty odpowiadają różnie:
// - układ: jedna kolejka / wszystkie kolejki / płaska lista z filtrem / kolejki z boku;
// - wynik: osobna strona meczu / w wierszu / w oknie / w panelu bocznym;
// - termin i obiekt: okno / dymek / to samo okno co wynik / ten sam panel;
// - kolizje: plakietka + licznik przy kolejce / pasek na górze / filtr / lista w panelu.
// Wspólne (shared.tsx): pusty stan, generowanie, rozkład dat, drużyny bez meczów.
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormDialog,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from '@tournament/ui';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Clock, MapPin, Pencil, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { matchesWithCollisions, useScheduleState, type AdminMatch, type Round } from './schedule-store';
import {
  CollisionBadges,
  Score,
  ScoreInputs,
  StatusBadge,
  StatusPills,
  TermFields,
  collisionText,
  draftOf,
  fmtKickoff,
  fmtTime,
  resultBody,
  roundDates,
  rowWhen,
  termBody,
  useSaveMatch,
  withStatus,
  type MatchDraft,
} from './shared';

function useSchedule() {
  const s = useScheduleState();
  const matches = useMemo(() => matchesWithCollisions(s), [s]);
  const byRound = useMemo(() => {
    const map = new Map<number, AdminMatch[]>();
    for (const r of s.rounds) map.set(r.id, []);
    for (const m of matches) map.get(m.round.id)?.push(m);
    return map;
  }, [s.rounds, matches]);
  return { s, matches, byRound };
}

/** Pierwsza kolejka z meczem niezakończonym — tam organizer zwykle wraca. */
function currentRound(rounds: Round[], byRound: Map<number, AdminMatch[]>): Round | undefined {
  return rounds.find((r) => byRound.get(r.id)!.some((m) => m.status !== 'finished')) ?? rounds[rounds.length - 1];
}

function collisionsIn(ms: AdminMatch[]) {
  return ms.filter((m) => m.collisions.length).length;
}

// ═══════════════════════════════════════════════════════════════════════
// A — Kolejka ze strzałkami (jak makieta), wynik na osobnej stronie meczu
// ═══════════════════════════════════════════════════════════════════════

export function VariantA() {
  const { s, matches, byRound } = useSchedule();
  const [params, setParams] = useSearchParams();
  const fallback = currentRound(s.rounds, byRound);
  const round = s.rounds.find((r) => String(r.order) === params.get('round')) ?? fallback;
  const [termFor, setTermFor] = useState<AdminMatch | null>(null);
  if (!round) return null;
  const ms = byRound.get(round.id)!;
  const idx = s.rounds.indexOf(round);
  const goRound = (r: Round | undefined) => {
    if (!r) return;
    const p = new URLSearchParams(params);
    p.set('round', String(r.order));
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" disabled={idx === 0} onClick={() => goRound(s.rounds[idx - 1])} aria-label="Poprzednia kolejka">
          <ChevronLeft className="size-4" />
        </Button>
        <select
          aria-label="Kolejka"
          className="h-9 rounded-md border bg-transparent px-2 text-sm font-medium"
          value={round.order}
          onChange={(e) => goRound(s.rounds.find((r) => r.order === Number(e.target.value)))}
        >
          {s.rounds.map((r) => {
            const c = collisionsIn(byRound.get(r.id)!);
            return (
              <option key={r.id} value={r.order}>
                {r.name}
                {c ? ` · ⚠ ${c} kolizje` : ''}
              </option>
            );
          })}
        </select>
        <Button variant="ghost" size="icon" disabled={idx === s.rounds.length - 1} onClick={() => goRound(s.rounds[idx + 1])} aria-label="Następna kolejka">
          <ChevronRight className="size-4" />
        </Button>
        <span className="ml-auto text-sm tabular-nums text-muted-foreground">{roundDates(ms)}</span>
      </div>

      <Card>
        <CardContent className="divide-y">
          {ms.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Brak meczów w tej kolejce.</p>}
          {ms.map((m) => (
            <div key={m.id} className={cn('flex flex-wrap items-center gap-3 px-3 py-3', m.collisions.length && 'bg-destructive/5')}>
              <button
                type="button"
                className="flex w-40 shrink-0 items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setTermFor(m)}
                title="Zmień termin i obiekt"
              >
                <Clock className="size-3.5 shrink-0" />
                <span className="tabular-nums">{rowWhen(m, ms)}</span>
                {m.venue && <span className="truncate">· {m.venue.name}</span>}
              </button>
              <div className="flex-1 text-right font-medium">{m.homeTeam.name}</div>
              <Score match={m} />
              <div className="flex-1 font-medium">{m.awayTeam.name}</div>
              <div className="flex shrink-0 items-center gap-2">
                <CollisionBadges match={m} all={matches} />
                <StatusBadge status={m.status} />
                <Button size="sm" variant={m.status === 'scheduled' ? 'outline' : 'default'} asChild>
                  <Link to={`matches/${m.id}?${params}`}>{m.status === 'scheduled' ? 'Wpisz wynik' : 'Edytuj'}</Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      {termFor && <TermDialog match={termFor} onClose={() => setTermFor(null)} />}
    </div>
  );
}

function TermDialog({ match, onClose }: { match: AdminMatch; onClose: () => void }) {
  const [draft, setDraft] = useState(draftOf(match));
  const { save, pending, errors } = useSaveMatch();
  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && !pending && onClose()}
      onSubmit={(e) => {
        e.preventDefault();
        void save(match, termBody(draft), 'termin').then((ok) => ok && onClose());
      }}
      title="Termin i obiekt"
      description={`${match.round.name} · ${match.homeTeam.name} – ${match.awayTeam.name}`}
      submitLabel="Zapisz"
      pending={pending}
      error={errors.root}
    >
      <TermFields draft={draft} onChange={setDraft} errors={errors} />
    </FormDialog>
  );
}

/** Strona meczu wariantu A: /tournaments/:id/schedule/matches/:matchId. */
export function MatchPageA() {
  const { id, matchId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { matches } = useSchedule();
  const match = matches.find((m) => String(m.id) === matchId);
  const [draft, setDraft] = useState<MatchDraft | null>(match ? draftOf(match) : null);
  const { save, pending, errors } = useSaveMatch();
  const back = `/tournaments/${id}/schedule?${params}`;
  if (!match || !draft) return <p className="text-sm text-muted-foreground">Nie ma takiego meczu (zmieniony scenariusz?). <Link to={back} className="underline">Wróć do terminarza</Link></p>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const term = termBody(draft);
        void save(match, { ...resultBody(draft), ...term }).then((ok) => ok && navigate(back));
      }}
    >
      <div className="mb-4 flex items-start gap-3">
        <Button type="button" variant="ghost" size="icon" asChild aria-label="Wróć do terminarza">
          <Link to={back}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-lg font-semibold">
            {match.homeTeam.name} – {match.awayTeam.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {match.round.name} · {fmtKickoff(match.kickoffAt)}
            {match.venue && ` · ${match.venue.name}`}
          </p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <CardContent className="flex flex-col items-center gap-5 py-6">
              <div className="flex items-center justify-center gap-6">
                <div className="w-32 text-center font-medium">{match.homeTeam.name}</div>
                <ScoreInputs match={match} draft={draft} onChange={setDraft} error={errors.homeScore} />
                <div className="w-32 text-center font-medium">{match.awayTeam.name}</div>
              </div>
              <StatusPills value={draft.status} onChange={(st) => setDraft(withStatus(draft, st))} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm font-medium">Termin i obiekt</p>
              <TermFields draft={draft} onChange={setDraft} errors={errors} />
              {match.collisions.length > 0 && <CollisionList match={match} all={matches} />}
            </CardContent>
          </Card>
        </div>
        <Card className="border-dashed lg:col-span-2">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Zdarzenia</p>
            <p className="mt-1">Strzelcy i kartki dojdą w S3 — tutaj, obok wyniku.</p>
          </CardContent>
        </Card>
      </div>
      {errors.root && <p className="mt-4 text-right text-sm text-destructive">{errors.root}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link to={back}>Anuluj</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          <Save /> {pending ? 'Zapisywanie…' : 'Zapisz'}
        </Button>
      </div>
    </form>
  );
}

function CollisionList({ match, all, onJump }: { match: AdminMatch; all: AdminMatch[]; onJump?: (id: number) => void }) {
  return (
    <ul className="space-y-1 rounded-md bg-destructive/5 p-2 text-sm text-destructive">
      {collisionText(match, all).map((t, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {onJump ? (
            <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => onJump(match.collisions[i].matchId)}>
              {t}
            </button>
          ) : (
            t
          )}
        </li>
      ))}
      <li className="text-xs text-muted-foreground">Kolizja nie blokuje zapisu.</li>
    </ul>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// B — Wszystkie kolejki na jednej stronie, wynik wpisywany w wierszu
// ═══════════════════════════════════════════════════════════════════════

export function VariantB() {
  const { s, matches, byRound } = useSchedule();
  const colliding = matches.filter((m) => m.collisions.length);
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  useEffect(() => {
    const r = currentRound(s.rounds, byRound);
    if (r) document.getElementById(`round-${r.order}`)?.scrollIntoView({ block: 'start' });
    // tylko przy wejściu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {colliding.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="size-4" />
          <span className="flex-1">
            {colliding.length} mecze mają kolizję terminu (ta sama drużyna albo boisko w tym samym czasie).
          </span>
          <Button size="sm" variant="outline" onClick={() => jump(`match-${colliding[0].id}`)}>
            Pokaż pierwszą
          </Button>
        </div>
      )}
      <nav aria-label="Kolejki" className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto bg-background/95 px-1 py-2 backdrop-blur">
        {s.rounds.map((r) => {
          const ms = byRound.get(r.id)!;
          const done = ms.length > 0 && ms.every((m) => m.status === 'finished');
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => jump(`round-${r.order}`)}
              className={cn(
                'shrink-0 rounded-md border px-2 py-1 text-xs tabular-nums',
                done && 'bg-muted text-muted-foreground',
                collisionsIn(ms) && 'border-destructive text-destructive',
              )}
            >
              {r.order}
            </button>
          );
        })}
      </nav>
      {s.rounds.map((r) => {
        const ms = byRound.get(r.id)!;
        return (
          <section key={r.id} id={`round-${r.order}`} className="scroll-mt-14">
            <div className="mb-1.5 flex items-baseline gap-2">
              <h3 className="font-semibold">{r.name}</h3>
              <span className="text-sm text-muted-foreground">{roundDates(ms)}</span>
            </div>
            <Card>
              <CardContent className="divide-y p-0">
                {ms.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Brak meczów.</p>}
                {ms.map((m) => (
                  <InlineRow key={m.id + m.status + m.homeScore + m.awayScore + m.kickoffAt} match={m} all={matches} />
                ))}
              </CardContent>
            </Card>
          </section>
        );
      })}
    </div>
  );
}

function InlineRow({ match, all }: { match: AdminMatch; all: AdminMatch[] }) {
  const initial = draftOf(match);
  const [draft, setDraft] = useState(initial);
  const { save, pending, errors, setErrors } = useSaveMatch();
  const dirty = draft.home !== initial.home || draft.away !== initial.away || draft.status !== initial.status;

  return (
    <div id={`match-${match.id}`} className={cn('px-4 py-2', match.collisions.length && 'bg-destructive/5', dirty && 'bg-primary/5')}>
      <div className="flex flex-wrap items-center gap-3">
        <TermPopover match={match} />
        <div className="flex-1 text-right text-sm font-medium">{match.homeTeam.name}</div>
        <ScoreInputs match={match} draft={draft} onChange={setDraft} size="sm" />
        <div className="flex-1 text-sm font-medium">{match.awayTeam.name}</div>
        <StatusPills size="sm" value={draft.status} onChange={(st) => setDraft(withStatus(draft, st))} />
        <div className="flex w-36 shrink-0 justify-end gap-1">
          {dirty ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(initial);
                  setErrors({});
                }}
              >
                Cofnij
              </Button>
              <Button size="sm" disabled={pending} onClick={() => void save(match, resultBody(draft))}>
                {pending ? '…' : 'Zapisz'}
              </Button>
            </>
          ) : (
            <CollisionBadges match={match} all={all} />
          )}
        </div>
      </div>
      {(errors.homeScore || errors.root) && <p className="mt-1 text-center text-sm text-destructive">{errors.homeScore ?? errors.root}</p>}
    </div>
  );
}

function TermPopover({ match }: { match: AdminMatch }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(draftOf(match));
  const { save, pending, errors } = useSaveMatch();
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(draftOf(match));
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="w-36 shrink-0 text-left text-xs text-muted-foreground hover:text-foreground">
          <span className="block tabular-nums">{match.kickoffAt ? fmtKickoff(match.kickoffAt) : 'Termin do ustalenia'}</span>
          <span className="block truncate">{match.venue?.name ?? '—'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96" align="start">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save(match, termBody(draft), 'termin').then((ok) => ok && setOpen(false));
          }}
        >
          <TermFields draft={draft} onChange={setDraft} errors={errors} />
          {errors.root && <p className="text-sm text-destructive">{errors.root}</p>}
          <div className="flex justify-end">
            <Button size="sm" type="submit" disabled={pending}>
              Zapisz termin
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// C — Płaska tabela meczów z filtrem, wynik i termin w jednym oknie
// ═══════════════════════════════════════════════════════════════════════

export function VariantC() {
  const { s, matches } = useSchedule();
  const [round, setRound] = useState<string>(() => String(currentRound(s.rounds, new Map(s.rounds.map((r) => [r.id, matches.filter((m) => m.round.id === r.id)])))?.order ?? ''));
  const [status, setStatus] = useState('');
  const [onlyCollisions, setOnlyCollisions] = useState(false);
  const [onlyUndated, setOnlyUndated] = useState(false);
  const [open, setOpen] = useState<AdminMatch | null>(null);
  const shown = matches.filter(
    (m) =>
      (!round || String(m.round.order) === round) &&
      (!status || m.status === status) &&
      (!onlyCollisions || m.collisions.length) &&
      (!onlyUndated || !m.kickoffAt),
  );
  const cCount = matches.filter((m) => m.collisions.length).length;
  const uCount = matches.filter((m) => !m.kickoffAt).length;
  const select = 'h-9 rounded-md border bg-transparent px-2 text-sm';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Kolejka" className={select} value={round} onChange={(e) => setRound(e.target.value)}>
          <option value="">Wszystkie kolejki</option>
          {s.rounds.map((r) => (
            <option key={r.id} value={r.order}>
              {r.name}
            </option>
          ))}
        </select>
        <select aria-label="Stan" className={select} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Każdy stan</option>
          <option value="scheduled">Zaplanowane</option>
          <option value="live">Trwające</option>
          <option value="finished">Zakończone</option>
        </select>
        <label className={cn('flex h-9 items-center gap-1.5 rounded-md border px-2 text-sm', cCount && 'border-destructive/40 text-destructive')}>
          <input type="checkbox" checked={onlyCollisions} onChange={(e) => setOnlyCollisions(e.target.checked)} /> Z kolizją ({cCount})
        </label>
        <label className="flex h-9 items-center gap-1.5 rounded-md border px-2 text-sm">
          <input type="checkbox" checked={onlyUndated} onChange={(e) => setOnlyUndated(e.target.checked)} /> Bez terminu ({uCount})
        </label>
        <span className="ml-auto text-sm text-muted-foreground">{shown.length} meczów</span>
      </div>
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Kolejka</TableHead>
              <TableHead className="w-40">Termin</TableHead>
              <TableHead className="w-32">Obiekt</TableHead>
              <TableHead className="text-right">Gospodarz</TableHead>
              <TableHead className="w-20 text-center">Wynik</TableHead>
              <TableHead>Gość</TableHead>
              <TableHead className="w-48">Stan</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  {round && !status && !onlyCollisions && !onlyUndated ? 'Brak meczów w tej kolejce.' : 'Żaden mecz nie pasuje do filtrów.'}
                </TableCell>
              </TableRow>
            )}
            {shown.map((m) => (
              <TableRow key={m.id} className={cn('cursor-pointer', m.collisions.length && 'bg-destructive/5')} onClick={() => setOpen(m)}>
                <TableCell className="text-muted-foreground">{m.round.name.replace('Kolejka ', 'K')}</TableCell>
                <TableCell className="tabular-nums">{fmtKickoff(m.kickoffAt)}</TableCell>
                <TableCell className="truncate">{m.venue?.name ?? '—'}</TableCell>
                <TableCell className="text-right font-medium">{m.homeTeam.name}</TableCell>
                <TableCell className="text-center">
                  <Score match={m} className="px-1.5" />
                </TableCell>
                <TableCell className="font-medium">{m.awayTeam.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge status={m.status} />
                    <CollisionBadges match={m} all={matches} />
                  </div>
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" aria-label={`Edytuj mecz ${m.homeTeam.name} – ${m.awayTeam.name}`}>
                    <Pencil className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {open && <MatchDialogC match={open} all={matches} onClose={() => setOpen(null)} />}
    </div>
  );
}

function MatchDialogC({ match, all, onClose }: { match: AdminMatch; all: AdminMatch[]; onClose: () => void }) {
  const [draft, setDraft] = useState(draftOf(match));
  const { save, pending, errors } = useSaveMatch();
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void save(match, { ...resultBody(draft), ...termBody(draft) }).then((ok) => ok && onClose());
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {match.homeTeam.name} – {match.awayTeam.name}
            </DialogTitle>
            <DialogDescription>{match.round.name}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <ScoreInputs match={match} draft={draft} onChange={setDraft} error={errors.homeScore} />
            <StatusPills value={draft.status} onChange={(st) => setDraft(withStatus(draft, st))} />
          </div>
          <div className="border-t pt-4">
            <TermFields draft={draft} onChange={setDraft} errors={errors} />
          </div>
          {match.collisions.length > 0 && <CollisionList match={match} all={all} />}
          {errors.root && <p className="text-sm text-destructive">{errors.root}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Anuluj
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Zapisywanie…' : 'Zapisz'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// D — Lista kolejek z boku, mecze kolejki w środku, mecz w panelu bocznym
// ═══════════════════════════════════════════════════════════════════════

export function VariantD() {
  const { s, matches, byRound } = useSchedule();
  const [roundId, setRoundId] = useState<number | undefined>(() => currentRound(s.rounds, byRound)?.id);
  const [openId, setOpenId] = useState<number | null>(null);
  const round = s.rounds.find((r) => r.id === roundId) ?? s.rounds[0];
  if (!round) return null;
  const ms = byRound.get(round.id)!;
  const open = matches.find((m) => m.id === openId) ?? null;
  const jumpTo = (id: number) => {
    const target = matches.find((m) => m.id === id);
    if (!target) return;
    setRoundId(target.round.id);
    setOpenId(id);
  };

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      <nav aria-label="Kolejki" className="max-h-[70vh] space-y-0.5 overflow-y-auto rounded-xl border bg-card p-1.5">
        {s.rounds.map((r) => {
          const rms = byRound.get(r.id)!;
          const done = rms.filter((m) => m.status === 'finished').length;
          const c = collisionsIn(rms);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRoundId(r.id)}
              className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted', r.id === round.id && 'bg-muted font-medium')}
            >
              <span className="flex-1">
                {r.name}
                <span className="block text-xs font-normal text-muted-foreground">{roundDates(rms) || '—'}</span>
              </span>
              {c > 0 && <span className="grid size-5 place-items-center rounded-full bg-destructive text-[10px] text-white">{c}</span>}
              <span className="text-xs tabular-nums text-muted-foreground">
                {done}/{rms.length}
              </span>
            </button>
          );
        })}
      </nav>
      <div className="space-y-2">
        <div className="flex items-baseline gap-2">
          <h3 className="font-semibold">{round.name}</h3>
          <span className="text-sm text-muted-foreground">{roundDates(ms)}</span>
        </div>
        {ms.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Brak meczów w tej kolejce.</p>}
        {ms.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setOpenId(m.id)}
            className={cn(
              'grid w-full grid-cols-[90px_1fr_auto_1fr_auto] items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left hover:border-foreground/30',
              m.collisions.length && 'border-destructive/40 bg-destructive/5',
              openId === m.id && 'ring-2 ring-primary',
            )}
          >
            <span className="text-xs text-muted-foreground">
              <span className="block tabular-nums">{m.kickoffAt ? fmtTime(m.kickoffAt) : 'do ustalenia'}</span>
              <span className="flex items-center gap-0.5 truncate">
                {m.venue && <MapPin className="size-3" />}
                {m.venue?.name ?? ''}
              </span>
            </span>
            <span className="text-right font-medium">{m.homeTeam.name}</span>
            <Score match={m} />
            <span className="font-medium">{m.awayTeam.name}</span>
            <span className="flex gap-1">
              {m.collisions.length > 0 && (
                <Badge variant="destructive">
                  <AlertTriangle />
                </Badge>
              )}
              <StatusBadge status={m.status} />
            </span>
          </button>
        ))}
      </div>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {open && <MatchPanelD key={open.id + open.status + open.kickoffAt} match={open} all={matches} onJump={jumpTo} onDone={() => setOpenId(null)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MatchPanelD({ match, all, onJump, onDone }: { match: AdminMatch; all: AdminMatch[]; onJump: (id: number) => void; onDone: () => void }) {
  const [draft, setDraft] = useState(draftOf(match));
  const { save, pending, errors } = useSaveMatch();
  return (
    <form
      className="flex h-full flex-col gap-5 px-4 pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save(match, { ...resultBody(draft), ...termBody(draft) }).then((ok) => ok && onDone());
      }}
    >
      <SheetHeader className="px-0">
        <SheetTitle>
          {match.homeTeam.name} – {match.awayTeam.name}
        </SheetTitle>
        <SheetDescription>
          {match.round.name} · mecz {match.matchNumber}
        </SheetDescription>
      </SheetHeader>
      <section className="flex flex-col items-center gap-3">
        <ScoreInputs match={match} draft={draft} onChange={setDraft} error={errors.homeScore} />
        <StatusPills value={draft.status} onChange={(st) => setDraft(withStatus(draft, st))} />
      </section>
      <section className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium">Termin i obiekt</p>
        <TermFields draft={draft} onChange={setDraft} errors={errors} />
      </section>
      {match.collisions.length > 0 && <CollisionList match={match} all={all} onJump={onJump} />}
      <section className="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">Zdarzenia (S3) dojdą tutaj, pod wynikiem.</section>
      {errors.root && <p className="text-sm text-destructive">{errors.root}</p>}
      <div className="mt-auto flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Zamknij
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Zapisywanie…' : 'Zapisz'}
        </Button>
      </div>
    </form>
  );
}
