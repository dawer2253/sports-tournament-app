import type { PublicTournament } from '@tournament/api-client';
import {
  Shell,
  TournamentLoadError,
  TournamentLoading,
  TournamentNotFound,
  publicTabs,
  type PublicNavKey,
} from '@tournament/ui/public';
import { useEffect } from 'react';
import { Outlet, useMatches, useNavigate, useOutletContext, useParams } from 'react-router';
import { usePublicTournament } from '../lib/queries';

/** Podtrasa zakładki pod `/t/:slug`, po polsku (#192). */
const TAB_PATHS: Record<PublicNavKey, string> = {
  home: '',
  standings: 'tabela',
  bracket: 'drabinka',
  fixtures: 'terminarz',
  results: 'wyniki',
  stats: 'statystyki',
};

/** Adres zakładki turnieju. */
export function tabHref(slug: string, key: PublicNavKey): string {
  return TAB_PATHS[key] ? `/t/${slug}/${TAB_PATHS[key]}` : `/t/${slug}`;
}

/** Adres strony meczu (#210). */
export function matchHref(slug: string, matchId: number): string {
  return `/t/${slug}/mecze/${matchId}`;
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
      <Shell
        tournament={tournament.data}
        // Puchar ma Drabinkę w miejscu Tabeli (#234), a turniej z grupami
        // obie naraz (#268).
        tabs={publicTabs(tournament.data.stages)}
        active={active}
        navHref={(key) => tabHref(slug, key)}
        onNavigate={(key) => void navigate(tabHref(slug, key))}
      >
        <Outlet context={tournament.data} />
      </Shell>
    );
  }

  if (notFound) return <TournamentNotFound path={`/t/${slug}`} />;

  if (failed) return <TournamentLoadError message={tournament.error.message} onRetry={() => void tournament.refetch()} />;

  return <TournamentLoading />;
}

/** Turniej wczytany przez `TournamentLayout`, dla ekranów zakładek. */
export function useTournament(): PublicTournament {
  const tournament = useOutletContext<PublicTournament | undefined>();
  if (!tournament) {
    throw new Error('useTournament() działa tylko w zakładce pod TournamentLayout.');
  }
  return tournament;
}
