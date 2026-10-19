/**
 * Ekran „Nie znaleziono i błędy” strony publicznej: brak turnieju, nieznana
 * podstrona, brak meczu, błąd wczytywania i wczytywanie. Komponenty z danymi
 * w propsach (#289 pkt 8): story podaje demo, a strona w `apps/public` tylko
 * pobiera dane i wybiera stan.
 *
 * Brak turnieju i błąd turnieju stoją bez shella (`StandaloneShell`), reszta
 * w shellu turnieju.
 */
import { DEFAULT_BRAND_COLOR } from '../../lib/brand-on-dark'
import { ErrorBoard, EmptyBoard } from '../board'
import { Button, TextLink } from '../button'
import { PageHead } from '../heads'
import { TAB_LABELS, type PublicNavKey } from '../public-nav'
import { StandaloneShell } from '../shell'
import { Loading } from '../skeleton'

/**
 * Brak turnieju: bez shella, z samym „TournamentApp” w pasku, na domyślnej
 * zieleni, bo turnieju i jego koloru nie ma. `path` to adres, pod który wszedł
 * kibic (np. `/t/liga-osiedlowa-2025`).
 */
export function TournamentNotFound({ path }: { path: string }) {
  return (
    <StandaloneShell primaryColor={DEFAULT_BRAND_COLOR}>
      <span aria-hidden className="pub-score text-[6rem] text-muted-foreground/40 sm:text-[7.5rem]">
        404
      </span>
      <h1 className="pub-title sm:text-[4rem]">Nie ma takiego turnieju</h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Sprawdź adres <span className="break-all text-foreground">{path}</span>. Turniej mógł zostać usunięty albo jeszcze nie jest opublikowany.
      </p>
    </StandaloneShell>
  )
}

/** Błąd wczytywania turnieju: bez shella, bo nazwy i koloru turnieju nie ma. */
export function TournamentLoadError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <StandaloneShell primaryColor={DEFAULT_BRAND_COLOR}>
      <h1 className="sr-only">TournamentApp</h1>
      <ErrorBoard title="Nie udało się wczytać turnieju" message={message} onRetry={onRetry} />
    </StandaloneShell>
  )
}

/** Wczytywanie turnieju: bez shella, szkielet w kształcie strony turnieju. */
export function TournamentLoading() {
  return (
    <StandaloneShell primaryColor={DEFAULT_BRAND_COLOR}>
      <Loading label="Wczytywanie turnieju" className="w-full self-stretch" />
    </StandaloneShell>
  )
}

/** Adres strony spoza `/t/:slug`: bez shella i bez zakładek. */
export function SiteNotFound() {
  return (
    <StandaloneShell primaryColor={DEFAULT_BRAND_COLOR}>
      <h1 className="sr-only">TournamentApp</h1>
      <EmptyBoard title="Nie ma takiej strony">Sprawdź adres. Strona turnieju otwiera się pod adresem /t/nazwa-turnieju.</EmptyBoard>
    </StandaloneShell>
  )
}

/**
 * Nieznana podstrona turnieju (w shellu, bez aktywnej zakładki): zamiast
 * jednego odnośnika od razu wszystkie zakładki **tego** turnieju
 * (`publicTabs(stages)`, więc puchar bez Tabeli).
 */
export function PageNotFound({
  tabs,
  navHref,
  onNavigate,
}: {
  tabs: readonly PublicNavKey[]
  navHref?: (key: PublicNavKey) => string | undefined
  onNavigate?: (key: PublicNavKey) => void
}) {
  return (
    <EmptyBoard
      title="Nie ma takiej strony"
      action={
        <nav aria-label="Zakładki turnieju" className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button key={tab} href={navHref?.(tab) ?? ''} onNavigate={onNavigate && (() => onNavigate(tab))}>
              {TAB_LABELS[tab]}
            </Button>
          ))}
        </nav>
      }
    >
      Sprawdź adres albo przejdź do jednej z zakładek turnieju.
    </EmptyBoard>
  )
}

/** Brak meczu (w shellu): odnośnik do Terminarza. */
export function MatchNotFound({ fixturesHref, onNavigate }: { fixturesHref?: string; onNavigate?: () => void }) {
  return (
    <EmptyBoard
      title="Nie ma takiego meczu"
      action={
        <TextLink href={fixturesHref} onNavigate={onNavigate}>
          Wróć do terminarza
        </TextLink>
      }
    >
      Mecz mógł zostać usunięty z terminarza albo adres jest niepełny.
    </EmptyBoard>
  )
}

/**
 * Błąd wczytywania zakładki (w shellu): nagłówek ekranu i tablica błędu
 * z treścią błędu i „Spróbuj ponownie”. `label` to dopełniacz nazwy treści,
 * np. „terminarza”.
 */
export function LoadError({ title, label, message, onRetry }: { title?: string; label: string; message: string; onRetry: () => void }) {
  return (
    <>
      {title && <PageHead title={title} />}
      <ErrorBoard title={`Nie udało się wczytać ${label}`} message={message} onRetry={onRetry} />
    </>
  )
}

/** Wczytywanie zakładki (w shellu): szkielet w kształcie ekranu. */
export function LoadingScreen({ label }: { label: string }) {
  return <Loading label={`Wczytywanie ${label}`} />
}
