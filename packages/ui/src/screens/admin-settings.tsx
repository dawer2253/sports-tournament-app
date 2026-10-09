import * as React from 'react'
import { AlertTriangle, Trash2, Upload } from 'lucide-react'
import { TournamentShellDemo } from './shell-demo'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { BrandColorPicker, DEFAULT_BRAND_COLOR } from '../components/ui/brand-color-picker'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Separator } from '../components/ui/separator'
import { Heading } from '../components/ui/typography'
import { TiebreakerList } from '../components/data/tiebreaker-list'
import { TournamentStatusCard } from '../components/data/tournament-status-card'
import type { TournamentRow } from '../components/data/tournament-row'
import { TournamentLogo } from '../components/layout/tournament-logo'
import { sportSettings, tournament } from '../lib/demo-data'

/** Panel zna adres strony publicznej z `VITE_PUBLIC_URL` (#91 pkt 3). */
const PUBLIC_ORIGIN = 'http://localhost:5174'

export interface AdminSettingsProps {
  status?: TournamentRow['status']
  sport?: keyof typeof sportSettings
  /** `branding.logoUrl`: `null` bez wgranego logo. */
  logoUrl?: string | null
  primaryColor?: string
  /** Slug w polu formularza. Zapisany slug to ten z danych demo. */
  slug?: string
}

/**
 * Ustawienia turnieju (#91). Trzy miejsca zapisu: status od razu z karty,
 * logo w oknie z własnym „Zapisz", reszta jednym „Zapisz zmiany" na końcu
 * formularza. Pola trzymają stan lokalnie, żeby makieta reagowała na klik.
 */
export function AdminSettings({
  status = 'active',
  sport = 'football',
  logoUrl = null,
  primaryColor = DEFAULT_BRAND_COLOR,
  slug: initialSlug = tournament.slug,
}: AdminSettingsProps) {
  const config = sportSettings[sport]
  const [color, setColor] = React.useState(primaryColor)
  const [slug, setSlug] = React.useState(initialSlug)
  const [points, setPoints] = React.useState(config.defaultPoints)
  // Jak w `ImageWithFallback`: pamiętamy adres, który zawiódł, a nie flagę.
  const [failedLogoUrl, setFailedLogoUrl] = React.useState<string | null>(null)

  // W szkicu strona i tak daje `404`, więc ostrzeżenie tylko w opublikowanym.
  const slugWarning = status !== 'draft' && slug !== tournament.slug
  const pointFields: { key: keyof typeof points; label: string }[] = [
    { key: 'win', label: 'Wygrana' },
    // W sporcie bez remisów pola nie ma, a aplikacja wysyła `draw: 0` (#91 pkt 7).
    ...(config.allowsDraw ? [{ key: 'draw' as const, label: 'Remis' }] : []),
    { key: 'loss', label: 'Porażka' },
  ]

  return (
    <TournamentShellDemo active="settings" status={status} sportName={config.name}>
      <div className="max-w-2xl space-y-6">
        <TournamentStatusCard
          status={status}
          onChange={() => {}}
          publicUrl={`${PUBLIC_ORIGIN}/t/${tournament.slug}`}
        />

        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>PNG, JPG lub WebP, do 2 MB, od 64×64 do 4096×4096 px.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <TournamentLogo
              logoUrl={logoUrl}
              color={color}
              onError={() => setFailedLogoUrl(logoUrl)}
              className="size-16"
            />
            <div className="grid gap-2">
              {logoUrl !== null && failedLogoUrl === logoUrl && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <AlertTriangle className="size-4" /> Nie udało się wczytać logo
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline">
                  <Upload className="size-4" /> {logoUrl ? 'Zmień logo' : 'Wgraj logo'}
                </Button>
                {logoUrl && (
                  <Button variant="ghost">
                    <Trash2 className="size-4" /> Usuń logo
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={(event) => event.preventDefault()}>
          <Card>
            <CardContent className="space-y-6">
              <section className="space-y-4">
                <Heading level="card">Dane</Heading>
                <div className="space-y-2">
                  <Label htmlFor="name">Nazwa</Label>
                  <Input id="name" defaultValue={tournament.name} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Adres strony</Label>
                  <div className="flex items-center rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                    <span className="px-2.5 text-sm text-muted-foreground select-none">/t/</span>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(event) => setSlug(event.target.value)}
                      aria-describedby={slugWarning ? 'slug-warning' : undefined}
                      className="rounded-l-none border-0 pl-0 focus-visible:ring-0"
                    />
                  </div>
                  {slugWarning && (
                    <div
                      id="slug-warning"
                      role="status"
                      className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3 text-sm"
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <p>
                        Dotychczasowy adres /t/{tournament.slug} przestanie działać. Przekierowania nie będzie.
                      </p>
                    </div>
                  )}
                </div>
              </section>

              <Separator />

              <section className="space-y-4">
                <Heading level="card">Wygląd</Heading>
                <BrandColorPicker value={color} onChange={setColor} />
              </section>

              <Separator />

              <section className="space-y-4">
                <Heading level="card">Punktacja</Heading>
                <div className="flex flex-wrap items-end gap-4">
                  {pointFields.map((field) => (
                    <div key={field.key} className="w-24 space-y-2">
                      <Label htmlFor={`points-${field.key}`}>{field.label}</Label>
                      <Input
                        id={`points-${field.key}`}
                        type="number"
                        min={0}
                        value={points[field.key]}
                        onChange={(event) => setPoints({ ...points, [field.key]: Number(event.target.value) })}
                      />
                    </div>
                  ))}
                  {/* Ustawia pola i niczego nie zapisuje. */}
                  <Button type="button" variant="link" onClick={() => setPoints(config.defaultPoints)}>
                    Przywróć domyślne dla sportu
                  </Button>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Kolejność rozstrzygania remisów w tabeli</p>
                  <TiebreakerList items={config.tiebreakers} />
                </div>
              </section>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="submit">Zapisz zmiany</Button>
            </CardFooter>
          </Card>
        </form>

        <Card className="ring-destructive/40">
          <CardHeader>
            <CardTitle>Strefa zagrożenia</CardTitle>
            <CardDescription>Usunięcie turnieju kasuje drużyny, mecze i wyniki. Tego nie da się cofnąć.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive">
              <Trash2 className="size-4" /> Usuń turniej
            </Button>
          </CardContent>
        </Card>
      </div>
    </TournamentShellDemo>
  )
}
