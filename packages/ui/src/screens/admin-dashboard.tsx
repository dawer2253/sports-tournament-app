import { Plus, Trophy, ArrowUpRight } from 'lucide-react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

const stats = [
  { label: 'Aktywne turnieje', value: '2' },
  { label: 'Drużyny', value: '24' },
  { label: 'Mecze (30 dni)', value: '38' },
  { label: 'Odsłony public', value: '1 204' },
]

const items = [
  { icon: '⚽', name: 'Liga Osiedlowa 2026', meta: 'Piłka nożna · Liga · 8 drużyn', status: 'Trwa', variant: 'default' as const, progress: 36, foot: 'Kolejka 5 / 14 · /t/liga-osiedlowa' },
  { icon: '🏀', name: 'Puchar Miasta — Kosz', meta: 'Koszykówka · Puchar · 16 drużyn', status: 'Szkic', variant: 'secondary' as const, progress: 0, foot: 'Terminarz niewygenerowany' },
  { icon: '⚽', name: 'Turniej Zimowy', meta: 'Piłka nożna · Grupy + playoff', status: 'Zakończony', variant: 'outline' as const, progress: 100, foot: 'Zwycięzca: FC Górka' },
]

export function AdminDashboard() {
  return (
    <AdminShell
      active="dashboard"
      title="Twoje turnieje"
      subtitle="Zarządzaj ligami i turniejami"
      actions={<Button><Plus className="size-4" /> Nowy turniej</Button>}
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="mt-1 text-2xl font-bold">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <Card key={t.name} className="cursor-pointer p-5 transition-shadow hover:shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-xl">{t.icon}</div>
              <Badge variant={t.variant}>{t.status}</Badge>
            </div>
            <h3 className="flex items-center gap-1 font-semibold">
              {t.name} <ArrowUpRight className="size-4 text-muted-foreground" />
            </h3>
            <p className="text-sm text-muted-foreground">{t.meta}</p>
            {t.progress > 0 && t.progress < 100 && <Progress value={t.progress} className="mt-3 h-1.5" />}
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              {t.status === 'Zakończony' && <Trophy className="size-3.5 text-primary" />}
              {t.foot}
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  )
}
