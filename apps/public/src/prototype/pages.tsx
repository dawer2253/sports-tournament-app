// PROTOTYP (#205) — strona meczu i listy, z których kibic na nią trafia.
// Listy (Przegląd, Terminarz, Wyniki) są tu tylko po to, żeby sprawdzić
// wejście i powrót; docelowe ekrany niesie #206. Nie do main.
import { Button, LiveMarker, TeamLogo, cn } from '@tournament/ui';
import { PublicShell, type PublicNavKey } from '@tournament/ui/components/layout/public-shell.tsx';
import { ChevronRight, Clock, MapPin, Radio } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { TOURNAMENT, demoMatches, kickoffDate, kickoffTime, useProto, type ProtoMatch } from './demo';
import { PrototypeSwitcher } from './switcher';
import { ScoreText, useSlug } from './shared';
import { useMatchVariant } from './variant';
import { VariantA, VariantB, VariantC } from './variants';

const PATHS: Partial<Record<PublicNavKey, string>> = { home: '', standings: '/tabela', fixtures: '/terminarz', results: '/wyniki' };

function Shell({ active, children }: { active?: PublicNavKey; children: React.ReactNode }) {
  const { sport } = useProto();
  const slug = useSlug();
  const navigate = useNavigate();
  const t = TOURNAMENT[sport];
  return (
    <PublicShell
      active={active}
      tournamentOverride={{ ...t, slug }}
      navHref={(key) => `/t/${slug}${PATHS[key] ?? ''}`}
      onNavigate={(key) => void navigate(`/t/${slug}${PATHS[key] ?? ''}`)}
    >
      {children}
    </PublicShell>
  );
}

// --- Strona meczu -----------------------------------------------------------

export function ProtoMatchPage() {
  const { sport, longNames } = useProto();
  const variant = useMatchVariant();
  const id = Number(useParams().matchId);
  const matches = demoMatches(sport, longNames);
  const match = matches.find((m) => m.id === id);

  return (
    <Shell>
      {match ? (
        <>
          {variant === 'A' && <VariantA match={match} sport={sport} />}
          {variant === 'B' && <VariantB match={match} sport={sport} />}
          {variant === 'C' && <VariantC match={match} sport={sport} />}
        </>
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nie ma takiego meczu w tym turnieju (sport przełączony w panelu? wybierz mecz z listy w panelu).
        </p>
      )}
      <PrototypeSwitcher match={match ?? null} matches={matches} />
    </Shell>
  );
}

// --- Listy ------------------------------------------------------------------

/**
 * Wiersz meczu na stałej siatce. Tryb „cały wiersz” robi z niego jeden
 * `<a href>`; tryb „osobny element” zostawia wiersz zwykłym i dokłada link
 * w ostatniej kolumnie.
 */
function MatchListRow({ match }: { match: ProtoMatch }) {
  const { entry } = useProto();
  const slug = useSlug();
  const navigate = useNavigate();
  const href = `/t/${slug}/mecze/${match.id}`;
  const go = (e: React.MouseEvent) => {
    e.preventDefault();
    void navigate(href);
  };
  const live = match.status === 'live';

  const body = (
    <div className="grid grid-cols-[1fr_4.5rem_1fr_1.5rem] items-center gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[8.5rem_1fr_5rem_1fr_6.5rem]">
      <span className="col-span-4 flex items-center gap-3 text-xs text-muted-foreground sm:col-span-1 sm:flex-col sm:items-start sm:gap-0.5">
        <span className="flex items-center gap-1.5">
          <Clock className="size-3.5 shrink-0" />
          <span className="tabular-nums">{kickoffTime(match.kickoffAt)}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{match.venue?.name ?? 'Obiekt nieustalony'}</span>
        </span>
      </span>
      <span className="flex min-w-0 items-center justify-end gap-2 text-right text-sm font-medium sm:text-base">
        <span className="min-w-0 break-words hyphens-auto">{match.homeTeam.name}</span>
        <TeamLogo logoUrl={null} name={match.homeTeam.name} className="hidden size-6 sm:grid" />
      </span>
      <span
        className={cn(
          'justify-self-center rounded-md px-2.5 py-1 text-sm font-bold tabular-nums',
          match.status === 'scheduled' ? 'border border-dashed font-medium text-muted-foreground/70' : 'bg-foreground text-background',
        )}
      >
        <ScoreText match={match} />
      </span>
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium sm:text-base">
        <TeamLogo logoUrl={null} name={match.awayTeam.name} className="hidden size-6 sm:grid" />
        <span className="min-w-0 break-words hyphens-auto">{match.awayTeam.name}</span>
      </span>
      <span className="flex items-center justify-end gap-2">
        {live && <LiveMarker className="hidden sm:flex" />}
        {entry === 'row' ? (
          <ChevronRight className="size-4 text-muted-foreground" />
        ) : (
          <a href={href} onClick={go} className="hidden whitespace-nowrap text-sm font-medium text-primary hover:underline sm:inline">
            {live ? 'Relacja' : 'Szczegóły'}
          </a>
        )}
      </span>
      {live && <LiveMarker className="col-span-4 justify-center sm:hidden" />}
      {entry === 'button' && (
        <a href={href} onClick={go} className="col-span-4 text-center text-sm font-medium text-primary hover:underline sm:hidden">
          {live ? 'Relacja na żywo' : 'Szczegóły meczu'}
        </a>
      )}
    </div>
  );

  if (entry === 'row') {
    return (
      <li>
        <a href={href} onClick={go} className="block transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring">
          {body}
        </a>
      </li>
    );
  }
  return <li>{body}</li>;
}

function MatchList({ matches }: { matches: ProtoMatch[] }) {
  const groups: { label: string; matches: ProtoMatch[] }[] = [];
  for (const m of matches) {
    const label = `${m.round.name}, ${kickoffDate(m.kickoffAt)}`;
    const g = groups.find((x) => x.label === label);
    if (g) g.matches.push(m);
    else groups.push({ label, matches: [m] });
  }
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.label}>
          <h2 className="mb-2 text-sm text-muted-foreground">{g.label}</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {g.matches.map((m) => (
              <MatchListRow key={m.id} match={m} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ProtoFixtures() {
  const { sport, longNames } = useProto();
  const matches = demoMatches(sport, longNames);
  return (
    <Shell active="fixtures">
      <MatchList matches={matches} />
      <PrototypeSwitcher match={null} matches={matches} />
    </Shell>
  );
}

export function ProtoResults() {
  const { sport, longNames } = useProto();
  const matches = demoMatches(sport, longNames);
  return (
    <Shell active="results">
      <MatchList matches={matches.filter((m) => m.status !== 'scheduled').reverse()} />
      <PrototypeSwitcher match={null} matches={matches} />
    </Shell>
  );
}

export function ProtoHome() {
  const { sport, longNames } = useProto();
  const slug = useSlug();
  const navigate = useNavigate();
  const matches = demoMatches(sport, longNames);
  const live = matches.find((m) => m.status === 'live');
  return (
    <Shell active="home">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        {live && (
          <div className="rounded-lg border border-primary/25 bg-primary/5 p-4">
            <div className="mb-3 flex items-center justify-between">
              <LiveMarker />
              <span className="text-xs text-muted-foreground">{live.round.name}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
              <span className="text-right font-semibold">{live.homeTeam.name}</span>
              <span className="rounded-md bg-background px-3 py-1.5 text-2xl font-extrabold tabular-nums shadow-sm">
                <ScoreText match={live} />
              </span>
              <span className="font-semibold">{live.awayTeam.name}</span>
            </div>
            <Button size="sm" className="mt-3 w-full" asChild>
              <a
                href={`/t/${slug}/mecze/${live.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  void navigate(`/t/${slug}/mecze/${live.id}`);
                }}
              >
                <Radio className="size-4" />
                Śledź na żywo
              </a>
            </Button>
          </div>
        )}
        <MatchList matches={matches.filter((m) => m.status !== 'live')} />
      </div>
      <PrototypeSwitcher match={null} matches={matches} />
    </Shell>
  );
}

export function ProtoStandings() {
  const { sport, longNames } = useProto();
  return (
    <Shell active="standings">
      <p className="py-16 text-center text-sm text-muted-foreground">Tabela jest poza prototypem strony meczu.</p>
      <PrototypeSwitcher match={null} matches={demoMatches(sport, longNames)} />
    </Shell>
  );
}
