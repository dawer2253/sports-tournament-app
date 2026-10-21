import { useMutation } from '@tanstack/react-query';
import type { Tournament } from '@tournament/api-client';
import {
  AdminShell,
  isKnockoutOnly,
  MetaList,
  pendingRegistrationsBadge,
  Skeleton,
  type AdminNavKey,
  type AdminSectionKey,
} from '@tournament/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useStages } from '../lib/schedule-queries';
import { SECTION_ROUTES } from '../lib/section-route';
import { endSession } from '../lib/session';
import { useAccount } from '../lib/use-account';
import { useCurrentTournaments } from '../lib/use-current-tournaments';

/** Adres turnieju, czyli jego domyślnej sekcji (indeks trasy przekierowuje). */
function tournamentRoute(id: number): string {
  return `/tournaments/${id}`;
}

/**
 * Adres celu nawigacji; `tournamentId` to turniej, w którym stoi ekran.
 * W pucharze Terminarz nie ma adresu, bo zastępuje go Drabinka (#227),
 * więc `AdminShell` wyszarza kartę. Dopóki faz nie ma, karta zostaje czynna.
 */
function navRoute(key: AdminNavKey, tournamentId: number | undefined, knockoutOnly: boolean): string | undefined {
  if (key === 'dashboard') return '/';
  if (key === 'create') return '/tournaments/new';
  if (tournamentId === undefined) return undefined;
  if (key === 'schedule' && knockoutOnly) return undefined;
  const section = SECTION_ROUTES[key];
  return section && `${tournamentRoute(tournamentId)}/${section}`;
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
  tournamentId?: never;
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
  tournamentId?: never;
}

/**
 * Sekcja turnieju, którego danych jeszcze nie ma — trasa-rodzic w drodze.
 * Znamy wtedy `id` z adresu i to wystarczy, żeby shell stał w turnieju i nie
 * migał shellem dashboardu przy przejściu A → B albo przy pierwszym wejściu
 * (#262). Nazwę, status i sport dokłada lista bieżących z sidebaru; gdy i jej
 * nie ma, nagłówek zostaje ze szkieletem.
 */
interface PendingTournamentPageProps extends CommonProps {
  tournamentId: number;
  section: AdminSectionKey;
  tournament?: never;
  active?: never;
  title?: never;
  subtitle?: never;
}

export type AdminPageProps = PanelPageProps | TournamentPageProps | PendingTournamentPageProps;

/** Warianty, które stoją w turnieju — z pełnymi danymi albo tylko z id. */
type InTournamentPage = TournamentPageProps | PendingTournamentPageProps;

/**
 * Id turnieju, w którym stoi ekran: pełne dane z API albo samo `tournamentId`
 * z adresu, gdy trasa-rodzic czeka na odpowiedź.
 */
function pageTournamentId(props: InTournamentPage): number {
  // Warianty wykluczają się: pełne dane albo `tournamentId`, nigdy oba puste,
  // więc gałąź `else` ma zagwarantowane `tournamentId`.
  return props.tournament ? props.tournament.id : props.tournamentId;
}

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
  // Trasa-rodzic bez danych z API zna tylko `id` z adresu, a reszta (nazwa,
  // status, sport) idzie z listy bieżących — tej samej pozycji, którą
  // organizer kliknął, żeby tu wejść. Bez niej zostaje samo `id`.
  const openId = props.section !== undefined ? pageTournamentId(props) : undefined;
  const listed = tournaments.status === 'success' ? tournaments.items.find(({ id }) => id === openId) : undefined;
  const open = tournament ?? listed;
  const stages = useStages(openId);
  const knockoutOnly = isKnockoutOnly(stages.data ?? []);

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
      {...(props.section !== undefined
        ? {
            active: props.section,
            tournament: open ?? { id: pageTournamentId(props) },
            title: open?.name ?? <Skeleton className="h-7 w-56" />,
            subtitle: tournament && (
              <MetaList>
                <span>{tournament.sport.name}</span>
                <span>/t/{tournament.slug}</span>
              </MetaList>
            ),
          }
        : { active: props.active, title: props.title, subtitle: props.subtitle })}
      actions={actions}
      user={account}
      tournaments={tournaments}
      navHref={(key) => navRoute(key, openId, knockoutOnly)}
      navDisabledReason={(key) => (key === 'schedule' && knockoutOnly ? 'W pucharze terminarzem jest Drabinka' : undefined)}
      // Oczekujące zgłoszenia (#300) przy karcie „Zgłoszenia”; liczy je API w turnieju.
      sectionBadge={(key) =>
        key === 'registrations' && tournament ? pendingRegistrationsBadge(tournament.registration.pendingCount) : undefined
      }
      onNavigate={(key) => {
        const route = navRoute(key, openId, knockoutOnly);
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
