// PROTOTYP (#218) — zakładki pucharu na /t/puchar-demo: Przegląd bez tabeli,
// Drabinka z wariantami, Terminarz i Wyniki po rundach, zaślepka strony
// meczu. Dane żyją w pamięci (`demo.ts`), mock nie jest potrzebny. Nie do main.
import {
  BracketChampion,
  Button,
  EmptyState,
  PublicOverview,
  PublicSection,
  RoundSections,
  groupByRound,
  cn,
  type MatchInRound,
} from '@tournament/ui';
import { ArrowLeft, Check, ChevronRight, GitFork } from 'lucide-react';
import { useParams, useNavigate } from 'react-router';
import { findMatch, kickoffParts, teamsAlive, useBracket, winnerSide, type ProtoBracket, type ProtoMatch } from './demo';
import { LiveDot, MatchTile, ProtoShell, matchPath, tabPath } from './shared';
import { PrototypeSwitcher } from './switcher';
import { useBracketVariant } from './variant';
import { VariantA } from './variant-a';
import { VariantB } from './variant-b';
import { VariantC } from './variant-c';

function inRound(match: ProtoMatch): MatchInRound {
  return {
    id: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    homePenalties: match.homePenalties,
    awayPenalties: match.awayPenalties,
    positionLabel: match.label,
    homeSource: match.homeSource,
    awaySource: match.awaySource,
    status: match.status,
    kickoffAt: match.kickoffAt,
    venue: match.venue,
    stageId: 1,
    round: match.round,
  };
}

/** Kolejność w rundzie: po terminie, czyli mecz o 3. miejsce przed finałem. */
function byKickoff(matches: ProtoMatch[]): ProtoMatch[] {
  return matches.toSorted((a, b) => a.kickoffAt.localeCompare(b.kickoffAt) || a.matchNumber - b.matchNumber);
}

// --- Drabinka ------------------------------------------------------------------

export function ProtoBracketPage() {
  const bracket = useBracket();
  const variant = useBracketVariant();
  return (
    <ProtoShell active="bracket">
      {variant === 'A' && <VariantA bracket={bracket} />}
      {variant === 'B' && <VariantB bracket={bracket} />}
      {variant === 'C' && <VariantC bracket={bracket} />}
      <PrototypeSwitcher />
    </ProtoShell>
  );
}

// --- Przegląd ------------------------------------------------------------------

/** Zamiast skrótu tabeli: rundy z postępem, liczba drużyn w grze i mistrz. */
function BracketSummary({ bracket }: { bracket: ProtoBracket }) {
  const navigate = useNavigate();
  const final = bracket.rounds[bracket.rounds.length - 1].matches[0];
  return (
    <PublicSection
      title="Drabinka"
      icon={<GitFork />}
      action={
        <Button asChild variant="link" size="sm" className="px-0">
          <a
            href={tabPath('bracket')}
            onClick={(e) => {
              e.preventDefault();
              void navigate(tabPath('bracket'));
            }}
          >
            Zobacz drabinkę
            <ChevronRight />
          </a>
        </Button>
      }
    >
      {bracket.champion ? (
        <>
          <BracketChampion team={bracket.champion} />
          <MatchTile match={final} />
        </>
      ) : (
        <p className="text-sm">
          W grze <span className="font-semibold tabular-nums">{teamsAlive(bracket)}</span> z {bracket.teams.length} drużyn.
        </p>
      )}
      <ol className="space-y-1.5">
        {bracket.rounds.map((round) => {
          const current = round.order === bracket.currentOrder && !bracket.champion;
          const done = round.finished === round.total;
          const live = [...round.matches, ...(round.third ? [round.third] : [])].some((m) => m.status === 'live');
          return (
            <li key={round.id} className={cn('grid grid-cols-[7.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm', !current && 'text-muted-foreground')}>
              <span className={cn('flex items-center gap-1.5 truncate', current && 'font-semibold text-foreground')}>
                {round.name}
                {live && <LiveDot />}
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                <span className={cn('block h-full rounded-full', done ? 'bg-foreground/40' : 'bg-primary')} style={{ width: `${(round.finished / round.total) * 100}%` }} />
              </span>
              <span className="flex items-center justify-end gap-1 text-xs tabular-nums">
                {done && <Check className="size-3" />}
                {round.finished}/{round.total}
              </span>
            </li>
          );
        })}
      </ol>
    </PublicSection>
  );
}

export function ProtoOverview() {
  const bracket = useBracket();
  const navigate = useNavigate();
  const open = bracket.matches.filter((m) => m.status !== 'finished');
  const done = bracket.matches.filter((m) => m.status === 'finished');
  return (
    <ProtoShell active="home">
      <PublicOverview
        fixtures={groupByRound(byKickoff(open).map(inRound))}
        results={groupByRound(byKickoff(done).toReversed().map(inRound), { direction: 'desc' })}
        status={{ standings: <BracketSummary bracket={bracket} /> }}
        linkHref={(key) => tabPath(key)}
        onNavigate={(key) => void navigate(tabPath(key))}
        matchHref={(match) => matchPath(match.id)}
        onMatchNavigate={(match) => void navigate(matchPath(match.id))}
      />
      <PrototypeSwitcher />
    </ProtoShell>
  );
}

// --- Terminarz i Wyniki --------------------------------------------------------

function MatchList({ matches, direction, empty }: { matches: ProtoMatch[]; direction: 'asc' | 'desc'; empty: string }) {
  const navigate = useNavigate();
  const ordered = direction === 'asc' ? byKickoff(matches) : byKickoff(matches).toReversed();
  const rounds = groupByRound(ordered.map(inRound), { direction });
  if (rounds.length === 0) return <EmptyState title={empty} />;
  return (
    <RoundSections
      rounds={rounds}
      statusDisplay="live"
      matchHref={(match) => matchPath(match.id)}
      onMatchNavigate={(match) => void navigate(matchPath(match.id))}
    />
  );
}

export function ProtoFixtures() {
  const bracket = useBracket();
  return (
    <ProtoShell active="fixtures">
      <MatchList matches={bracket.matches.filter((m) => m.status !== 'finished')} direction="asc" empty="Brak zaplanowanych meczów" />
      <PrototypeSwitcher />
    </ProtoShell>
  );
}

export function ProtoResults() {
  const bracket = useBracket();
  return (
    <ProtoShell active="results">
      <MatchList matches={bracket.matches.filter((m) => m.status === 'finished')} direction="desc" empty="Brak rozegranych meczów" />
      <PrototypeSwitcher />
    </ProtoShell>
  );
}

export function ProtoStats() {
  return (
    <ProtoShell active="stats">
      <EmptyState title="Statystyki jak w lidze" description="Poza zakresem prototypu #218." />
      <PrototypeSwitcher />
    </ProtoShell>
  );
}

// --- Strona meczu (zaślepka) ---------------------------------------------------

export function ProtoMatchPage() {
  const bracket = useBracket();
  const navigate = useNavigate();
  const match = findMatch(bracket, Number(useParams().matchId));
  const winner = match ? winnerSide(match) : null;
  return (
    <ProtoShell>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => void navigate(-1)}>
          <ArrowLeft />
          Wróć
        </Button>
        {match ? (
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              {match.label}, {kickoffParts(match.kickoffAt).weekday} {kickoffParts(match.kickoffAt).day}, {kickoffParts(match.kickoffAt).time}
            </p>
            <MatchTile match={match} />
            {winner && match.homePenalties !== null && <p className="text-sm">Rozstrzygnięcie po rzutach karnych.</p>}
            <p className="text-xs text-muted-foreground">
              Zaślepka. Docelowo strona meczu z #205 i #210, z karnymi przy wyniku.
            </p>
          </div>
        ) : (
          <EmptyState title="Nie ma takiego meczu" description="Drabinka zmieniła się w panelu stanu." />
        )}
      </div>
      <PrototypeSwitcher />
    </ProtoShell>
  );
}
