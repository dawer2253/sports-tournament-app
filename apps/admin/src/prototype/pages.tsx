// PROTOTYP (#85) — trasy wewnątrz turnieju. Nie do main.
//
// Trasa-rodzic `/tournaments/:id` wczytuje turniej raz. Dopóki go nie ma
// (ładowanie, 403/404, błąd), rysuje dzisiejszy `TournamentPage`, który te
// stany już obsługuje. Ekrany sekcji to zaślepki: pytanie brzmi „jak się
// poruszać”, a nie „co jest na ekranie drużyn”.
import { useQuery } from '@tanstack/react-query';
import type { Tournament } from '@tournament/api-client';
import { Card, CardContent, EmptyState } from '@tournament/ui';
import { Navigate, Outlet, useOutletContext, useParams } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { api } from '../lib/api';
import { TournamentPage } from '../pages/tournament';
import type { Section } from './shells';
import { useVariant } from './variant';
import { VenuesPrototype } from './venues-variants';

export function TournamentLayout() {
  const params = useParams();
  const id = Number(params.id);
  const validId = /^[1-9]\d*$/.test(params.id ?? '') && Number.isSafeInteger(id);
  const tournament = useQuery({
    queryKey: ['tournament', id],
    enabled: validId,
    queryFn: async () => {
      const { data, error } = await api.GET('/tournaments/{tournament}', {
        params: { path: { tournament: id } },
      });
      if (error) throw new Error(error.message);
      return data.data;
    },
  });
  if (!tournament.data) return <TournamentPage />;
  return <Outlet context={tournament.data} />;
}

/** Co pod `/tournaments/:id`: A i C przekierowują na drużyny, B zostawia przegląd. */
export function TournamentIndex() {
  const variant = useVariant();
  if (variant === 'B') return <TournamentPage />;
  return <Navigate to={`teams${window.location.search}`} replace />;
}

const SECTIONS: Record<string, { title: string; ticket: string }> = {
  teams: { title: 'Drużyny', ticket: '#89 ekran drużyn i zawodników' },
  venues: { title: 'Obiekty', ticket: '#90 ekran obiektów' },
  settings: { title: 'Ustawienia', ticket: '#91 ekran ustawień i brandingu' },
};

export function SectionPage({ section }: { section: Section }) {
  const tournament = useOutletContext<Tournament>();
  const variant = useVariant();
  if (section === 'venues') return <VenuesPrototype tournament={tournament} />;
  const meta = SECTIONS[section];
  const title = variant === 'B' && section === 'settings' ? 'Branding i ustawienia' : meta.title;
  return (
    <AdminPage active="dashboard" section={section} tournament={tournament} title={title} subtitle={tournament.name}>
      <Card>
        <CardContent>
          <EmptyState
            title={`Tu będzie ekran: ${meta.title}`}
            description={`Zaślepka prototypu. Treść rozstrzyga ${meta.ticket}.`}
          />
          {section === 'settings' && (
            <div id="branding" className="mt-6 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Sekcja „Branding” (kolor, logo) na tym samym ekranie. W wariancie B prowadzi tu osobna pozycja
              sidebaru przez kotwicę <code>#branding</code>.
            </div>
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
}
