/*
  PROTOTYP (#324) — wariant A „Tablica”. Ciemny kadr jak tablica meczu ze
  strony publicznej: wyśrodkowane starcie, okienka wyniku na `--pub-sunken`,
  kolor turnieju tylko w pasku u góry i w linii. Najbliżej S7.
*/
import { cn } from '../../lib/utils'
import { Crest } from '../crest'
import { TournamentLogo } from '../tournament-logo'
import { STANDINGS_LIMIT, type GLeaderboard, type GPreview, type GResult, type GStandings } from './data'
import { DENSITY, contentPadding, scorerText, useFit, type LayoutCtx, type VariantProps } from './shared'

export const name = 'Tablica'

function Header({ tournament, label, ctx }: { tournament: VariantProps['data']['tournament']; label: string; ctx: LayoutCtx }) {
  return (
    <div className="flex items-center gap-2 border-b border-hairline pb-3">
      <TournamentLogo logoUrl={tournament.logoUrl} className="size-8" />
      <span className="min-w-0 flex-1 truncate font-display text-pub-14 font-bold uppercase tracking-wide">{tournament.name}</span>
      <span className={cn('shrink-0 rounded-sm px-2 py-0.5 font-display text-pub-13 font-semibold pub-brand-fill', ctx.format === '9:16' && 'text-pub-14')}>{label}</span>
    </div>
  )
}

function Window({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('grid min-w-16 place-items-center rounded-md bg-sunken px-2 py-2 pub-score text-pub-64 leading-none', className)}>{children}</span>
}

function Side({ team, big }: { team: { name: string; logoUrl: string | null }; big?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <Crest name={team.name} logoUrl={team.logoUrl} className={big ? 'size-20' : 'size-16'} />
      <span className="w-full pub-title text-pub-16 leading-tight text-balance wrap-break-word">{team.name}</span>
    </div>
  )
}

function Preview({ value, ctx }: { value: GPreview; ctx: LayoutCtx }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-5">
      <p className="text-center font-display text-pub-16 font-semibold text-brand-text">{value.roundName}</p>
      <div className="flex items-center gap-2">
        <Side team={value.home} big={ctx.format === '9:16'} />
        <span className="font-display text-pub-20 font-bold text-muted-foreground">vs</span>
        <Side team={value.away} big={ctx.format === '9:16'} />
      </div>
      <div className="flex flex-col items-center gap-2">
        <Window className="px-4">{value.kickoff.split(' · ')[1] ?? '–'}</Window>
        <p className="text-pub-14 text-muted-foreground">{value.kickoff.split(' · ')[0]}</p>
        {value.venue && <p className="text-pub-14 font-medium">{value.venue}</p>}
      </div>
    </div>
  )
}

function Result({ value }: { value: GResult }) {
  const homeWon = value.homeScore > value.awayScore || (value.penalties && value.penalties[0] > value.penalties[1])
  return (
    <div className="flex flex-1 flex-col justify-center gap-4">
      <p className="text-center font-display text-pub-16 font-semibold text-brand-text">
        {value.roundName} · {value.kickoff}
      </p>
      <div className="flex items-start gap-2">
        <Side team={value.home} />
        <div className="flex flex-col items-center gap-1 pt-2">
          <div className="flex items-center gap-1.5">
            <Window className={cn(!homeWon && 'text-muted-foreground')}>{value.homeScore}</Window>
            <Window className={cn(homeWon && 'text-muted-foreground')}>{value.awayScore}</Window>
          </div>
          {value.penalties && (
            <span className="pub-num text-pub-14 text-muted-foreground">
              karne {value.penalties[0]}:{value.penalties[1]}
            </span>
          )}
        </div>
        <Side team={value.away} />
      </div>
      {value.sets && (
        <div className="flex justify-center gap-1.5">
          {value.sets.map(([h, a], i) => (
            <span key={i} className="rounded-sm bg-sunken px-2 py-1 pub-num text-pub-14">
              {h}:{a}
            </span>
          ))}
        </div>
      )}
      {value.scorers && (
        <div className="grid grid-cols-2 gap-x-4 border-t border-hairline pt-3 text-pub-13 text-muted-foreground">
          <ul className="space-y-0.5 text-right">
            {value.scorers.home.map((s, i) => (
              <li key={i}>{scorerText(s)}</li>
            ))}
          </ul>
          <ul className="space-y-0.5">
            {value.scorers.away.map((s, i) => (
              <li key={i}>{scorerText(s)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Standings({ value, ctx }: { value: GStandings; ctx: LayoutCtx }) {
  const all = value.rows.slice(0, STANDINGS_LIMIT[ctx.format])
  // Nagłówek kolumn (~26 px) i odstępy płyty (16 px) poza wierszami.
  const fit = useFit(all.length, { minRow: 18, reserved: 42, note: value.rows.length > all.length })
  const rows = all.slice(0, fit.visible)
  const hidden = value.rows.length - rows.length
  const d = DENSITY[fit.density]
  return (
    <div ref={fit.ref} className="flex min-h-0 flex-1 flex-col justify-center">
      <div className="rounded-md bg-sunken px-3 py-2">
        <div className="flex h-[26px] items-center gap-2 border-b border-hairline font-display text-pub-13 font-semibold text-muted-foreground">
          <span className="w-5 text-right">#</span>
          <span className="flex-1">Drużyna</span>
          <span className="w-6 text-right">M</span>
          <span className="w-14 text-right">{value.balanceLabel}</span>
          <span className="w-8 text-right">Pkt</span>
        </div>
        {rows.map((row) => (
          <div key={row.position} style={{ height: fit.rowH }} className="flex items-center gap-2 border-b border-hairline last:border-0">
            <span className={cn('w-5 text-right pub-num', d.text)}>{row.position}</span>
            <Crest name={row.team.name} logoUrl={row.team.logoUrl} className={d.crest} />
            <span className={cn('min-w-0 flex-1 truncate font-medium', d.text)}>{row.team.name}</span>
            <span className={cn('w-6 text-right pub-num text-muted-foreground', d.text)}>{row.played}</span>
            <span className={cn('w-14 text-right pub-num text-muted-foreground', d.text)}>{row.balance}</span>
            <span className={cn('w-8 text-right pub-num text-brand-text', d.num)}>{row.points}</span>
          </div>
        ))}
      </div>
      {hidden > 0 && <p className="h-[24px] pt-2 text-center text-pub-13 leading-none text-muted-foreground">i {hidden} kolejnych drużyn</p>}
    </div>
  )
}

function Leaderboard({ value }: { value: GLeaderboard }) {
  const [leader, ...all] = value.rows
  const fit = useFit(all.length, { minRow: 20, maxRow: 34, note: Boolean(value.more) })
  const rest = all.slice(0, fit.visible)
  const hidden = (value.more ?? 0) + fit.hidden
  const d = DENSITY[fit.density]
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-3 rounded-md bg-sunken p-3">
        <Window className="min-w-20 bg-background text-brand-text">{leader!.value}</Window>
        <div className="min-w-0">
          <p className="font-display text-pub-13 font-semibold text-muted-foreground">Lider · {value.statLabel}</p>
          <p className="pub-title text-pub-20 leading-tight wrap-break-word">{leader!.player}</p>
          <p className="flex items-center gap-1.5 text-pub-13 text-muted-foreground">
            <Crest name={leader!.team.name} logoUrl={leader!.team.logoUrl} className="size-4" />
            {leader!.team.name}
          </p>
        </div>
      </div>
      <div ref={fit.ref} className="min-h-0 flex-1">
        <ol>
          {rest.map((row, i) => (
            <li key={i} style={{ height: fit.rowH }} className="flex items-center gap-2 border-b border-hairline last:border-0">
              <span className={cn('w-5 text-right pub-num text-muted-foreground', d.text)}>{row.position}</span>
              <Crest name={row.team.name} logoUrl={row.team.logoUrl} className={d.crest} />
              <span className={cn('min-w-0 flex-1 truncate font-medium', d.text)}>{row.player}</span>
              <span className={cn('pub-num', d.num)}>{row.value}</span>
            </li>
          ))}
        </ol>
        {hidden > 0 && <p className="h-[24px] pt-2 text-center text-pub-13 leading-none text-muted-foreground">i {hidden} kolejnych</p>}
      </div>
    </div>
  )
}

const LABELS = { matchPreview: 'Zapowiedź', matchResult: 'Wynik', standings: 'Tabela', leaderboard: 'Klasyfikacja' } as const

export function VariantA({ kind, data, ctx }: VariantProps) {
  const pad = contentPadding(ctx)
  const label =
    kind === 'standings' && 'afterRound' in data.standings ? `Tabela po kolejce ${data.standings.afterRound}` : LABELS[kind]
  return (
    <div className="flex size-full flex-col">
      <div className="h-1.5 shrink-0 bg-brand" />
      <div className="flex min-h-0 flex-1 flex-col" style={{ padding: `${pad.top - 6}px ${pad.side}px ${pad.bottom}px` }}>
        <Header tournament={data.tournament} label={label} ctx={ctx} />
        <div className="flex min-h-0 flex-1 flex-col py-3">
          {kind === 'matchPreview' && 'home' in data.preview && <Preview value={data.preview} ctx={ctx} />}
          {kind === 'matchResult' && 'home' in data.result && <Result value={data.result} />}
          {kind === 'standings' && 'rows' in data.standings && <Standings value={data.standings} ctx={ctx} />}
          {kind === 'leaderboard' && 'rows' in data.leaderboard && <Leaderboard value={data.leaderboard} />}
        </div>
      </div>
    </div>
  )
}
