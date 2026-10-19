import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'
import { LiveMarker } from '../components/layout/live-marker'
import { LiveMatchTile } from '../components/data/live-match-tile'
import { MatchRow, MatchStatusBadge } from '../components/data/match-row'
import type { MatchRowData } from '../components/data/match-row-data'
import { Button, buttonVariants } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { textContrast } from '../test/theme'

/** Mecz trwający z wynikiem: jego wynik stoi na `bg-destructive`. */
const LIVE_MATCH: MatchRowData & { round: { name: string } } = {
  id: 1,
  homeTeam: { id: 1, name: 'Rysie Mokotów' },
  awayTeam: { id: 2, name: 'Żubry Wola' },
  homeScore: 75,
  awayScore: 75,
  status: 'live',
  kickoffAt: '2026-09-13T16:00:00Z',
  venue: { id: 1, name: 'Hala Bemowo' },
  round: { name: 'Kolejka 2' },
}

/**
 * Każde miejsce, w którym `destructive` niesie tekst: jako kolor tekstu na
 * karcie i na własnym półprzezroczystym tle (przycisk, plakietka) oraz jako
 * tło pod `destructive-foreground` (wynik meczu na żywo, przycisk usuwania
 * po najechaniu). „Na żywo” w kaflu Przeglądu stoi na zielonkawym
 * `primary/5`, czyli na tle innym niż karta.
 */
function DestructiveSamples() {
  return (
    <Card className="max-w-xl">
      <CardContent className="space-y-4">
        <LiveMarker data-testid="na-zywo" />
        <p data-testid="blad-pola" className="text-sm text-destructive">
          Nazwa jest wymagana.
        </p>
        <MatchStatusBadge status="live" />
        <Button variant="destructive">Usuń turniej</Button>
        {/* Przycisk usuwania po najechaniu: `:hover` nie da się włączyć z `play`,
            więc stan stoi tu klasami, a `play` pilnuje, że wariant używa tych samych. */}
        <span data-testid="hover-usuwania" className="inline-flex rounded-lg bg-destructive px-2.5 py-1.5 text-sm font-medium text-destructive-foreground">
          Usuń turniej
        </span>
        <MatchRow match={LIVE_MATCH} timeZone="Europe/Warsaw" />
        <LiveMatchTile match={LIVE_MATCH} />
      </CardContent>
    </Card>
  )
}

const meta = {
  title: 'Panel/Fundamenty/Kontrast stanu destructive',
  component: DestructiveSamples,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DestructiveSamples>

export default meta
type Story = StoryObj<typeof meta>

/** Próg WCAG AA dla zwykłego tekstu; wszystkie próbki to tekst do 14 px. */
const AA = 4.5

/** Klasy stanu `hover` wariantu `destructive` przycisku, bez prefiksów `hover:` i `dark:hover:`. */
function destructiveHoverClasses(): string[] {
  const hover = buttonVariants({ variant: 'destructive' })
    .split(' ')
    .filter((name) => /^(dark:)?hover:/.test(name))
    .map((name) => name.replace(/^(dark:)?hover:/, ''))
  return [...new Set(hover)].toSorted()
}

const play: Story['play'] = async ({ canvasElement }) => {
  await expect(destructiveHoverClasses()).toEqual(['bg-destructive', 'text-destructive-foreground'])
  const canvas = within(canvasElement)
  // Przycisk ma `transition-all`; po zmianie motywu odczyt łapałby stan pośredni.
  for (const element of canvasElement.querySelectorAll<HTMLElement>('*')) element.style.transition = 'none'

  const samples: Record<string, HTMLElement> = {
    'Na żywo': canvas.getByTestId('na-zywo'),
    'błąd pola': canvas.getByTestId('blad-pola'),
    'plakietka „Trwa”': canvas.getAllByText('Trwa')[0]!,
    'przycisk usuwania': canvas.getByRole('button', { name: 'Usuń turniej' }),
    'wynik meczu na żywo': canvasElement.querySelector<HTMLElement>('[data-slot="match-score"]')!,
    'przycisk usuwania po najechaniu': canvas.getByTestId('hover-usuwania'),
    '„Na żywo” w kaflu meczu': within(canvas.getByRole('article')).getByText('Na żywo'),
  }
  for (const [name, element] of Object.entries(samples)) {
    await expect(textContrast(element), `kontrast: ${name}`).toBeGreaterThanOrEqual(AA)
  }
}

export const Jasny: Story = { globals: { theme: 'light' }, play }

/** Ciemny motyw: czerwień jest jaśniejsza, a tekst na niej ciemny, wzorem `primary`. */
export const Ciemny: Story = { globals: { theme: 'dark' }, play }
