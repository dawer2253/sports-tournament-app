import { useQuery } from '@tanstack/react-query';
import type { AdminShellAccount } from '@tournament/ui';
import { api } from './api';

/**
 * Zalogowany organizer do headera panelu, w kształcie, którego oczekuje
 * `AdminShell`. Każdy ekran panelu potrzebuje tego samego, więc zapytanie
 * siedzi tu, a nie w kolejnych kopiach w `pages/`.
 *
 * Trzy stany, nie dwa: `/me` w drodze to nie to samo co `/me` po błędzie.
 * Nazwy zastępczej nie podstawiamy — wyglądałaby jak prawdziwe konto.
 */
export function useAccount(): AdminShellAccount {
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const { data, error } = await api.GET('/me');
      if (error) throw new Error(error.message);
      return data.data;
    },
  });

  return me.data ?? (me.isPending ? 'pending' : null);
}
