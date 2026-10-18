/**
 * PROTOTYP S7 (#288) — „nie znaleziono” i stany zapytania w języku C:
 * brak turnieju (bez shella, jak `StandalonePage`), nieznana podstrona
 * i nieznany mecz (w shellu, bez aktywnej zakładki), błąd z ponowieniem
 * i wczytywanie (dziś `QueryState`: `EmptyState` i `Skeleton` z panelu).
 */
import type { PublicNavKey } from '../../../components/layout/public-nav'
import { cn } from '../../../lib/utils'
import { DeadLink, PublicRoot, TAB_LABELS } from '../parts'
import { EmptyBoard, PageHead, PubButton, Shell, TextLink } from './kit'
import type { Season } from './screen-demo'

export const SYSTEM_STATES = {
  turniej: 'Nie ma turnieju',
  strona: 'Nie ma strony',
  mecz: 'Nie ma meczu',
  blad: 'Błąd wczytywania',
  ladowanie: 'Wczytywanie',
} as const
export type SystemState = keyof typeof SYSTEM_STATES

/** Brak turnieju: nie ma koloru turnieju ani nazwy, więc strona stoi na domyślnej zieleni bez shella. */
function NoTournament({ accent }: { accent: string }) {
  return (
    <PublicRoot accent={accent} className="flex flex-col">
      <header className="border-b border-hairline bg-sunken">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-4 sm:px-6">
          <span className="pub-tab text-lg text-muted-foreground">TournamentApp</span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-4 py-16 sm:px-6">
        <span className="pub-score text-[6rem] text-muted-foreground/40 sm:text-[10rem]">404</span>
        <h1 className="pub-title text-[2.5rem] sm:text-[4rem]">Nie ma takiego turnieju</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Sprawdź adres <span className="text-foreground">/t/liga-osiedlowa-2025</span>. Turniej mógł zostać usunięty albo jeszcze nie jest opublikowany.
        </p>
      </main>
    </PublicRoot>
  )
}

/** Nieznana podstrona: zamiast jednego odnośnika od razu wszystkie zakładki turnieju. */
function NoPage({ data }: { data: Season }) {
  return (
    <EmptyBoard title="Nie ma takiej strony" action={<TabLinks tabs={data.tabs} />}>
      Sprawdź adres albo przejdź do jednej z zakładek turnieju.
    </EmptyBoard>
  )
}

function TabLinks({ tabs }: { tabs: readonly PublicNavKey[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((key) => (
        <DeadLink key={key} className="inline-flex min-h-11 items-center rounded-md bg-card px-4 pub-tab text-base ring-1 ring-inset ring-border hover:bg-muted">
          {TAB_LABELS[key]}
        </DeadLink>
      ))}
    </div>
  )
}

/** Szkielet w kształcie ekranu: nagłówek tablicy i wiersze, pulsuje tło wnęki. */
function Loading() {
  const block = 'rounded-md bg-sunken motion-safe:animate-pulse'
  return (
    <div role="status" aria-label="Wczytywanie terminarza" className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <span className={cn(block, 'h-4 w-24')} />
        <span className={cn(block, 'h-14 w-72 sm:h-16')} />
      </div>
      <div className="flex flex-col gap-2">
        <span className={cn(block, 'mb-2 h-8 w-48')} />
        {Array.from({ length: 6 }, (_, index) => <span key={index} className={cn(block, 'h-14 w-full')} />)}
      </div>
    </div>
  )
}

export function SystemScreen({ data, accent, state }: { data: Season; accent: string; state: SystemState }) {
  if (state === 'turniej') return <NoTournament accent={accent} />
  return (
    <Shell tournament={data.tournament} tabs={data.tabs} active={state === 'blad' || state === 'ladowanie' ? 'fixtures' : undefined} accent={accent}>
      {state === 'strona' && <NoPage data={data} />}
      {state === 'mecz' && (
        <EmptyBoard title="Nie ma takiego meczu" action={<TextLink>Wróć do terminarza</TextLink>}>
          Mecz mógł zostać usunięty z terminarza albo adres jest niepełny.
        </EmptyBoard>
      )}
      {state === 'blad' && (
        <>
          <PageHead title="Terminarz" />
          <EmptyBoard title="Nie udało się wczytać terminarza" action={<PubButton>Spróbuj ponownie</PubButton>}>
            Brak połączenia z serwerem. Sprawdź internet i spróbuj jeszcze raz.
          </EmptyBoard>
        </>
      )}
      {state === 'ladowanie' && <Loading />}
    </Shell>
  )
}
