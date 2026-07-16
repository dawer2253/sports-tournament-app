import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const FONTS = [
  { name: 'Inter', stack: "'Inter', sans-serif", note: 'Neutralny, klasyczny, świetne cyfry tabularne. Bezpieczny standard.' },
  { name: 'Geist', stack: "'Geist', sans-serif", note: 'Nowoczesny, techniczny, ciasny. Czysty „design-system".' },
  { name: 'IBM Plex Sans', stack: "'IBM Plex Sans', sans-serif", note: 'Charakter inżynierski, wyrazisty bez dziwactw.' },
  { name: 'Archivo', stack: "'Archivo', sans-serif", note: 'Sportowy, redakcyjny sznyt — mocne nagłówki.' },
  { name: 'Space Grotesk', stack: "'Space Grotesk', sans-serif", note: 'Techniczny, wyróżniający się. Nietypowy.' },
]

function Sample({ name, stack, note }: { name: string; stack: string; note: string }) {
  return (
    <div className="rounded-xl border bg-card p-5" style={{ fontFamily: stack }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary" style={{ fontFamily: 'ui-monospace, monospace' }}>
          {name}
        </span>
        <Badge>Podgląd</Badge>
      </div>
      <h2 className="text-2xl font-extrabold tracking-tight">Liga Osiedlowa 2026</h2>
      <p className="text-sm text-muted-foreground">Sezon 2025/2026 · 8 drużyn · piłka nożna</p>

      <div className="my-4 flex items-center gap-3">
        <span className="font-medium">FC Górka</span>
        <span className="rounded-[3px] bg-foreground px-2.5 py-1 text-sm font-semibold tabular-nums text-background">
          2 : 1
        </span>
        <span className="font-medium text-muted-foreground">Dragons</span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge>Zakończony</Badge>
        <Badge variant="secondary">Zaplanowany</Badge>
        <Badge variant="destructive">Kolizja boiska</Badge>
        <Badge variant="outline">1 234 pkt</Badge>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Zwinny lis przeskoczył płot, a bramkarz łapał każdą piłkę. 0123456789 — punkty, bramki, minuty.
      </p>

      <div className="flex gap-2">
        <Button size="sm">Generuj terminarz</Button>
        <Button size="sm" variant="outline">Podgląd</Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground" style={{ fontFamily: "'Inter', sans-serif" }}>{note}</p>
    </div>
  )
}

function TypographyProposals() {
  return (
    <div className="min-h-screen bg-muted/40 p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-xl font-bold">Typografia — propozycje fontu</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Ten sam fragment UI w kilku fontach. Wybierz, który adoptujemy jako główny (`--font-sans`).
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {FONTS.map((f) => (
            <Sample key={f.name} {...f} />
          ))}
        </div>
      </div>
    </div>
  )
}

const meta = {
  title: 'Design/Typografia — propozycje',
  component: TypographyProposals,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TypographyProposals>

export default meta
type Story = StoryObj<typeof meta>

export const Propozycje: Story = {}
