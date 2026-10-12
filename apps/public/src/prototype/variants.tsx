// PROTOTYP (#205) — trzy układy strony meczu. Nie do main.
//
// A „Kafel i sekcje”: nagłówek jak kafel „Na żywo” z Przeglądu, pod nim
//   sekcja „Strzelcy” i pełna oś ze wszystkimi zdarzeniami. Nic się nie zwija.
// B „Pas i relacja”: pełnoszerokościowy pas w barwach turnieju, strzelcy
//   w samym pasie, oś z wyróżnionymi zdobyczami i bieżącym wynikiem,
//   podzielona na połowy/kwarty (w koszu zwinięte), na żywo najnowsze u góry.
// C „Zestawienie”: zwarty, przyklejony wynik, zestawienie per zawodnik
//   (bramki i kartki / rzuty 1-2-3, punkty, faule) obok osi; na telefonie
//   zakładki „Zawodnicy | Oś meczu”.
import { Card, CardContent, CardHeader, CardTitle, Tabs, TabsContent, TabsList, TabsTrigger, TeamLogo, cn } from '@tournament/ui';
import { PhotoPanel } from '@tournament/ui/components/layout/photo-panel.tsx';
import fieldImg from '@tournament/ui/assets/public/field.webp';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { EVENT_TYPES, isScoring, valueOf, type MatchEvent, type ProtoMatch, type Sport } from './demo';
import {
  BackLink,
  EventIcon,
  MatchMeta,
  NotStarted,
  ScoreText,
  ScorerColumns,
  StatusLabel,
  TeamName,
  minuteText,
  who,
} from './shared';

type Props = { match: ProtoMatch; sport: Sport };

// ============================================================================
// A — Kafel i sekcje
// ============================================================================

export function VariantA({ match, sport }: Props) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <BackLink match={match} className="self-start text-muted-foreground" />

      <section className="rounded-xl border border-primary/25 bg-card p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{match.round.name}</p>
          <StatusLabel match={match} />
        </div>
        {/* Stałe kolumny: wynik stoi pośrodku bez względu na długość nazw (#162). */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
          <TeamName team={match.homeTeam} align="right" />
          <div
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-2xl font-extrabold tabular-nums whitespace-nowrap shadow-sm sm:px-4 sm:py-2 sm:text-4xl',
              match.status === 'scheduled' ? 'border border-dashed text-muted-foreground/70' : 'bg-muted',
            )}
          >
            <ScoreText match={match} />
          </div>
          <TeamName team={match.awayTeam} align="left" />
        </div>
        <MatchMeta match={match} className="mt-4 text-sm text-muted-foreground" />
      </section>

      {match.status === 'scheduled' ? (
        <NotStarted />
      ) : match.events.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">
          Organizator nie wpisał zdarzeń tego meczu.
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{sport === 'football' ? 'Strzelcy' : 'Punkty zawodników'}</CardTitle>
            </CardHeader>
            <CardContent>
              <ScorerColumns match={match} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Przebieg meczu</CardTitle>
            </CardHeader>
            <CardContent>
              <PlainTimeline match={match} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/** `MatchTimeline` po zmianach z #192: bez „ · ”, bez dopisku o klasyfikacji. */
function PlainTimeline({ match }: { match: ProtoMatch }) {
  return (
    <ol aria-label="Oś meczu" className="grid gap-1">
      {match.events.map((e) => {
        const home = e.team.id === match.homeTeam.id;
        const cell = (
          <span className={cn('min-w-0 break-words hyphens-auto text-sm', home ? 'text-right' : 'text-left')}>
            <span className="font-medium">{e.typeLabel}</span> <span className="text-muted-foreground">{who(e)}</span>
          </span>
        );
        return (
          <li key={e.id} className="grid grid-cols-[1fr_3rem_1fr] items-center">
            {home ? cell : <span />}
            <span className="text-center text-xs tabular-nums text-muted-foreground">{minuteText(e.minute)}</span>
            {home ? <span /> : cell}
          </li>
        );
      })}
    </ol>
  );
}

// ============================================================================
// B — Pas i relacja
// ============================================================================

export function VariantB({ match, sport }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <PhotoPanel src={fieldImg} overlay="strong" className="rounded-xl px-4 pb-5 pt-3 sm:px-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <BackLink match={match} className="text-brand-foreground/90" />
          <StatusLabel match={match} onDark />
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-6">
          <BandTeam team={match.homeTeam} />
          <div className="pt-2 text-center">
            <div className="text-4xl font-extrabold tabular-nums drop-shadow-sm sm:text-6xl">
              <ScoreText match={match} />
            </div>
            <p className="mt-1 text-xs text-brand-foreground/80">{match.round.name}</p>
          </div>
          <BandTeam team={match.awayTeam} />
        </div>
        {match.scorers.length > 0 && (
          <BandScorers match={match} />
        )}
        <MatchMeta match={match} className="mt-4 text-xs text-brand-foreground/85 sm:text-sm" />
      </PhotoPanel>

      {match.status === 'scheduled' ? (
        <NotStarted />
      ) : match.events.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">
          Organizator nie wpisał zdarzeń tego meczu.
        </p>
      ) : (
        <div className="mx-auto w-full max-w-3xl">
          <Relation match={match} sport={sport} />
        </div>
      )}
    </div>
  );
}

function BandTeam({ team }: { team: ProtoMatch['homeTeam'] }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <TeamLogo logoUrl={team.logoUrl} name={team.name} className="size-12 rounded-full bg-white/15 p-1 ring-1 ring-white/25 sm:size-16" />
      <span className="break-words text-sm font-semibold leading-tight drop-shadow-sm sm:text-lg">{team.name}</span>
    </div>
  );
}

/** Strzelcy w samym pasie, jak na planszy telewizyjnej; w koszu tylko trzech najlepszych. */
function BandScorers({ match }: { match: ProtoMatch }) {
  const sumFormat = match.scorers.some((s) => s.minutes.length !== s.value);
  const side = (home: boolean) => {
    const rows = match.scorers.filter((s) => ((s.team.id === match.homeTeam.id) !== s.ownGoal) === home);
    return sumFormat ? [...rows].sort((a, b) => b.value - a.value).slice(0, 3) : rows;
  };
  return (
    <div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-3 text-xs text-brand-foreground/90 sm:gap-6">
      {[true, false].map((home, i) => (
        <ul key={i} className={cn('space-y-0.5', home ? 'col-start-1 text-right' : 'col-start-3 text-left')}>
          {side(home).map((s) => (
            <li key={`${s.player.id}-${s.ownGoal}`} className="break-words">
              {s.player.name}
              {s.ownGoal && ' (sam.)'}{' '}
              <span className="tabular-nums opacity-80">
                {s.minutes.length === s.value ? s.minutes.map((m) => `${m}′`).join(' ') : s.value}
              </span>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

type Period = { key: string; label: string; events: MatchEvent[] };

/** Połowy w piłce, kwarty po 10 minut w koszu (FIBA). Bez minuty — osobno na końcu. */
function periods(match: ProtoMatch, sport: Sport): Period[] {
  const out: Period[] = [];
  const bucket = (e: MatchEvent) => {
    if (e.minute === null) return { key: 'none', label: 'Bez minuty' };
    if (sport === 'football') return e.minute <= 45 ? { key: '1', label: '1. połowa' } : { key: '2', label: '2. połowa' };
    const q = Math.min(4, Math.ceil(e.minute / 10));
    return { key: String(q), label: `${q}. kwarta` };
  };
  for (const e of match.events) {
    const b = bucket(e);
    let p = out.find((x) => x.key === b.key);
    if (!p) out.push((p = { ...b, events: [] }));
    p.events.push(e);
  }
  return out;
}

function Relation({ match, sport }: Props) {
  const live = match.status === 'live';
  const all = periods(match, sport);
  // Bieżący wynik po każdym zdarzeniu, żeby zdobycz mówiła „2:1”, a nie tylko „Bramka”.
  const running = new Map<number, string>();
  let h = 0;
  let a = 0;
  for (const e of match.events) {
    if (!isScoring(sport, e.type)) continue;
    const forHome = (e.team.id === match.homeTeam.id) !== (e.type === 'own_goal');
    if (forHome) h += valueOf(sport, e.type);
    else a += valueOf(sport, e.type);
    running.set(e.id, `${h}:${a}`);
  }
  const periodScore = (p: Period) => {
    let ph = 0;
    let pa = 0;
    for (const e of p.events) {
      if (!isScoring(sport, e.type)) continue;
      const forHome = (e.team.id === match.homeTeam.id) !== (e.type === 'own_goal');
      if (forHome) ph += valueOf(sport, e.type);
      else pa += valueOf(sport, e.type);
    }
    return `${ph}:${pa}`;
  };
  // Na żywo najnowsze u góry, po meczu chronologicznie.
  const ordered = live ? [...all].reverse() : all;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{live ? 'Relacja na żywo' : 'Przebieg meczu'}</h2>
      {ordered.map((p, i) => (
        <PeriodBlock
          key={p.key}
          period={p}
          score={periodScore(p)}
          // W koszu kwarty są zwinięte (kilkadziesiąt rzutów), otwarta tylko bieżąca na żywo.
          defaultOpen={sport === 'football' || (live && i === 0)}
        >
          <ol className="divide-y">
            {(live ? [...p.events].reverse() : p.events).map((e) => {
              const home = e.team.id === match.homeTeam.id;
              const scoring = isScoring(sport, e.type);
              const minor = e.type === 'foul' || e.type === 'free_throw';
              return (
                <li key={e.id} className="grid grid-cols-[2.75rem_1fr_auto] items-center gap-2 py-2">
                  <span className="text-xs tabular-nums text-muted-foreground">{minuteText(e.minute)}</span>
                  <span className={cn('flex min-w-0 items-center gap-2', !home && 'flex-row-reverse text-right')}>
                    <EventIcon sport={sport} type={e.type} />
                    <span className={cn('min-w-0 break-words hyphens-auto text-sm', scoring && !minor ? 'font-semibold' : minor && 'text-muted-foreground')}>
                      {who(e)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {e.typeLabel}
                        {e.type === 'own_goal' && ` (${e.team.name})`}
                      </span>
                    </span>
                  </span>
                  <span className="w-12 text-right text-sm font-bold tabular-nums">{running.get(e.id) ?? ''}</span>
                </li>
              );
            })}
          </ol>
        </PeriodBlock>
      ))}
    </div>
  );
}

function PeriodBlock({ period, score, defaultOpen, children }: { period: Period; score: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left"
      >
        <span className="text-sm font-semibold">{period.label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">{period.key === 'none' ? '' : score}</span>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          {eventsLabel(period.events.length)}
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && <div className="border-t px-4">{children}</div>}
    </section>
  );
}

function eventsLabel(n: number) {
  const tens = n % 100;
  const ones = n % 10;
  if (n === 1) return '1 zdarzenie';
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return `${n} zdarzenia`;
  return `${n} zdarzeń`;
}

// ============================================================================
// C — Zestawienie per zawodnik
// ============================================================================

export function VariantC({ match, sport }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <BackLink match={match} className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{match.round.name}</span>
      </div>

      {/* Przyklejony wynik: przy długiej osi kosza wynik zostaje na ekranie. */}
      <div className="sticky top-0 z-10 -mx-2 rounded-xl border bg-card/95 px-3 py-3 shadow-sm backdrop-blur sm:mx-0">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamName team={match.homeTeam} align="right" />
          <div className="flex flex-col items-center gap-1">
            <span className="rounded-md bg-foreground px-3 py-1 text-xl font-bold tabular-nums text-background">
              <ScoreText match={match} />
            </span>
            <StatusLabel match={match} />
          </div>
          <TeamName team={match.awayTeam} align="left" />
        </div>
      </div>
      <MatchMeta match={match} className="text-sm text-muted-foreground" />

      {match.status === 'scheduled' ? (
        <NotStarted />
      ) : match.events.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">
          Organizator nie wpisał zdarzeń tego meczu.
        </p>
      ) : (
        <>
          {/* Telefon: zakładki. Od lg: dwie kolumny obok siebie. */}
          <Tabs defaultValue="players" className="lg:hidden">
            <TabsList className="w-full">
              <TabsTrigger value="players">Zawodnicy</TabsTrigger>
              <TabsTrigger value="timeline">Oś meczu</TabsTrigger>
            </TabsList>
            <TabsContent value="players" className="flex flex-col gap-4">
              <BoxScore match={match} sport={sport} home />
              <BoxScore match={match} sport={sport} home={false} />
            </TabsContent>
            <TabsContent value="timeline">
              <CompactTimeline match={match} sport={sport} />
            </TabsContent>
          </Tabs>
          <div className="hidden gap-5 lg:grid lg:grid-cols-[3fr_2fr]">
            <div className="flex flex-col gap-4">
              <BoxScore match={match} sport={sport} home />
              <BoxScore match={match} sport={sport} home={false} />
            </div>
            <Card className="self-start">
              <CardHeader>
                <CardTitle>Oś meczu</CardTitle>
              </CardHeader>
              <CardContent>
                <CompactTimeline match={match} sport={sport} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Zestawienie liczone z `events` (bez nowych pól). API nie zna składu meczu,
 * więc w tabeli są tylko zawodnicy z co najmniej jednym zdarzeniem.
 */
function BoxScore({ match, sport, home }: Props & { home: boolean }) {
  const team = home ? match.homeTeam : match.awayTeam;
  const events = match.events.filter((e) => e.team.id === team.id && e.player);
  const players = new Map<number, { name: string; counts: Record<string, number>; minutes: Record<string, number[]> }>();
  for (const e of events) {
    const p = players.get(e.player!.id) ?? { name: e.player!.name, counts: {}, minutes: {} };
    p.counts[e.type] = (p.counts[e.type] ?? 0) + 1;
    if (e.minute !== null) (p.minutes[e.type] ??= []).push(e.minute);
    players.set(e.player!.id, p);
  }
  const rows = [...players.values()];
  const n = (r: (typeof rows)[number], code: string) => r.counts[code] ?? 0;

  if (sport === 'basketball') {
    const pts = (r: (typeof rows)[number]) => n(r, 'free_throw') + 2 * n(r, 'two_pointer') + 3 * n(r, 'three_pointer');
    rows.sort((a, b) => pts(b) - pts(a));
    const total = (code: string) => rows.reduce((s, r) => s + n(r, code), 0);
    return (
      <Card className="gap-3 py-4">
        <div className="flex items-center gap-2 px-4">
          <TeamLogo logoUrl={team.logoUrl} name={team.name} className="size-6" />
          <span className="min-w-0 break-words hyphens-auto font-semibold">{team.name}</span>
        </div>
        <table className="w-full text-sm tabular-nums">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-1.5 text-left font-medium">Zawodnik</th>
              <th className="w-9 py-1.5 text-right font-medium" title="Rzuty wolne">1</th>
              <th className="w-9 py-1.5 text-right font-medium" title="Rzuty za 2">2</th>
              <th className="w-9 py-1.5 text-right font-medium" title="Rzuty za 3">3</th>
              <th className="w-11 py-1.5 text-right font-medium">Pkt</th>
              <th className="w-12 py-1.5 pr-4 text-right font-medium" title="Faule">F</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-b last:border-0">
                <td className="break-words px-4 py-1.5">{r.name}</td>
                <td className="text-right">{n(r, 'free_throw') || ''}</td>
                <td className="text-right">{n(r, 'two_pointer') || ''}</td>
                <td className="text-right">{n(r, 'three_pointer') || ''}</td>
                <td className="text-right font-bold">{pts(r)}</td>
                <td className="pr-4 text-right text-muted-foreground">{n(r, 'foul') || ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-xs text-muted-foreground">
            <tr className="border-t">
              <td className="px-4 py-1.5 font-medium">Razem</td>
              <td className="text-right">{total('free_throw')}</td>
              <td className="text-right">{total('two_pointer')}</td>
              <td className="text-right">{total('three_pointer')}</td>
              <td className="text-right font-bold text-foreground">{home ? match.homeScore : match.awayScore}</td>
              <td className="pr-4 text-right">{total('foul')}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    );
  }

  rows.sort((a, b) => n(b, 'goal') - n(a, 'goal'));
  return (
    <Card className="gap-3 py-4">
      <div className="flex items-center gap-2 px-4">
        <TeamLogo logoUrl={team.logoUrl} name={team.name} className="size-6" />
        <span className="min-w-0 break-words hyphens-auto font-semibold">{team.name}</span>
      </div>
      <ul className="divide-y text-sm">
        {rows.map((r) => (
          <li key={r.name} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-1.5">
            <span className="min-w-0 break-words hyphens-auto">{r.name}</span>
            <span className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
              {(['goal', 'own_goal', 'yellow_card', 'red_card'] as const).map((code) =>
                n(r, code) > 0 ? (
                  <span key={code} className="flex items-center gap-1" title={EVENT_TYPES.football.find((t) => t.code === code)!.label}>
                    <EventIcon sport={sport} type={code} />
                    {(r.minutes[code] ?? []).map((m) => `${m}′`).join(' ') || (n(r, code) > 1 ? `×${n(r, code)}` : '')}
                  </span>
                ) : null,
              )}
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-1.5 text-muted-foreground">Bez zdarzeń.</li>}
      </ul>
    </Card>
  );
}

/** Oś jednowierszowa: minuta, ikona, zawodnik; strona drużyny przez wyrównanie. */
function CompactTimeline({ match, sport }: Props) {
  return (
    <ol aria-label="Oś meczu" className="grid gap-0.5 text-sm">
      {match.events.map((e) => {
        const home = e.team.id === match.homeTeam.id;
        const cell = (
          <span className={cn('flex min-w-0 items-center gap-1.5', home ? 'flex-row-reverse text-right' : '')}>
            <EventIcon sport={sport} type={e.type} />
            <span className="min-w-0 truncate">{who(e)}</span>
          </span>
        );
        return (
          <li key={e.id} className="grid grid-cols-[1fr_2.5rem_1fr] items-center py-0.5" title={e.typeLabel}>
            {home ? cell : <span />}
            <span className="text-center text-xs tabular-nums text-muted-foreground">{minuteText(e.minute)}</span>
            {home ? <span /> : cell}
          </li>
        );
      })}
    </ol>
  );
}
