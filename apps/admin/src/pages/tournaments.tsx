import { useQuery } from '@tanstack/react-query';
import { Button, TournamentsTable } from '@tournament/ui';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { AdminPage } from '../components/admin-page';
import { api } from '../lib/api';

export function TournamentsPage() {
  const navigate = useNavigate();

  // Kontrakt stronicuje listę (domyślnie 20 na stronę). Panel pokazuje na
  // razie pierwszą stronę i mówi wprost, ile turniejów jest w sumie.
  const tournaments = useQuery({
    queryKey: ['tournaments'],
    queryFn: async () => {
      const { data, error } = await api.GET('/tournaments');
      if (error) throw new Error(error.message);
      return data;
    },
  });

  function goToCreate() {
    void navigate('/tournaments/new');
  }

  const rows = tournaments.data?.data ?? [];
  const total = tournaments.data?.meta.total ?? 0;

  return (
    <AdminPage
      active="dashboard"
      title="Twoje turnieje"
      subtitle="Zarządzaj ligami i turniejami"
      // Wyjście do kreatora także przy niepustej liście: przycisk w stanie
      // pustym znika po założeniu pierwszego turnieju, a wtedy panel znowu
      // nie miałby jak dołożyć kolejnego (#28). W stanie błędu go nie ma —
      // tam liczy się ponowienie, nie zakładanie następnego turnieju.
      actions={
        tournaments.status === 'success' && rows.length > 0 ? (
          <Button onClick={goToCreate}>
            <Plus className="size-4" /> Nowy turniej
          </Button>
        ) : undefined
      }
    >
      <TournamentsTable
        status={tournaments.status}
        tournaments={rows}
        total={total}
        errorMessage={tournaments.error?.message}
        onRetry={() => void tournaments.refetch()}
        onCreate={goToCreate}
      />
    </AdminPage>
  );
}
