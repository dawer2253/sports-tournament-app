// PROTOTYP (#205), runda 2 — trzy odmiany wariantu B z rundy 1. Nie do main.
//
// Wspólne: pas z drużynami i wynikiem na górze, pod nim relacja podzielona na
// połowy/kwarty (w koszu zwinięte), na żywo najnowsze u góry. Różnią się tym,
// jak dane meczu (strzelcy, kolejka, termin, obiekt) dostają kontrast i gdzie
// stoi powrót do listy:
//
// B1: zdjęcie zostaje, ale pod tekstem ciemny gradient, dane białe 100%
//     i większe. Powrót nad pasem, poza nim.
// B2: na zdjęciu tylko drużyny i wynik; strzelcy i fakty meczu w jasnym
//     pasku doklejonym pod pasem, zwykłym kolorem tekstu. Powrót pod relacją.
// B3: pas płaski w kolorze turnieju, bez zdjęcia. Powrót w pasku
//     przyklejonym do góry ekranu, który po przewinięciu pasa dostaje wynik.
import { LiveMarker, TeamLogo, cn, teamAbbr } from '@tournament/ui';
import { PhotoPanel } from '@tournament/ui/components/layout/photo-panel.tsx';
import fieldImg from '@tournament/ui/assets/public/field.webp';
import { CalendarClock, ChevronDown, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isScoring, kickoffDate, kickoffTime, valueOf, type MatchEvent, type ProtoMatch, type Scorer, type Sport } from './demo';
import { BackLink, EventIcon, MetaFacts, NotStarted, ScoreText, StatusLabel, minuteText, who } from './shared';

type Props = { match: ProtoMatch; sport: Sport };

function Body({ match, sport }: Props) {
  if (match.status === 'scheduled') return <NotStarted />;
  if (match.events.length === 0)
    return (
      <p className="rounded-xl border bg-card px-4 py-8 text-center text-sm text-muted-foreground shadow-sm">
        Organizator nie wpisał zdarzeń tego meczu.
      </p>
    );
  return <Relation match={match} sport={sport} />;
}

/** Strzelcy jak w #208: samobój po stronie przeciwnika, w koszu suma i trzech najlepszych. */
function scorerSides(match: ProtoMatch) {
  const sumFormat = match.scorers.some((s) => s.minutes.length !== s.value);
  const side = (home: boolean) => {
    const rows = match.scorers.filter((s) => ((s.team.id === match.homeTeam.id) !== s.ownGoal) === home);
    return sumFormat ? [...rows].sort((a, b) => b.value - a.value).slice(0, 3) : rows;
  };
  return { home: side(true), away: side(false) };
}

function scorerDetail(s: Scorer) {
  return s.minutes.length === s.value ? s.minutes.map((m) => `${m}′`).join(' ') : String(s.value);
}

/** Dwie kolumny strzelców na tej samej siatce co drużyny, żeby stały pod nimi. */
function ScorerGrid({ match, className, detailClass }: { match: ProtoMatch; className?: string; detailClass?: string }) {
  const sides = scorerSides(match);
  return (
    // Telefon: dwie połówki na pełną szerokość (środkowa kolumna wyniku tylko by zabierała miejsce).
    <div className={cn('grid grid-cols-2 gap-x-4 text-xs sm:grid-cols-[1fr_9rem_1fr] sm:gap-x-6 sm:text-sm', className)}>
      {[sides.home, sides.away].map((rows, i) => (
        <ul key={i} className={cn('space-y-1', i === 0 ? 'col-start-1 text-right' : 'col-start-2 text-left sm:col-start-3')}>
          {rows.map((s) => (
            <li key={`${s.player.id}-${s.ownGoal}`} className="break-words hyphens-auto">
              {s.player.name}
              {s.ownGoal && ' (sam.)'} <span className={cn('whitespace-nowrap tabular-nums', detailClass)}>{scorerDetail(s)}</span>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

function BandTeam({ team, ring }: { team: ProtoMatch['homeTeam']; ring?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <TeamLogo
        logoUrl={team.logoUrl}
        name={team.name}
        className={cn('size-12 rounded-full p-1 sm:size-16', ring !== false && 'bg-white/15 ring-1 ring-white/30')}
      />
      <span className="break-words hyphens-auto text-sm font-bold leading-tight sm:text-lg">{team.name}</span>
    </div>
  );
}

/** Drużyny i wynik na stałej siatce: wynik zawsze pośrodku (#162). */
function TeamsAndScore({ match, below }: { match: ProtoMatch; below?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_5rem_1fr] items-start gap-3 sm:grid-cols-[1fr_9rem_1fr] sm:gap-6">
      <BandTeam team={match.homeTeam} />
      <div className="flex flex-col items-center pt-2 text-center">
        <div className="whitespace-nowrap text-4xl font-extrabold tabular-nums sm:text-6xl">
          <ScoreText match={match} />
        </div>
        {below}
      </div>
      <BandTeam team={match.awayTeam} />
    </div>
  );
}

// ============================================================================
// B1 — ciemniejszy pas, powrót nad pasem
// ============================================================================

export function VariantB1({ match, sport }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <BackLink match={match} className="self-start text-muted-foreground hover:text-foreground" />
      <PhotoPanel src={fieldImg} overlay="strong" className="rounded-xl px-4 pb-5 pt-4 text-white sm:px-8">
        {/* Ciemny gradient pod tekstem: zieleń zostaje u góry, a dolna połowa,
            gdzie stoją strzelcy i fakty, ma kontrast jak na planszy TV. */}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-black/10 via-black/35 to-black/65" />
        <div className="mb-3 flex items-center justify-between gap-2 text-sm font-medium">
          <span>{match.round.name}</span>
          <StatusLabel match={match} onDark className="text-sm text-white" />
        </div>
        <div className="[text-shadow:0_1px_2px_rgb(0_0_0/0.5)]">
          <TeamsAndScore match={match} />
          {match.scorers.length > 0 && (
            <ScorerGrid match={match} className="mt-4 text-white" detailClass="font-semibold" />
          )}
          <MetaFacts match={match} className="mt-5 border-t border-white/25 pt-3 text-sm text-white" />
        </div>
      </PhotoPanel>
      <div className="mx-auto mt-2 w-full max-w-3xl">
        <Body match={match} sport={sport} />
      </div>
    </div>
  );
}

// ============================================================================
// B2 — dane pod pasem, powrót pod relacją
// ============================================================================

export function VariantB2({ match, sport }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-xl border shadow-sm">
        <PhotoPanel src={fieldImg} overlay="strong" className="px-4 pb-5 pt-4 text-white sm:px-8">
          <div className="mb-2 flex justify-center">
            <StatusLabel match={match} onDark className="text-sm text-white" />
          </div>
          <div className="[text-shadow:0_1px_2px_rgb(0_0_0/0.4)]">
            <TeamsAndScore match={match} />
          </div>
        </PhotoPanel>
        {/* Dane meczu poza zdjęciem: zwykły tekst na karcie, pełny kontrast. */}
        <div className="bg-card px-4 py-4 sm:px-8">
          {match.scorers.length > 0 && (
            <ScorerGrid match={match} className="mb-4" detailClass="text-muted-foreground" />
          )}
          <MetaFacts match={match} withRound className="text-sm text-muted-foreground" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <Body match={match} sport={sport} />
        <div className="mt-6 flex justify-center">
          <BackLink match={match} long className="text-primary" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// B3 — płaski pas, powrót w przyklejonym pasku
// ============================================================================

export function VariantB3({ match, sport }: Props) {
  const band = useRef<HTMLDivElement>(null);
  const [bandHidden, setBandHidden] = useState(false);
  useEffect(() => {
    const el = band.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setBandHidden(!entry.isIntersecting), { rootMargin: '-48px 0px 0px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {/* Pasek powrotu przykleja się do góry; po przewinięciu pasa pokazuje wynik. */}
      <div className="sticky top-0 z-20 -mx-6 flex h-12 items-center gap-3 border-b bg-background/95 px-6 backdrop-blur sm:mx-0 sm:rounded-b-lg sm:border-x">
        <BackLink match={match} className="shrink-0 text-foreground" />
        <div
          className={cn(
            'ml-auto flex items-center gap-2 text-sm font-semibold transition-opacity',
            bandHidden ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          aria-hidden={!bandHidden}
        >
          {match.status === 'live' && <LiveMarker />}
          <span>{teamAbbr(match.homeTeam.name)}</span>
          <span className="rounded bg-foreground px-2 py-0.5 tabular-nums text-background">
            <ScoreText match={match} />
          </span>
          <span>{teamAbbr(match.awayTeam.name)}</span>
        </div>
      </div>

      <div ref={band} className="rounded-xl bg-brand px-4 pb-5 pt-4 text-brand-foreground shadow-sm sm:px-8">
        <div className="mb-3 flex justify-center">
          <StatusLabel match={match} onDark className="text-sm text-brand-foreground" />
        </div>
        <TeamsAndScore match={match} />
        {match.scorers.length > 0 && <ScorerGrid match={match} className="mt-4" detailClass="font-semibold" />}
        {/* Fakty jako jasne „żetony” na płaskim kolorze: każdy osobno, bez separatora. */}
        <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm">
          <Chip>{match.round.name}</Chip>
          <Chip>
            <CalendarClock className="size-3.5" />
            {kickoffDate(match.kickoffAt)}, {kickoffTime(match.kickoffAt)}
          </Chip>
          {match.venue && (
            <Chip>
              <MapPin className="size-3.5" />
              {match.venue.name}
            </Chip>
          )}
        </div>
      </div>
      <div className="mx-auto mt-2 w-full max-w-3xl">
        <Body match={match} sport={sport} />
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 font-medium">{children}</span>;
}

// ============================================================================
// Relacja — wspólna dla B1–B3, bez zmian względem B z rundy 1
// ============================================================================

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
