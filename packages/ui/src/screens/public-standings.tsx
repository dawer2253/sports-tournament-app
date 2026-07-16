import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PublicShell } from '@/components/layout/public-shell'
import { standings, formColor } from '@/lib/demo-data'

export function PublicStandings() {
  return (
    <PublicShell active="standings">
      <div className="rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader className="[&_th]:h-9 [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground">
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className="w-10">#</TableHead>
              <TableHead>Drużyna</TableHead>
              <TableHead className="w-10 text-center">M</TableHead>
              <TableHead className="w-10 text-center">W</TableHead>
              <TableHead className="w-10 text-center">R</TableHead>
              <TableHead className="w-10 text-center">P</TableHead>
              <TableHead className="w-16 text-center">Bramki</TableHead>
              <TableHead className="w-12 text-center !text-foreground">Pkt</TableHead>
              <TableHead className="w-24">Forma</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {standings.map((r) => (
              <TableRow key={r.team.id} className={r.pos === 1 ? 'bg-primary/5' : ''}>
                <TableCell>
                  {r.pos <= 3 ? (
                    <span className="grid size-6 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                      {r.pos}
                    </span>
                  ) : (
                    <span className="pl-2 font-semibold">{r.pos}</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    <span className="grid size-6 place-items-center rounded bg-muted text-[10px] font-bold">
                      {r.team.abbr}
                    </span>
                    {r.team.name}
                  </span>
                </TableCell>
                <TableCell className="text-center">{r.p}</TableCell>
                <TableCell className="text-center">{r.w}</TableCell>
                <TableCell className="text-center">{r.d}</TableCell>
                <TableCell className="text-center">{r.l}</TableCell>
                <TableCell className="text-center tabular-nums text-muted-foreground">
                  {r.gf}:{r.ga}
                </TableCell>
                <TableCell className="text-center font-bold">{r.pts}</TableCell>
                <TableCell>
                  <span className="flex gap-0.5">
                    {r.form.map((f, i) => (
                      <span key={i} className={`size-2 rounded-full ${formColor[f]}`} title={f} />
                    ))}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Sortowanie: pkt → bezpośredni mecz → różnica bramek → bramki zdobyte. Zielone pozycje — strefa awansu do fazy pucharowej.
      </p>
    </PublicShell>
  )
}
