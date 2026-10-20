import type { PublicTournament } from '@tournament/api-client';
import {
  MatchClockProvider,
  RegistrationBanner,
  Shell,
  TournamentLoadError,
  TournamentLoading,
  TournamentNotFound,
  TOURNAMENT_NOT_FOUND,
  publicTabs,
  type MatchClockSettings,
  type PublicNavKey,
} from '@tournament/ui/public';
import { useEffect, useMemo } from 'react';
import { Outlet, useMatch, useMatches, useNavigate, useOutletContext, useParams } from 'react-router';
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

/**
 * Nawigacja zakładek turnieju dla shella i ekranów: adres zakładki
 * i przejście routerem (`navHref` + `onNavigate`).
 */
export function useTabNav(slug: string): { navHref: (key: PublicNavKey) => string; onNavigate: (key: PublicNavKey) => void } {
  const navigate = useNavigate();
  return { navHref: (key) => tabHref(slug, key), onNavigate: (key) => void navigate(tabHref(slug, key)) };
}

/** Adres strony meczu (#210). */
export function matchHref(slug: string, matchId: number): string {
  return `/t/${slug}/mecze/${matchId}`;
}

/** Podtrasa formularza zgłoszenia drużyny (#300), po polsku jak zakładki. */
export const REGISTRATION_PATH = 'zgloszenie';

/** Adres formularza zgłoszenia drużyny. */
export function registrationHref(slug: string): string {
  return `/t/${slug}/${REGISTRATION_PATH}`;
}

/**
 * Wejście w formularz zgłoszenia (#300) dla paska i kafla: termin i adres
 * przy otwartych zapisach, `null` przy zamkniętych — wtedy wejścia nie ma.
 */
export function useRegistrationEntry(tournament: PublicTournament) {
  const navigate = useNavigate();
  if (!tournament.registration.open) return null;
  const href = registrationHref(tournament.slug);
  return { deadline: tournament.registration.deadline, href, onNavigate: () => void navigate(href) };
}

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
  const tabNav = useTabNav(slug);
  const active = useActiveTab();
  const tournament = usePublicTournament(slug);
  const notFound = tournament.data === null;
  const failed = tournament.data === undefined && tournament.isError;
  const title = tournament.data?.name ?? (notFound ? TOURNAMENT_NOT_FOUND : failed ? FAILED : undefined);

  // Tytuł karty idzie za tym, co widać: nazwa turnieju, a bez niego stan
  // ekranu — inaczej po wejściu z innego turnieju została by jego nazwa.
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);

  const clock = useClockSettings(tournament.data);

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
        banner={<RegistrationBannerFor tournament={tournament.data} />}
        {...tabNav}
      >
        {/* Zegar meczów na żywo (#297) liczy przeglądarka z ustawień turnieju, co 30 s, bez nowych zapytań. */}
        <MatchClockProvider settings={clock}>
          <Outlet context={tournament.data} />
        </MatchClockProvider>
      </Shell>
    );
  }

  if (notFound) return <TournamentNotFound path={`/t/${slug}`} />;

  if (failed) return <TournamentLoadError message={tournament.error.message} onRetry={() => void tournament.refetch()} />;

  return <TournamentLoading />;
}

/**
 * Pasek zapisów (#300) na każdej zakładce przy otwartych zapisach. Na samym
 * formularzu go nie ma: tam przycisk „Zgłoś drużynę” prowadziłby donikąd.
 */
function RegistrationBannerFor({ tournament }: { tournament: PublicTournament }) {
  const entry = useRegistrationEntry(tournament);
  const onForm = useMatch(`/t/:slug/${REGISTRATION_PATH}`) !== null;
  return entry && !onForm ? <RegistrationBanner {...entry} /> : null;
}

/**
 * Ustawienia zegara meczów (#297) z turnieju: podział meczu, długość
 * i `runningClock`. Obiekt zmienia się tylko ze zmianą tych pól, więc
 * odpytanie turnieju co 15 s nie przelicza zegarów pod spodem.
 */
function useClockSettings(tournament: PublicTournament | null | undefined): MatchClockSettings {
  const count = tournament?.periods.count ?? 1;
  const minutes = tournament?.periods.minutes ?? null;
  const matchDuration = tournament?.matchDuration ?? 0;
  const runningClock = tournament?.runningClock ?? false;
  return useMemo(() => ({ periods: { count, minutes }, matchDuration, runningClock }), [count, minutes, matchDuration, runningClock]);
}

/** Turniej wczytany przez `TournamentLayout`, dla ekranów zakładek. */
export function useTournament(): PublicTournament {
  const tournament = useOutletContext<PublicTournament | undefined>();
  if (!tournament) {
    throw new Error('useTournament() działa tylko w zakładce pod TournamentLayout.');
  }
  return tournament;
}
