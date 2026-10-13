import { useMutation } from '@tanstack/react-query';
import type { Tournament } from '@tournament/api-client';
import { AdminShell, type AdminNavKey, type AdminSectionKey } from '@tournament/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { currentVariant, replacesSchedule } from '../prototype/variant';
import { endSession } from '../lib/session';
import { useAccount } from '../lib/use-account';
import { useCurrentTournaments } from '../lib/use-current-tournaments';

/**
 * Sekcje turnieju, które mają już swoją trasę pod `/tournaments/:id`. Reszta
 * zostaje nieczynna, dopóki nie powstanie odpowiedni widok — `AdminShell` sam
 * wyszarza kartę bez adresu, więc nie ma tu martwych odnośników.
 */
const SECTION_ROUTES: Partial<Record<AdminSectionKey, string>> = {
  teams: 'teams',
  venues: 'venues',
  settings: 'settings',
  standings: 'standings',
  schedule: 'schedule',
};

/** Adres turnieju, czyli jego domyślnej sekcji (indeks trasy przekierowuje). */
function tournamentRoute(id: number): string {
  return `/tournaments/${id}`;
}

/** Adres celu nawigacji; `tournament` to turniej, w którym stoi ekran. */
function navRoute(key: AdminNavKey, tournament: Tournament | undefined): string | undefined {
  if (key === 'dashboard') return '/';
  if (key === 'create') return '/tournaments/new';
  if (!tournament) return undefined;
  // PROTOTYP (#217): Drabinka ma trasę, wariant jedzie z kartą, a w B i D
  // Terminarz jest nieczynny (Drabinka go zastępuje).
  const variant = currentVariant();
  if (key === 'bracket') return `${tournamentRoute(tournament.id)}/bracket?variant=${variant}`;
  if (key === 'schedule') return replacesSchedule(variant) ? undefined : `${tournamentRoute(tournament.id)}/schedule?variant=${variant}`;
  const section = SECTION_ROUTES[key];
  return section && `${tournamentRoute(tournament.id)}/${section}?variant=${variant}`;
}

interface CommonProps {
  /** Akcje w nagłówku, po prawej stronie tytułu. */
  actions?: ReactNode;
  children: ReactNode;
}

/** Ekran poza turniejem: lista, kreator. Tytuł podaje sam ekran. */
interface PanelPageProps extends CommonProps {
  active: 'dashboard';
  title: string;
  subtitle?: string;
  tournament?: never;
  section?: never;
}

/**
 * Ekran sekcji turnieju. Nagłówek jest wspólny dla wszystkich sekcji, więc
 * składa go ta warstwa: tytuł to nazwa turnieju, podtytuł to sport i adres
 * publiczny, a sekcję pokazuje aktywna karta, nie tytuł (#85).
 */
interface TournamentPageProps extends CommonProps {
  tournament: Tournament;
  section: AdminSectionKey;
  active?: never;
  title?: never;
  subtitle?: never;
}

export type AdminPageProps = PanelPageProps | TournamentPageProps;

/**
 * Ekran panelu: `AdminShell` wpięty w router i w sesję.
 *
 * Shell z `packages/ui` nie zna ani routera, ani klienta API — dostaje adresy
 * i callbacki propsami. Ta warstwa jest miejscem, w którym te propsy powstają,
 * żeby nawigacja, konto i wylogowanie nie były przepisywane w każdym ekranie
 * z osobna. Drugi ekran panelu (#28) był momentem, w którym kopia zaczęła się
 * rozjeżdżać z oryginałem.
 */
export function AdminPage(props: AdminPageProps) {
  const { tournament, actions, children } = props;
  const navigate = useNavigate();
  const account = useAccount();
  const tournaments = useCurrentTournaments();

  /**
   * Wylogowanie unieważnia token po stronie API, a nie tylko zapomina go
   * lokalnie: `POST /logout` kasuje w Sanctumie dokładnie ten token, którym
   * poszło żądanie. Bez tego „Wyloguj" zostawia ważne poświadczenie w rękach
   * każdego, kto je przechwycił.
   *
   * Żądanie musi wyjść, *zanim* zniknie token, bo inaczej idzie bez nagłówka
   * `Authorization` i nie unieważnia niczego. Sesję zamyka `endSession()`
   * z `onSettled`, czyli niezależnie od wyniku: padnięta sieć ani 500 nie mogą
   * zatrzymać organizera w panelu.
   */
  const logout = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST('/logout');
      if (error) throw new Error(error.message);
    },
    onSettled: endSession,
  });

  return (
    <AdminShell
      {...(tournament
        ? {
            active: props.section,
            tournament,
            title: tournament.name,
            subtitle: `${tournament.sport.name} · /t/${tournament.slug}`,
          }
        : { active: props.active, title: props.title, subtitle: props.subtitle })}
      actions={actions}
      user={account}
      tournaments={tournaments}
      navHref={(key) => navRoute(key, tournament)}
      onNavigate={(key) => {
        const route = navRoute(key, tournament);
        if (route) void navigate(route);
      }}
      tournamentHref={tournamentRoute}
      onOpenTournament={(id) => void navigate(tournamentRoute(id))}
      // Drugi klik przed odpowiedzią wysłałby drugie `/logout`, a to już na
      // unieważnionym tokenie — czyli 401 i przekierowanie w poprzek pierwszego.
      onLogout={() => {
        if (!logout.isPending) logout.mutate();
      }}
    >
      {children}
    </AdminShell>
  );
}
