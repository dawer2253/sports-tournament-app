const TOKEN_KEY = 'tournament.token';
const LOGIN_PATH = '/login';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Zamyka sesję: token znika, a przeglądarka ląduje na logowaniu.
 *
 * Jedno miejsce dla obu dróg wyjścia — kliknięcia „Wyloguj" i 401 z API — bo
 * przy dwóch osobnych ścieżkach 401 z `/logout` odpalał obie naraz i ścigały
 * się o to, kto przekieruje.
 *
 * Przeładowanie strony jest tu celowe, nie z lenistwa: wyrzuca z pamięci
 * wszystko, co zostało po poprzedniej sesji — cache React Query z `/me` i listą
 * turniejów, stan komponentów — więc kolejne logowanie, choćby na inne konto,
 * startuje z czystego miejsca. Nawigacja SPA wymagałaby czyszczenia cache'u
 * ręcznie i dopiero po odmontowaniu ekranu, bo `queryClient.clear()` przy
 * jeszcze zamontowanych `useQuery` natychmiast odpala refetch, już bez tokenu.
 *
 * Token czyścimy zawsze, przekierowanie pomijamy, gdy już jesteśmy na
 * logowaniu — inaczej 401 z samego `/login` robiłby pętlę przeładowań.
 */
export function endSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.assign(LOGIN_PATH);
  }
}
