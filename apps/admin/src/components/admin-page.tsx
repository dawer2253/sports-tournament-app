import { useMutation } from '@tanstack/react-query';
import type { Tournament } from '@tournament/api-client';
import type { AdminNavKey } from '@tournament/ui';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { endSession } from '../lib/session';
import { useAccount } from '../lib/use-account';
import { ProtoShell, type Section } from '../prototype/shells';

export interface AdminPageProps {
  active: AdminNavKey;
  title: string;
  subtitle?: string;
  /** Akcje w nagłówku, po prawej stronie tytułu. */
  actions?: ReactNode;
  children: ReactNode;
  /** PROTOTYP (#85): sekcja i turniej dla wariantów nawigacji. */
  section?: Section;
  tournament?: Tournament;
}

/**
 * PROTOTYP (#85): zamiast `AdminShell` rysuje jeden z trzech wariantów
 * nawigacji (`?variant=A|B|C`). Wylogowanie zostaje jak w `main`.
 */
export function AdminPage({ title, subtitle, actions, children, section, tournament }: AdminPageProps) {
  const account = useAccount();

  const logout = useMutation({
    mutationFn: async () => {
      const { error } = await api.POST('/logout');
      if (error) throw new Error(error.message);
    },
    onSettled: endSession,
  });

  return (
    <ProtoShell
      section={section ?? 'tournaments'}
      title={title}
      subtitle={subtitle}
      actions={actions}
      tournament={tournament}
      account={account}
      onLogout={() => {
        if (!logout.isPending) logout.mutate();
      }}
    >
      {children}
    </ProtoShell>
  );
}
