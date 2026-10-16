// PROTOTYP (#252) — wariant B: „Grupy osobno, Drabinka gdy jest”. Nie do main.
//
// Zakładka Tabela nazywa się Grupy i pokazuje jedną grupę naraz (pigułki):
// jej tabelę i jej mecze. Drabinka pojawia się w zakładkach dopiero wtedy,
// gdy organizator ją wygeneruje, i wchodzi przed Grupy. Terminarz i Wyniki
// mają filtr: wszystkie, każda grupa, playoff. Przegląd: etap turnieju i
// jedna grupa z pigułkami albo karta drabinki.
import { BracketSummary, BracketTree, EmptyState, Heading, PublicSection, cn, type PublicNavKey } from '@tournament/ui';
import { Check, GitFork, Info, ListOrdered, Milestone } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { phase, type Demo } from './demo';
import {
  ExitLegend,
  GroupTable,
  Pills,
  ProtoLink,
  Row,
  RoundList,
  TabButton,
  byKickoff,
  finishedMatches,
  matchPath,
  openMatches,
  tabPath,
} from './shared';
import { Overview, type VariantPages } from './variant-pages';

function tabs(demo: Demo): readonly PublicNavKey[] {
  return demo.knockout.length > 0
    ? ['home', 'bracket', 'standings', 'fixtures', 'results', 'stats']
    : ['home', 'standings', 'fixtures', 'results', 'stats'];
}

function useGroupParam(demo: Demo): [number, (id: number) => void] {
  const [params, setParams] = useSearchParams();
  const requested = Number(params.get('grupa'));
  const id = demo.groups.some((group) => group.id === requested) ? requested : demo.groups[0]!.id;
  return [
    id,
    (next) =>
      setParams(
        (current) => {
          const copy = new URLSearchParams(current);
          copy.set('grupa', String(next));
          return copy;
        },
        { replace: true },
      ),
  ];
}

function Groups({ demo }: { demo: Demo }) {
  const [groupId, setGroupId] = useGroupParam(demo);
  const group = demo.groups.find((candidate) => candidate.id === groupId)!;
  const matches = byKickoff(demo.groupMatches.filter((match) => match.groupId === group.id));
  const rounds = [...new Set(matches.map((match) => match.round.order))];
  return (
    <div className="space-y-5">
      {demo.groups.length > 1 && (
        <Pills label="Grupa" items={demo.groups.map((g) => ({ key: g.id, label: g.name }))} value={groupId} onChange={setGroupId} />
      )}
      <section className="space-y-2">
        <Heading level="section">{group.name}</Heading>
        <GroupTable demo={demo} group={group} />
        <ExitLegend group={group} />
      </section>
      <section className="space-y-3">
        <Heading level="card">Mecze grupy</Heading>
        {rounds.map((order) => (
          <div key={order} className="space-y-1.5">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Kolejka {order}</p>
            {matches
              .filter((match) => match.round.order === order)
              .map((match) => (
                <Row key={match.id} demo={demo} match={match} />
              ))}
          </div>
        ))}
      </section>
    </div>
  );
}

function Bracket({ demo }: { demo: Demo }) {
  const navigate = useNavigate();
  if (demo.knockout.length === 0) {
    // Zakładki nie ma, ale stary link może tu prowadzić.
    return (
      <EmptyState
        icon={<GitFork />}
        title="Drabinki jeszcze nie ma"
        description="Pojawi się, gdy organizator ułoży ją po fazie grupowej."
        action={<TabButton tab="standings">Przejdź do grup</TabButton>}
      />
    );
  }
  return (
    <div className="space-y-4">
      {demo.divergence.length > 0 && (
        <div className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p>
            Drabinkę ułożono przed końcem fazy grupowej, więc nie idzie za bieżącą tabelą.
            {demo.divergence.map((d) => (
              <span key={d.group.id}>
                {' '}
                W drabince gra {d.inBracket.name}, a w tabeli grupy {d.group.name.replace('Grupa ', '')} nad linią stoi dziś {d.aboveLine.name}.
              </span>
            ))}
          </p>
        </div>
      )}
      <BracketTree
        matches={demo.knockout}
        penaltySlot={demo.allowsDraw}
        matchHref={(match) => matchPath(match.id)}
        onMatchNavigate={(match) => void navigate(matchPath(match.id))}
      />
    </div>
  );
}

type Filter = 'all' | 'playoff' | number;

function Filtered({ demo, finished }: { demo: Demo; finished: boolean }) {
  const [filter, setFilter] = useState<Filter>('all');
  const source = finished ? finishedMatches(demo) : openMatches(demo);
  const items: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Wszystkie' },
    ...demo.groups.map((group) => ({ key: group.id as Filter, label: group.name })),
    ...(demo.knockout.length > 0 ? [{ key: 'playoff' as Filter, label: 'Playoff' }] : []),
  ];
  const matches = source.filter((match) =>
    filter === 'all' ? true : filter === 'playoff' ? match.groupId === null : match.groupId === filter,
  );
  return (
    <div className="space-y-4">
      <Pills label="Filtr meczów" items={items} value={filter} onChange={setFilter} />
      <RoundList
        demo={demo}
        matches={matches}
        direction={finished ? 'desc' : 'asc'}
        empty={finished ? 'Brak rozegranych meczów' : 'Brak zaplanowanych meczów'}
        groupLabel={filter === 'all'}
      />
    </div>
  );
}

/** Etap turnieju: faza grupowa → playoff, z postępem. */
function Stage({ demo }: { demo: Demo }) {
  const now = phase(demo);
  const groupDone = demo.groupMatches.filter((match) => match.status === 'finished').length;
  const koDone = demo.knockout.filter((match) => match.status === 'finished').length;
  const steps = [
    { name: 'Faza grupowa', detail: `${groupDone}/${demo.groupMatches.length} meczów`, done: demo.groupsFinished, current: now === 'groups' || !demo.groupsFinished },
    {
      name: 'Playoff',
      detail: demo.knockout.length ? `${koDone}/${demo.knockout.length} meczów` : 'po fazie grupowej',
      done: now === 'finished',
      current: now === 'playoff',
    },
  ];
  return (
    <PublicSection title="Etap turnieju" icon={<Milestone />}>
      <ol className="grid grid-cols-2 gap-2">
        {steps.map((step) => (
          <li
            key={step.name}
            className={cn('rounded-lg border p-2.5 text-sm', step.current ? 'border-primary bg-primary/5' : 'text-muted-foreground')}
          >
            <span className="flex items-center gap-1.5 font-semibold">
              {step.done && <Check className="size-3.5" />}
              {step.name}
            </span>
            <span className="text-xs tabular-nums">{step.detail}</span>
          </li>
        ))}
      </ol>
    </PublicSection>
  );
}

function Summary({ demo }: { demo: Demo }) {
  const navigate = useNavigate();
  const [groupId, setGroupId] = useState(demo.groups[0]!.id);
  const group = demo.groups.find((g) => g.id === groupId) ?? demo.groups[0]!;
  return (
    <>
      <Stage demo={demo} />
      {demo.knockout.length > 0 ? (
        <PublicSection
          title="Drabinka"
          icon={<GitFork />}
          action={<ProtoLink to={tabPath('bracket')} className="text-sm font-medium underline-offset-4 hover:underline">Zobacz drabinkę ›</ProtoLink>}
        >
          <BracketSummary
            matches={demo.knockout}
            penaltySlot={demo.allowsDraw}
            matchHref={(match) => matchPath(match.id)}
            onMatchNavigate={(match) => void navigate(matchPath(match.id))}
          />
        </PublicSection>
      ) : (
        <PublicSection
          title="Grupy"
          icon={<ListOrdered />}
          action={
            <ProtoLink to={tabPath('standings', { grupa: String(group.id) })} className="text-sm font-medium underline-offset-4 hover:underline">
              Cała grupa ›
            </ProtoLink>
          }
        >
          {demo.groups.length > 1 && (
            <Pills label="Grupa" items={demo.groups.map((g) => ({ key: g.id, label: g.name }))} value={group.id} onChange={setGroupId} />
          )}
          <GroupTable demo={demo} group={group} compact />
        </PublicSection>
      )}
    </>
  );
}

export const variantB: VariantPages = {
  tabs,
  labels: { standings: 'Grupy' },
  home: (demo) => <Overview demo={demo} groupLabel summary={<Summary demo={demo} />} />,
  standings: (demo) => <Groups demo={demo} />,
  bracket: (demo) => <Bracket demo={demo} />,
  fixtures: (demo) => <Filtered demo={demo} finished={false} />,
  results: (demo) => <Filtered demo={demo} finished />,
};
