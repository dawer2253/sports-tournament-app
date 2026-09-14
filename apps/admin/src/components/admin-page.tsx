import { AdminShell, type AdminNavKey } from '@tournament/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { clearToken } from '../lib/session';
import { useAccount } from '../lib/use-account';

/**
 * Pozycje nawigacji, które mają już swój ekran. Reszta zostaje nieczynna,
 * dopóki nie powstanie odpowiedni widok — `AdminShell` sam wyszarza pozycję
 * bez adresu, więc nie ma tu martwych odnośników.
 */
const NAV_ROUTES: Partial<Record<AdminNavKey, string>> = {
  dashboard: '/',
};

export interface AdminPageProps {
  active: AdminNavKey;
  title: string;
  subtitle?: string;
  /** Akcje w nagłówku, po prawej stronie tytułu. */
  actions?: ReactNode;
  children: ReactNode;
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
export function AdminPage({ active, title, subtitle, actions, children }: AdminPageProps) {
  const navigate = useNavigate();
  const account = useAccount();

  return (
    <AdminShell
      active={active}
      title={title}
      subtitle={subtitle}
      actions={actions}
      user={account}
      navHref={(key) => NAV_ROUTES[key]}
      onNavigate={(key) => {
        const route = NAV_ROUTES[key];
        if (route) void navigate(route);
      }}
      onLogout={() => {
        clearToken();
        void navigate('/login');
      }}
    >
      {children}
    </AdminShell>
  );
}
