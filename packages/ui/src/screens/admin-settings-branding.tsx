import { Upload, GripVertical } from 'lucide-react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { tournament, tiebreakers } from '@/lib/demo-data'

const brandSwatches = [
  { key: 'primary', className: 'bg-primary', selected: true },
  { key: 'secondary', className: 'bg-secondary', selected: false },
  { key: 'accent', className: 'bg-accent', selected: false },
  { key: 'chart-4', className: 'bg-chart-4', selected: false },
  { key: 'destructive', className: 'bg-destructive', selected: false },
]

export function AdminSettingsBranding() {
  return (
    <AdminShell
      active="branding"
      title="Branding i ustawienia"
      subtitle={tournament.name}
      actions={<Button>Zapisz zmiany</Button>}
    >
      <div className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="public-name">Nazwa publiczna</Label>
              <Input id="public-name" defaultValue={tournament.name} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <div className="flex items-center rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <span className="px-2.5 text-sm text-muted-foreground select-none">/t/</span>
                <Input
                  id="slug"
                  defaultValue={tournament.slug}
                  className="rounded-l-none border-0 pl-0 focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kolor wiodący</Label>
              <div className="flex items-center gap-3">
                {brandSwatches.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    aria-label={`Kolor ${s.key}`}
                    aria-pressed={s.selected}
                    className={`size-8 rounded-full ${s.className} ${
                      s.selected ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="grid place-items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center">
                <Upload className="size-6 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Przeciągnij logo lub kliknij</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tiebreaki — priorytety</CardTitle>
            <CardDescription>Kolejność decyduje o rozstrzyganiu remisów.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {tiebreakers.map((t, i) => (
                <li
                  key={t.key}
                  className="flex items-center gap-3 rounded-md border border-border p-3"
                >
                  <GripVertical className="size-4 cursor-grab text-muted-foreground" />
                  <span className="grid size-6 place-items-center rounded bg-muted text-xs font-medium tabular-nums">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">{t.label}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Przykład: w Premier League wyżej różnica bramek, w La Liga wyżej bezpośredni mecz.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button>Zapisz zmiany</Button>
        </div>
      </div>
    </AdminShell>
  )
}
