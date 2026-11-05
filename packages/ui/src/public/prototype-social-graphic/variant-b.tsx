/*
  PROTOTYP (#324) — wariant B „Plakat”. Cały kadr w kolorze turnieju
  (`pub-brand-fill`), jedna ogromna rzecz (nazwy, wynik, liczba lidera)
  wyrównana do lewej, dane na ciemnej skośnej płycie u dołu. Najdalej od S7,
  najbardziej „social”.
*/
import { cn } from '../../lib/utils'
import { Crest } from '../crest'
import { TournamentLogo } from '../tournament-logo'
import { STANDINGS_LIMIT, type GLeaderboard, type GPreview, type GResult, type GStandings } from './data'
import { DENSITY, contentPadding, scorerText, useFit, type LayoutCtx, type VariantProps } from './shared'

export const name = 'Plakat'

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="font-display text-pub-16 font-bold uppercase tracking-[0.12em] opacity-80">{children}</p>
}

/** Ciemna płyta ze skośną górną krawędzią. */
function Slab({ children, className, ctx }: { children: React.ReactNode; className?: string; ctx: LayoutCtx }) {
  const pad = contentPadding(ctx)
  return (
    <div
      className={cn('relative mt-auto bg-background text-foreground', className)}
      style={{ clipPath: 'polygon(0 22px, 100% 0, 100% 100%, 0 100%)', padding: `34px ${pad.side}px ${pad.bottom}px`, marginLeft: -pad.side, marginRight: -pad.side }}
    >
      {children}
    </div>
  )
}

function Preview({ value, ctx }: { value: GPreview; ctx: LayoutCtx }) {
  return (
    <>
      <div className="relative flex flex-1 flex-col justify-center gap-1">
        <Kicker>Zapowiedź · {value.roundName}</Kicker>
        <p className="pub-title text-pub-40 leading-[0.95] wrap-break-word">{value.home.name}</p>
        <p className="font-display text-pub-20 font-bold opacity-70">vs</p>
        <p className="pub-title text-pub-40 leading-[0.95] wrap-break-word">{value.away.name}</p>
      </div>
      <Slab ctx={ctx}>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="pub-score text-pub-64">{value.kickoff.split(' · ')[1]}</p>
            <p className="mt-1 text-pub-14 text-muted-foreground">{value.kickoff.split(' · ')[0]}</p>
            {value.venue && <p className="text-pub-14 font-medium">{value.venue}</p>}
          </div>
          <div className="flex -space-x-3">
            <Crest name={value.home.name} logoUrl={value.home.logoUrl} className="size-14" />
            <Crest name={value.away.name} logoUrl={value.away.logoUrl} className="size-14" />
          </div>
        </div>
      </Slab>
    </>
  )
}

function Result({ value, ctx }: { value: GResult; ctx: LayoutCtx }) {
  return (
    <>
      <div className="relative flex flex-1 flex-col justify-center">
        <Kicker>
          Wynik · {value.roundName}
        </Kicker>
        <p className="pub-score text-pub-120 leading-[0.9]">
          {value.homeScore}–{value.awayScore}
        </p>
        {value.penalties && (
          <p className="font-display text-pub-20 font-bold">
            karne {value.penalties[0]}:{value.penalties[1]}
          </p>
        )}
        {value.sets && (
          <p className="pub-num text-pub-16 opacity-80">{value.sets.map(([h, a]) => `${h}:${a}`).join('  ')}</p>
        )}
      </div>
      <Slab ctx={ctx}>
        {[
          { team: value.home, scorers: value.scorers?.home },
          { team: value.away, scorers: value.scorers?.away },
        ].map(({ team, scorers }, i) => (
          <div key={i} className={cn('flex gap-3', i === 1 && 'mt-3 border-t border-hairline pt-3')}>
            <Crest name={team.name} logoUrl={team.logoUrl} className="size-9" />
            <div className="min-w-0">
              <p className="pub-title text-pub-20 leading-tight">{team.name}</p>
              {scorers && scorers.length > 0 && (
                <p className="text-pub-13 text-muted-foreground">{scorers.map(scorerText).join(', ')}</p>
              )}
            </div>
          </div>
        ))}
      </Slab>
    </>
  )
}

function Standings({ value, ctx }: { value: GStandings; ctx: LayoutCtx }) {
  const all = value.rows.slice(0, STANDINGS_LIMIT[ctx.format])
  const fit = useFit(all.length, { minRow: 18, maxRow: 32, note: value.rows.length > all.length })
  const rows = all.slice(0, fit.visible)
  const hidden = value.rows.length - rows.length
  const d = DENSITY[fit.density]
  // Przy wielu drużynach nagłówek plakatu maleje, żeby oddać miejsce płycie.
  const crowded = all.length > 6
  return (
    <>
      <div className={cn('relative flex flex-col justify-end', crowded ? 'pb-2' : 'pb-4')}>
        <Kicker>Po kolejce {value.afterRound}</Kicker>
        <p className={cn('pub-title leading-[0.9]', crowded ? 'text-pub-40' : 'text-pub-64')}>Tabela</p>
      </div>
      <Slab ctx={ctx} className="flex min-h-0 flex-1 flex-col">
        <div ref={fit.ref} className="min-h-0 flex-1">
          <ol>
            {rows.map((row) => (
              <li key={row.position} style={{ height: fit.rowH }} className="flex items-center gap-2">
                <span
                  className={cn(
                    'grid shrink-0 place-items-center rounded-sm pub-num text-pub-13',
                    fit.density === 'tight' ? 'size-5' : 'size-6',
                    row.position <= 1 ? 'pub-brand-fill' : 'bg-sunken',
                  )}
                >
                  {row.position}
                </span>
                <Crest name={row.team.name} logoUrl={row.team.logoUrl} className={d.crest} />
                <span className={cn('min-w-0 flex-1 truncate font-medium', d.text)}>{row.team.name}</span>
                <span className={cn('pub-num text-muted-foreground', d.text)}>{row.balance}</span>
                <span className={cn('w-9 text-right pub-num', fit.density === 'normal' ? 'text-pub-20' : d.num)}>{row.points}</span>
              </li>
            ))}
          </ol>
          {hidden > 0 && <p className="h-[24px] pt-2 text-pub-13 leading-none text-muted-foreground">i {hidden} kolejnych drużyn</p>}
        </div>
      </Slab>
    </>
  )
}

function Leaderboard({ value, ctx }: { value: GLeaderboard; ctx: LayoutCtx }) {
  const [leader, ...all] = value.rows
  const fit = useFit(all.length, { minRow: 20, maxRow: 26, note: Boolean(value.more) })
  const rest = all.slice(0, fit.visible)
  const hidden = (value.more ?? 0) + fit.hidden
  const d = DENSITY[fit.density]
  // Długa lista zabiera miejsce bohaterowi plakatu: liczba lidera z 120 na 64.
  const crowded = all.length > 4
  return (
    <>
      <div className="relative flex shrink-0 flex-col justify-center py-2">
        <Kicker>{value.statLabel} · lider</Kicker>
        <p className={cn('pub-score leading-[0.9]', crowded ? 'text-pub-64' : 'text-pub-120')}>{leader!.value}</p>
        <p className={cn('pub-title leading-tight wrap-break-word', crowded ? 'text-pub-20' : 'text-pub-28')}>{leader!.player}</p>
        <p className="text-pub-14 opacity-80">{leader!.team.name}</p>
      </div>
      <Slab ctx={ctx} className="flex min-h-0 flex-1 flex-col">
        <div ref={fit.ref} className="min-h-0 flex-1">
          <ol>
            {rest.map((row, i) => (
              <li key={i} style={{ height: fit.rowH }} className="flex items-center gap-2">
                <span className={cn('w-4 pub-num text-muted-foreground', d.text)}>{row.position}</span>
                <span className={cn('min-w-0 flex-1 truncate font-medium', d.text)}>
                  {row.player} <span className="text-muted-foreground">· {row.team.name}</span>
                </span>
                <span className={cn('pub-num', d.num)}>{row.value}</span>
              </li>
            ))}
          </ol>
          {hidden > 0 && <p className="h-[24px] pt-2 text-pub-13 leading-none text-muted-foreground">i {hidden} kolejnych</p>}
        </div>
      </Slab>
    </>
  )
}

export function VariantB({ kind, data, ctx }: VariantProps) {
  const pad = contentPadding(ctx)
  return (
    <div className="pub-brand-fill relative flex size-full flex-col border-0">
      {/* Znak wodny: logo turnieju ogromne i przycięte w prawym górnym rogu. */}
      <TournamentLogo logoUrl={data.tournament.logoUrl} className="pointer-events-none absolute -top-10 -right-16 size-72 opacity-15" />
      <div className="relative flex items-center gap-2" style={{ padding: `${pad.top}px ${pad.side}px 0` }}>
        <TournamentLogo logoUrl={data.tournament.logoUrl} className="size-7" />
        <span className="truncate font-display text-pub-14 font-bold uppercase tracking-wide">{data.tournament.name}</span>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col" style={{ paddingLeft: pad.side, paddingRight: pad.side }}>
        {kind === 'matchPreview' && 'home' in data.preview && <Preview value={data.preview} ctx={ctx} />}
        {kind === 'matchResult' && 'home' in data.result && <Result value={data.result} ctx={ctx} />}
        {kind === 'standings' && 'rows' in data.standings && <Standings value={data.standings} ctx={ctx} />}
        {kind === 'leaderboard' && 'rows' in data.leaderboard && <Leaderboard value={data.leaderboard} ctx={ctx} />}
      </div>
    </div>
  )
}
