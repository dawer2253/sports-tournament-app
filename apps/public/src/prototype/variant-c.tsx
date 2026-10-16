// PROTOTYP (#252) — wariant C: „Jedna zakładka Rozgrywki”. Nie do main.
//
// Zamiast Tabeli i Drabinki jedna zakładka z przełącznikiem części: Faza
// grupowa (siatka kart grup ze skróconą tabelą) i Playoff (drzewo albo „na
// dziś wychodzą”). Drużyny, które grają w drabince, mają w tabelach plakietkę,
// więc rozjazd drabinki z tabelą widać bez osobnego komunikatu. Terminarz
// i Wyniki dzielą kolejkę na podsekcje grup. Przegląd: przebieg turnieju
// jako oś faz i rund.
import { BracketSummary, BracketTree, EmptyState, Heading, PublicSection, cn, groupByRound, type PublicNavKey } from '@tournament/ui';
import { CalendarDays, Check, GitFork, Route } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { phase, type Demo, type DemoMatch } from './demo';
import {
  GroupBadge,
  GroupTable,
  Pills,
  ProtoLink,
  Row,
  aboveLine,
  finishedMatches,
  matchPath,
  openMatches,
  stageOrder,
  tabPath,
} from './shared';
import { Overview, type VariantPages } from './variant-pages';

const TABS: readonly PublicNavKey[] = ['home', 'standings', 'fixtures', 'results', 'stats'];

type Part = 'grupy' | 'playoff';

function Competition({ demo, forced }: { demo: Demo; forced?: Part }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const raw = params.get('czesc');
  const part: Part = raw === 'grupy' || raw === 'playoff' ? raw : (forced ?? (demo.knockout.length > 0 ? 'playoff' : 'grupy'));
  const inBracket = new Set(demo.knockout.flatMap((match) => [match.homeTeam?.id, match.awayTeam?.id]).filter((id): id is number => id != null));
  return (
    <div className="space-y-5">
      <Pills<Part>
        label="Część turnieju"
        items={[
          { key: 'grupy', label: 'Faza grupowa' },
          { key: 'playoff', label: demo.knockout.length > 0 ? 'Playoff' : 'Playoff (wkrótce)' },
        ]}
        value={part}
        onChange={(next) =>
          setParams(
            (current) => {
              const copy = new URLSearchParams(current);
              copy.set('czesc', next);
              return copy;
            },
            { replace: true },
          )
        }
      />
      {part === 'grupy' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {demo.groups.map((group) => (
            <GroupTable
              key={group.id}
              demo={demo}
              group={group}
              compact
              marked={inBracket}
              title={
                <div className="flex items-center justify-between gap-2">
                  <GroupBadge name={group.name} />
                  <span className="text-xs text-muted-foreground">
                    wychodzi {group.qualifiers} z {group.teamIds.length}
                  </span>
                </div>
              }
            />
          ))}
        </div>
      ) : demo.knockout.length > 0 ? (
        <BracketTree
          matches={demo.knockout}
          penaltySlot={demo.allowsDraw}
          matchHref={(match) => matchPath(match.id)}
          onMatchNavigate={(match) => void navigate(matchPath(match.id))}
        />
      ) : (
        <Qualifiers demo={demo} />
      )}
    </div>
  );
}

/** Playoff przed drabinką: kto na dziś wychodzi z każdej grupy. Bez par — pary układa organizer (#250). */
function Qualifiers({ demo }: { demo: Demo }) {
  return (
    <div className="space-y-3">
      <EmptyState
        icon={<GitFork />}
        title="Drabinka powstanie po fazie grupowej"
        description="Pary ułoży organizator z drużyn, które wyjdą z grup. Na dziś nad linią stoją:"
      />
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {demo.groups.map((group) => (
          <div key={group.id} className="rounded-xl border bg-card p-3">
            <GroupBadge name={group.name} />
            <ol className="mt-2 space-y-1 text-sm">
              {aboveLine(demo, group).map((row) => (
                <li key={row.team.id} className="flex gap-2">
                  <span className="w-4 text-right font-semibold text-muted-foreground tabular-nums">{row.position}.</span>
                  <span className="truncate">{row.team.name}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Kolejka z podsekcjami grup; runda playoffu bez podziału. */
function SplitRounds({ demo, matches, direction, empty }: { demo: Demo; matches: DemoMatch[]; direction: 'asc' | 'desc'; empty: string }) {
  const rounds = groupByRound(matches, { direction, stageOrder });
  if (rounds.length === 0) return <EmptyState icon={<CalendarDays />} title={empty} />;
  return (
    <div className="space-y-6">
      {rounds.map((round) => {
        const playoff = round.matches[0]!.groupId === null;
        const byGroup = demo.groups
          .map((group) => ({ group, matches: round.matches.filter((match) => match.groupId === group.id) }))
          .filter((entry) => entry.matches.length > 0);
        return (
          <section key={round.summary.id} className="space-y-2">
            <div className="flex items-baseline gap-2 border-b pb-1">
              <Heading level="card">{round.summary.name}</Heading>
              <span className="text-sm text-muted-foreground">{round.summary.dates}</span>
            </div>
            {playoff
              ? round.matches.map((match) => <Row key={match.id} demo={demo} match={match} />)
              : byGroup.map(({ group, matches: groupMatches }) => (
                  <div key={group.id} className="space-y-1.5 pl-2 sm:pl-0">
                    <p className="pt-1 text-xs font-semibold text-muted-foreground">{group.name}</p>
                    {groupMatches.map((match) => (
                      <Row key={match.id} demo={demo} match={match} />
                    ))}
                  </div>
                ))}
          </section>
        );
      })}
    </div>
  );
}

/** Przebieg turnieju: oś od fazy grupowej przez rundy playoffu do mistrza. */
function Timeline({ demo }: { demo: Demo }) {
  const navigate = useNavigate();
  const now = phase(demo);
  const groupDone = demo.groupMatches.filter((m) => m.status === 'finished').length;
  const rounds = [...new Map(demo.knockout.map((m) => [m.round.order, m.round])).values()].toSorted((a, b) => a.order - b.order);
  const currentKo = Math.min(...demo.knockout.filter((m) => m.status !== 'finished').map((m) => m.round.order));
  const steps: { name: string; detail: string; state: 'done' | 'current' | 'next' }[] = [
    {
      name: 'Faza grupowa',
      detail: `${demo.groups.length} ${demo.groups.length === 1 ? 'grupa' : demo.groups.length < 5 ? 'grupy' : 'grup'}, ${groupDone}/${demo.groupMatches.length} meczów`,
      state: demo.groupsFinished ? 'done' : 'current',
    },
    ...(rounds.length > 0
      ? rounds.map((round) => {
          const matches = demo.knockout.filter((m) => m.round.order === round.order);
          const done = matches.filter((m) => m.status === 'finished').length;
          const state: 'done' | 'current' | 'next' =
            done === matches.length ? 'done' : demo.groupsFinished && round.order === currentKo ? 'current' : 'next';
          return { name: round.name, detail: `${done}/${matches.length}`, state };
        })
      : [{ name: 'Playoff', detail: 'drabinka po fazie grupowej', state: 'next' as const }]),
  ];
  return (
    <PublicSection
      title="Przebieg turnieju"
      icon={<Route />}
      action={<ProtoLink to={tabPath('standings')} className="text-sm font-medium underline-offset-4 hover:underline">Rozgrywki ›</ProtoLink>}
    >
      <ol className="relative space-y-3 border-l pl-4">
        {steps.map((step) => (
          <li key={step.name} className="relative">
            <span
              className={cn(
                'absolute top-1 -left-[1.3rem] flex size-3 items-center justify-center rounded-full border-2 bg-card',
                step.state === 'done' && 'border-primary bg-primary',
                step.state === 'current' && 'border-primary',
              )}
            >
              {step.state === 'done' && <Check className="size-2 text-primary-foreground" />}
            </span>
            <p className={cn('text-sm', step.state === 'current' ? 'font-semibold' : step.state === 'next' && 'text-muted-foreground')}>
              {step.name}
              <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">{step.detail}</span>
            </p>
          </li>
        ))}
      </ol>
      {now !== 'groups' && (
        <BracketSummary
          matches={demo.knockout}
          penaltySlot={demo.allowsDraw}
          matchHref={(match) => matchPath(match.id)}
          onMatchNavigate={(match) => void navigate(matchPath(match.id))}
        />
      )}
      {now === 'groups' && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Na dziś wychodzą</p>
          <div className="flex flex-wrap gap-1.5">
            {demo.groups.flatMap((group) =>
              aboveLine(demo, group).map((row) => (
                <span key={row.team.id} className="rounded-full border bg-card px-2 py-0.5 text-xs">
                  <span className="font-semibold text-muted-foreground">{group.name.replace('Grupa ', '')}{row.position}</span> {row.team.name}
                </span>
              )),
            )}
          </div>
        </div>
      )}
    </PublicSection>
  );
}

export const variantC: VariantPages = {
  tabs: () => TABS,
  labels: { standings: 'Rozgrywki' },
  activeFor: (page) => (page === 'bracket' ? 'standings' : page),
  home: (demo) => <Overview demo={demo} summary={<Timeline demo={demo} />} />,
  standings: (demo) => <Competition demo={demo} />,
  bracket: (demo) => <Competition demo={demo} forced="playoff" />,
  fixtures: (demo) => <SplitRounds demo={demo} matches={openMatches(demo)} direction="asc" empty="Brak zaplanowanych meczów" />,
  results: (demo) => <SplitRounds demo={demo} matches={finishedMatches(demo)} direction="desc" empty="Brak rozegranych meczów" />,
};
