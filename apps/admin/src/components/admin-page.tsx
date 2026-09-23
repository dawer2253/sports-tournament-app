import { useMutation } from '@tanstack/react-query';
import { AdminShell, type AdminNavKey } from '@tournament/ui';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../lib/api';
import { endSession } from '../lib/session';
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
