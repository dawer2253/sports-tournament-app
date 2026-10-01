import { EmptyState, type AdminSectionKey } from '@tournament/ui';
import { AdminPage } from '../components/admin-page';
import { useTournament } from './tournament-layout';

/**
 * Zaślepka sekcji turnieju: shell z właściwą aktywną kartą, bez treści.
 * Treść wnoszą tickety ekranów — drużyny #89, obiekty #90, ustawienia #91 —
 * i każdy z nich zastępuje tę zaślepkę na swojej trasie.
 */
export function TournamentSectionPlaceholder({ section }: { section: AdminSectionKey }) {
  const tournament = useTournament();
  return (
    <AdminPage tournament={tournament} section={section}>
      <EmptyState
        title="Ta sekcja jeszcze powstaje"
        description="Wkrótce zarządzisz nią w tym miejscu."
      />
    </AdminPage>
  );
}
