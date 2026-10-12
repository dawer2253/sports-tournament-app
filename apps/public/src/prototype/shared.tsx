// PROTOTYP (#205) — klocki wspólne dla wariantów strony meczu. Nie do main.
// Wspólne jest tylko to, co nie przesądza układu: wynik, link powrotu,
// kolumny strzelców i ikony zdarzeń. Każdy wariant sam składa stronę.
import { LiveMarker, MetaList, cn } from '@tournament/ui';
import { CalendarClock, ChevronLeft, MapPin } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { kickoffDate, kickoffTime, useProto, type MatchEvent, type ProtoMatch, type Sport } from './demo';

export function useSlug() {
  return useParams().slug ?? 'liga-osiedlowa-2026';
}

/** „Zakończony” / „Na żywo” / „Zaplanowany” — jeden zapis stanu. */
export function StatusLabel({ match, className, onDark }: { match: ProtoMatch; className?: string; onDark?: boolean }) {
  if (match.status === 'live') return <LiveMarker className={cn(onDark && 'text-white [&>span]:bg-white', className)} />;
  return (
    <span className={cn('text-xs font-medium', onDark ? 'text-brand-foreground/85' : 'text-muted-foreground', className)}>
      {match.status === 'finished' ? 'Zakończony' : 'Zaplanowany'}
    </span>
  );
}

export function ScoreText({ match }: { match: ProtoMatch }) {
  if (match.status === 'scheduled') return <>– : –</>;
  return (
    <>
      {match.homeScore}
      <span className="mx-1.5 opacity-60">:</span>
      {match.awayScore}
    </>
  );
}

/** Termin i obiekt jako osobne fakty, rozdzielone kreską `MetaList`, bez kropek. */
export function MetaFacts({ match, className, withRound }: { match: ProtoMatch; className?: string; withRound?: boolean }) {
  return (
    // Telefon: fakty jeden pod drugim, bez kresek — zawinięty wiersz zostawiał kreskę na końcu linii.
    <MetaList className={cn('justify-center gap-y-1 max-sm:flex-col max-sm:[&>[data-slot=separator]]:hidden', className)}>
      {withRound && <span className="font-medium">{match.round.name}</span>}
      <span className="flex items-center gap-1.5">
        <CalendarClock className="size-3.5 shrink-0" />
        {kickoffDate(match.kickoffAt)}, {kickoffTime(match.kickoffAt)}
      </span>
      {match.venue && (
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" />
          {match.venue.name}
        </span>
      )}
    </MetaList>
  );
}

/**
 * Powrót: według stanu meczu („Terminarz” przed meczem, „Wyniki” w trakcie
 * i po) albo historią przeglądarki z rezerwą na Wyniki, gdy kibic wszedł
 * z zewnętrznego linku. Tryb przełącza panel stanu.
 */
export function BackLink({ match, className, long }: { match: ProtoMatch; className?: string; long?: boolean }) {
  const { back } = useProto();
  const slug = useSlug();
  const navigate = useNavigate();
  const location = useLocation();
  const byState = match.status === 'scheduled'
    ? { href: `/t/${slug}/terminarz`, label: long ? 'Cały terminarz' : 'Terminarz' }
    : { href: `/t/${slug}/wyniki`, label: long ? 'Wszystkie wyniki' : 'Wyniki' };
  const firstPage = location.key === 'default';
  const target = back === 'history' && !firstPage ? { href: byState.href, label: 'Wróć' } : byState;

  return (
    <a
      href={target.href}
      onClick={(e) => {
        e.preventDefault();
        if (back === 'history' && !firstPage) void navigate(-1);
        else void navigate(target.href);
      }}
      className={cn('inline-flex items-center gap-1 text-sm font-medium hover:underline', className)}
    >
      <ChevronLeft className="size-4" />
      {target.label}
    </a>
  );
}

// --- Ikony zdarzeń ----------------------------------------------------------

export function EventIcon({ sport, type, className }: { sport: Sport; type: string; className?: string }) {
  const box = 'inline-grid shrink-0 place-items-center';
  if (type === 'yellow_card') return <span aria-hidden className={cn(box, 'h-3.5 w-2.5 rounded-[2px] bg-yellow-400', className)} />;
  if (type === 'red_card') return <span aria-hidden className={cn(box, 'h-3.5 w-2.5 rounded-[2px] bg-red-600', className)} />;
  if (type === 'goal') return <span aria-hidden className={cn(box, 'text-sm', className)}>⚽</span>;
  // Samobój: ta sama piłka w czerwonym kółku, żeby nie mylił się z bramką.
  if (type === 'own_goal') return <span aria-hidden className={cn(box, 'size-5 rounded-full text-xs ring-2 ring-destructive', className)}>⚽</span>;
  if (type === 'foul') return <span aria-hidden className={cn(box, 'size-5 rounded-full border text-[10px] font-semibold text-muted-foreground', className)}>F</span>;
  const pts = type === 'free_throw' ? 1 : type === 'two_pointer' ? 2 : 3;
  void sport;
  return (
    <span aria-hidden className={cn(box, 'size-5 rounded-full bg-foreground text-[10px] font-bold text-background', className)}>
      +{pts}
    </span>
  );
}

/** Kto: zawodnik, a gdy go nie ma — drużyna. */
export function who(e: MatchEvent) {
  return e.player?.name ?? e.team.name;
}

export function minuteText(m: number | null) {
  return m === null ? '—' : `${m}′`;
}

export function NotStarted() {
  return (
    <div className="rounded-xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
      Mecz jeszcze się nie zaczął.
    </div>
  );
}
