import type { PublicTournament } from '@tournament/api-client';
import { EmptyState, Skeleton } from '@tournament/ui';
import { PublicShell, type PublicNavKey } from '@tournament/ui/components/layout/public-shell.tsx';
import { useEffect } from 'react';
import { Outlet, useMatches, useNavigate, useOutletContext, useParams } from 'react-router';
import { usePublicTournament } from '../lib/queries';
import { StandalonePage } from './standalone-page';

/** Podtrasa zakładki pod `/t/:slug`, po polsku (#192). */
const TAB_PATHS: Record<PublicNavKey, string> = {
  home: '',
  standings: 'tabela',
  fixtures: 'terminarz',
  results: 'wyniki',
  stats: 'statystyki',
};

/** Adres zakładki turnieju. */
export function tabHref(slug: string, key: PublicNavKey): string {
  return TAB_PATHS[key] ? `/t/${slug}/${TAB_PATHS[key]}` : `/t/${slug}`;
}

const NOT_FOUND = 'Nie ma takiego turnieju';
const FAILED = 'Nie udało się wczytać turnieju';

/** `handle` trasy zakładki: którą zakładkę podświetla shell. */
export interface TabHandle {
  tab: PublicNavKey;
}

function useActiveTab(): PublicNavKey | undefined {
  const matches = useMatches();
  return matches.map((match) => (match.handle as TabHandle | undefined)?.tab).findLast(Boolean);
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
  const notFound = tournament.data === null;
  const failed = tournament.data === undefined && tournament.isError;
  const title = tournament.data?.name ?? (notFound ? NOT_FOUND : failed ? FAILED : undefined);

  // Tytuł karty idzie za tym, co widać: nazwa turnieju, a bez niego stan
  // ekranu — inaczej po wejściu z innego turnieju została by jego nazwa.
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);

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

  if (notFound) {
    return (
      <StandalonePage>
        <EmptyState
          title={NOT_FOUND}
          description="Sprawdź adres. Turniej mógł zostać usunięty albo jeszcze nie jest opublikowany."
        />
      </StandalonePage>
    );
  }

  if (failed) {
    return (
      <StandalonePage>
        <EmptyState variant="error" title={FAILED} description={tournament.error.message} />
      </StandalonePage>
    );
  }

  return (
    <StandalonePage>
      <div aria-busy="true" aria-label="Wczytywanie turnieju" className="space-y-3">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-40 w-full" />
      </div>
    </StandalonePage>
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
