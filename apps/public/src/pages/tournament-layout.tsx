import type { PublicTournament } from '@tournament/api-client';
import { EmptyState, Skeleton } from '@tournament/ui';
import { PublicShell, type PublicNavKey } from '@tournament/ui/components/layout/public-shell.tsx';
import { useEffect } from 'react';
import { Outlet, useMatches, useNavigate, useOutletContext, useParams } from 'react-router';
import { isNotFound } from '../lib/api-error';
import { usePublicTournament } from '../lib/queries';

/** Podtrasa zakładki pod `/t/:slug`, po polsku (#192). */
const TAB_PATHS: Record<PublicNavKey, string> = {
  home: '',
  standings: 'tabela',
  fixtures: 'terminarz',
  results: 'wyniki',
};

/** Adres zakładki turnieju. */
export function tabHref(slug: string, key: PublicNavKey): string {
  return TAB_PATHS[key] ? `/t/${slug}/${TAB_PATHS[key]}` : `/t/${slug}`;
}

/** `handle` trasy zakładki: którą zakładkę podświetla shell. */
export interface TabHandle {
  tab: PublicNavKey;
}

function useActiveTab(): PublicNavKey | undefined {
  const matches = useMatches();
  return matches.map((match) => (match.handle as TabHandle | undefined)?.tab).findLast(Boolean);
}

/** Ekran bez shella: turnieju nie ma albo jeszcze nie przyszedł. */
function Bare({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">{children}</main>;
}

/**
 * Trasa-rodzic `/t/:slug`, wzorem `apps/admin/src/pages/tournament-layout.tsx`:
 * turniej wczytuje się tu raz i schodzi do zakładek przez `Outlet`, więc
 * zmiana zakładki nie pyta o niego od nowa, a `404` i błąd obsługuje jedno
 * miejsce.
 */
export function TournamentLayout() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const active = useActiveTab();
  const tournament = usePublicTournament(slug);
  const name = tournament.data?.name;

  useEffect(() => {
    if (name) document.title = name;
  }, [name]);

  // Dane przed błędem: nieudane odświeżenie w tle nie zdejmuje ekranu.
  // Zostaje ostatni wczytany turniej, a następne odpytanie spróbuje znowu.
  if (tournament.data) {
    return (
      <PublicShell
        tournament={tournament.data}
        active={active}
        navHref={(key) => tabHref(slug, key)}
        onNavigate={(key) => void navigate(tabHref(slug, key))}
      >
        <Outlet context={tournament.data} />
      </PublicShell>
    );
  }

  if (isNotFound(tournament.error)) {
    return (
      <Bare>
        <EmptyState
          title="Nie ma takiego turnieju"
          description="Sprawdź adres. Turniej mógł zostać usunięty albo jeszcze nie jest opublikowany."
        />
      </Bare>
    );
  }

  if (tournament.isError) {
    return (
      <Bare>
        <EmptyState variant="error" title="Nie udało się wczytać turnieju" description={tournament.error.message} />
      </Bare>
    );
  }

  return (
    <Bare>
      <div aria-busy="true" aria-label="Wczytywanie turnieju" className="space-y-3">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-40 w-full" />
      </div>
    </Bare>
  );
}

/** Turniej wczytany przez `TournamentLayout`, dla ekranów zakładek. */
export function useTournament(): PublicTournament {
  const tournament = useOutletContext<PublicTournament | undefined>();
  if (!tournament) {
    throw new Error('useTournament() działa tylko w zakładce pod TournamentLayout.');
  }
  return tournament;
}
