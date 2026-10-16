// PROTOTYP (#252) — wariant A: „Tabela i Drabinka obok siebie”. Nie do main.
//
// Turniej dwufazowy ma obie zakładki ligi i pucharu: Tabela (wszystkie grupy
// jedna pod drugą) i Drabinka (przed wyjściem z grup pusty stan). Terminarz
// i Wyniki to jedna lista kolejek, grupa stoi w etykiecie wiersza. Przegląd:
// skrót wszystkich tabel grup, a od wygenerowania drabinki także jej karta.
import { BracketSummary, BracketTree, EmptyState, PublicSection, type PublicNavKey } from '@tournament/ui';
import { GitFork, ListOrdered } from 'lucide-react';
import { useNavigate } from 'react-router';
import type { Demo } from './demo';
import {
  ExitLegend,
  GroupHeading,
  GroupTable,
  ProtoLink,
  RoundList,
  TabButton,
  finishedMatches,
  matchPath,
  openMatches,
  tabPath,
} from './shared';
import { Overview, type VariantPages } from './variant-pages';

const TABS: readonly PublicNavKey[] = ['home', 'standings', 'bracket', 'fixtures', 'results', 'stats'];

function Standings({ demo }: { demo: Demo }) {
  return (
    <div className="space-y-8">
      {demo.groups.map((group) => (
        <section key={group.id} className="space-y-2">
          <GroupHeading group={group} />
          <GroupTable demo={demo} group={group} />
          <ExitLegend group={group} />
        </section>
      ))}
    </div>
  );
}

function Bracket({ demo }: { demo: Demo }) {
  const navigate = useNavigate();
  if (demo.knockout.length === 0) {
    return (
      <EmptyState
        icon={<GitFork />}
        title="Drabinki jeszcze nie ma"
        description="Organizator ułoży ją, gdy drużyny wyjdą z grup. Do tego czasu turniej gra w tabelach grup."
        action={<TabButton tab="standings">Przejdź do tabeli</TabButton>}
      />
    );
  }
  return (
    <BracketTree
      matches={demo.knockout}
      penaltySlot={demo.allowsDraw}
      matchHref={(match) => matchPath(match.id)}
      onMatchNavigate={(match) => void navigate(matchPath(match.id))}
    />
  );
}

function Summary({ demo }: { demo: Demo }) {
  const navigate = useNavigate();
  return (
    <>
      {demo.knockout.length > 0 && (
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
      )}
      <PublicSection
        title="Tabele grup (skrót)"
        icon={<ListOrdered />}
        action={<ProtoLink to={tabPath('standings')} className="text-sm font-medium underline-offset-4 hover:underline">Zobacz tabele ›</ProtoLink>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {demo.groups.map((group) => (
            <GroupTable key={group.id} demo={demo} group={group} compact title={<p className="text-sm font-semibold">{group.name}</p>} />
          ))}
        </div>
      </PublicSection>
    </>
  );
}

export const variantA: VariantPages = {
  tabs: () => TABS,
  home: (demo) => <Overview demo={demo} groupLabel summary={<Summary demo={demo} />} />,
  standings: (demo) => <Standings demo={demo} />,
  bracket: (demo) => <Bracket demo={demo} />,
  fixtures: (demo) => <RoundList demo={demo} matches={openMatches(demo)} direction="asc" empty="Brak zaplanowanych meczów" groupLabel />,
  results: (demo) => <RoundList demo={demo} matches={finishedMatches(demo)} direction="desc" empty="Brak rozegranych meczów" groupLabel />,
};
