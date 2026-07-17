import { cn } from '@/lib/utils'

/**
 * Żywe próbki kolorów — renderują się z realnych zmiennych motywu (`var(--…)`),
 * więc zawsze pokazują aktualny stan po zmianie tematu jasny/ciemny.
 * Używane w „Fundamenty / Kolory".
 */

type Token = {
  name: string
  /** klasa tła, np. `bg-primary` */
  bg: string
  /** klasa tekstu pary foreground, np. `text-primary-foreground` */
  fg?: string
  role: string
}

function Swatch({ name, bg, fg, role }: Token) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'flex h-20 items-end justify-between rounded-md p-2.5 ring-1 ring-inset ring-border',
          bg,
        )}
      >
        {fg && <span className={cn('text-sm font-semibold', fg)}>Aa</span>}
      </div>
      <div className="leading-tight">
        <div className="text-sm font-medium text-foreground">{name}</div>
        <div className="mt-1 text-xs text-muted-foreground">{role}</div>
      </div>
    </div>
  )
}

function Group({ title, tokens }: { title: string; tokens: Token[] }) {
  return (
    <section className="mb-8">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {tokens.map((t) => (
          <Swatch key={t.name} {...t} />
        ))}
      </div>
    </section>
  )
}

export function Palette() {
  return (
    <div className="font-sans text-foreground">
      <Group
        title="Powierzchnie"
        tokens={[
          { name: 'background', bg: 'bg-background', fg: 'text-foreground', role: 'Tło treści aplikacji' },
          { name: 'card', bg: 'bg-card', fg: 'text-card-foreground', role: 'Karty i elementy wyniesione' },
          { name: 'popover', bg: 'bg-popover', fg: 'text-popover-foreground', role: 'Menu, dropdowny, tooltipy' },
          { name: 'muted', bg: 'bg-muted', fg: 'text-muted-foreground', role: 'Tła pomocnicze, tekst drugorzędny' },
        ]}
      />
      <Group
        title="Marka"
        tokens={[
          { name: 'primary', bg: 'bg-primary', fg: 'text-primary-foreground', role: 'Akcje główne, aktywne stany, linki, focus' },
          { name: 'brand', bg: 'bg-brand', fg: 'text-brand-foreground', role: 'Nagłówek strony publicznej (konfigurowalny per turniej)' },
        ]}
      />
      <Group
        title="Akcenty i stany"
        tokens={[
          { name: 'secondary', bg: 'bg-secondary', fg: 'text-secondary-foreground', role: 'Neutralne przyciski/znaczniki drugorzędne' },
          { name: 'accent', bg: 'bg-accent', fg: 'text-accent-foreground', role: 'Hover i delikatne wyróżnienia' },
          { name: 'destructive', bg: 'bg-destructive', fg: 'text-destructive-foreground', role: 'Błędy, usuwanie, kolizje' },
        ]}
      />
      <Group
        title="Obrysy i focus"
        tokens={[
          { name: 'border', bg: 'bg-border', role: 'Obrysy kart, separatory' },
          { name: 'input', bg: 'bg-input', role: 'Obrysy pól formularzy' },
          { name: 'ring', bg: 'bg-ring', role: 'Pierścień focus (nawigacja klawiaturą)' },
        ]}
      />
      <Group
        title="Panel admina (sidebar)"
        tokens={[
          { name: 'sidebar', bg: 'bg-sidebar', fg: 'text-sidebar-foreground', role: 'Tło panelu bocznego' },
          { name: 'sidebar-accent', bg: 'bg-sidebar-accent', fg: 'text-sidebar-accent-foreground', role: 'Aktywny / hover element nawigacji' },
          { name: 'sidebar-border', bg: 'bg-sidebar-border', role: 'Obrys panelu bocznego' },
        ]}
      />
      <Group
        title="Dane / wykresy"
        tokens={[
          { name: 'chart-1', bg: 'bg-chart-1', role: 'Zieleń marki' },
          { name: 'chart-2', bg: 'bg-chart-2', role: 'Morski' },
          { name: 'chart-3', bg: 'bg-chart-3', role: 'Niebieski' },
          { name: 'chart-4', bg: 'bg-chart-4', role: 'Bursztyn' },
          { name: 'chart-5', bg: 'bg-chart-5', role: 'Fiolet' },
        ]}
      />
    </div>
  )
}

export function RadiusScale() {
  const items: { name: string; cls: string; note: string }[] = [
    { name: 'sm', cls: 'rounded-sm', note: 'znaczniki, drobne elementy' },
    { name: 'md', cls: 'rounded-md', note: 'pola, pozycje nawigacji' },
    { name: 'lg — bazowy', cls: 'rounded-lg', note: 'przyciski, karty (--radius: 0.375rem)' },
    { name: 'xl', cls: 'rounded-xl', note: 'większe kontenery' },
  ]
  return (
    <div className="grid grid-cols-2 gap-5 font-sans sm:grid-cols-4">
      {items.map((r) => (
        <div key={r.name} className="flex flex-col gap-2">
          <div className={cn('h-16 border-2 border-primary/30 bg-primary/10', r.cls)} />
          <div className="leading-tight">
            <div className="text-sm font-medium text-foreground">{r.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">{r.note}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
