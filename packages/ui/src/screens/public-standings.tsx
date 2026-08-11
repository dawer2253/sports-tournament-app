import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PublicShell } from '@/components/layout/public-shell'
import { PhotoPanel } from '@/components/layout/photo-panel'
import { MetaList } from '@/components/layout/meta-list'
import { TeamCrest } from '@/components/layout/team-crest'
import { Heading } from '@/components/ui/typography'
import { cn } from '@/lib/utils'
import { standings, formColor } from '@/lib/demo-data'
import fieldImg from '@/assets/public/field.webp'

// Ile miejsc premiuje awansem — docelowo z ustawień turnieju.
const PROMOTED = 4

export function PublicStandings() {
  return (
    <PublicShell active="standings">
      <PhotoPanel src={fieldImg} className="mb-5 rounded-xl px-5 py-4">
        <Heading level="section" className="text-current drop-shadow-sm">
          Tabela ligowa
        </Heading>
        <MetaList className="mt-0.5 text-sm text-brand-foreground/85 drop-shadow-sm">
          <>{standings.length} drużyn</>
          <>{PROMOTED} awansuje do fazy pucharowej</>
        </MetaList>
      </PhotoPanel>

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
              <TableRow key={r.team.id}>
                {/* Strefa awansu to pasmo, nie cecha pojedynczego wiersza —
                    ciągła kreska na krawędzi czyta się jak klamra obejmująca
                    miejsca 1–{PROMOTED}, plakietka przy każdej liczbie nie. */}
                <TableCell
                  className={cn(
                    'relative font-semibold tabular-nums',
                    r.pos <= PROMOTED &&
                      'before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary',
                  )}
                >
                  <span className="pl-2">{r.pos}</span>
                </TableCell>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    <TeamCrest abbr={r.team.abbr} />
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
        Sortowanie: pkt → bezpośredni mecz → różnica bramek → bramki zdobyte. Zielona kreska przy pozycji oznacza strefę awansu do fazy pucharowej.
      </p>
    </PublicShell>
  )
}
