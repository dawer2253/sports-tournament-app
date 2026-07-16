import { Plus, MapPin, Pencil, Trash2 } from 'lucide-react'
import { AdminShell } from '@/components/layout/admin-shell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { venues } from '@/lib/demo-data'

export function AdminVenues() {
  return (
    <AdminShell
      active="venues"
      title="Obiekty"
      subtitle="Miejsca rozgrywania meczów"
      actions={<Button><Plus className="size-4" /> Dodaj obiekt</Button>}
    >
      <Card className="p-0">
        <Table>
          <TableHeader className="[&_th]:h-9 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="pl-4">Nazwa</TableHead>
              <TableHead>Adres</TableHead>
              <TableHead className="w-20 text-right">Mecze</TableHead>
              <TableHead className="w-24 pr-4 text-right sr-only">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {venues.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="pl-4 font-medium">
                  <span className="flex items-center gap-2">
                    <MapPin className="size-4 text-muted-foreground" />
                    {v.name}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{v.address}</TableCell>
                <TableCell className="text-right tabular-nums">{v.matches}</TableCell>
                <TableCell className="pr-4">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" aria-label={`Edytuj ${v.name}`}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Usuń ${v.name}`}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </AdminShell>
  )
}
