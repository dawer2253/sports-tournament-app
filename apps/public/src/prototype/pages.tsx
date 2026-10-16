// PROTOTYP (#252) — trasy /t/grupy-demo: każda zakładka oddaje widok wybranego
// wariantu. Dane w pamięci (`demo.ts`), mock nie jest potrzebny. Nie do main.
import { Button, EmptyState } from '@tournament/ui';
import { ArrowLeft } from 'lucide-react';
import { useParams, useNavigate } from 'react-router';
import { useDemo } from './demo';
import { ProtoShell, Row, withPosition } from './shared';
import { PrototypeSwitcher } from './switcher';
import { useVariant, type Variant } from './variant';
import { variantA } from './variant-a';
import { variantB } from './variant-b';
import { variantC } from './variant-c';
import type { Page, VariantPages } from './variant-pages';

const PAGES: Record<Variant, VariantPages> = { A: variantA, B: variantB, C: variantC };

export function ProtoPage({ page }: { page: Page | 'stats' }) {
  const demo = useDemo();
  const v = PAGES[useVariant()];
  const active = page === 'stats' ? 'stats' : (v.activeFor?.(page) ?? page);
  return (
    <ProtoShell demo={demo} active={active} tabs={v.tabs(demo)} labels={v.labels}>
      {page === 'stats' ? (
        <EmptyState title="Statystyki jak w lidze" description="Klasyfikacja liczy się ze wszystkich faz. Poza zakresem prototypu #252." />
      ) : (
        v[page](demo)
      )}
      <PrototypeSwitcher />
    </ProtoShell>
  );
}

/** Zaślepka strony meczu: grupa albo pozycja w drabince nad wynikiem. */
export function ProtoMatchPage() {
  const demo = useDemo();
  const v = PAGES[useVariant()];
  const navigate = useNavigate();
  const id = Number(useParams().matchId);
  const match = [...demo.groupMatches, ...demo.knockout].find((m) => m.id === id);
  const context = match && (match.groupId !== null ? withPosition(demo, match, true).bracket?.label : withPosition(demo, match).bracket?.label);
  return (
    <ProtoShell demo={demo} tabs={v.tabs(demo)} labels={v.labels}>
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => void navigate(-1)}>
          <ArrowLeft />
          Wróć
        </Button>
        {match ? (
          <div className="space-y-3 rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              {context}, {match.round.name}
            </p>
            <Row demo={demo} match={match} />
            <p className="text-xs text-muted-foreground">Zaślepka. Docelowo strona meczu z #210 z grupą albo pozycją w drabince w nagłówku.</p>
          </div>
        ) : (
          <EmptyState title="Nie ma takiego meczu" description="Zmienił się stan turnieju w panelu prototypu." />
        )}
      </div>
      <PrototypeSwitcher />
    </ProtoShell>
  );
}
