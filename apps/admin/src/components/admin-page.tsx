import { useMutation } from '@tanstack/react-query';
import type { Tournament } from '@tournament/api-client';
import { AdminShell, type AdminNavKey, type AdminSectionKey } from '@tournament/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { endSession } from '../lib/session';
import { useAccount } from '../lib/use-account';

/**
 * Sekcje turnieju, które mają już swoją trasę pod `/tournaments/:id`. Reszta
 * zostaje nieczynna, dopóki nie powstanie odpowiedni widok — `AdminShell` sam
 * wyszarza kartę bez adresu, więc nie ma tu martwych odnośników.
 */
const SECTION_ROUTES: Partial<Record<AdminSectionKey, string>> = {
  teams: 'teams',
  venues: 'venues',
  settings: 'settings',
  schedule: 'schedule', // PROTOTYP (#162)
};

/** Adres celu nawigacji; `tournament` to turniej, w którym stoi ekran. */
function navRoute(key: AdminNavKey, tournament: Tournament | undefined): string | undefined {
  if (key === 'dashboard') return '/';
  if (!tournament) return undefined;
  const base = `/tournaments/${tournament.id}`;
  if (key === 'tournament') return base;
  const section = SECTION_ROUTES[key];
  return section && `${base}/${section}`;
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
      navHref={(key) => navRoute(key, tournament)}
      onNavigate={(key) => {
        const route = navRoute(key, tournament);
        if (route) void navigate(route);
      }}
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
