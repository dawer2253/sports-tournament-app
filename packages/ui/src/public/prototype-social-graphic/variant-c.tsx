/*
  PROTOTYP (#324) — wariant C „Belka”. Układ redakcyjny jak sekcja strony
  publicznej: nagłówek zdaniem, gruba belka `--pub-rule`, dane w wierszach
  wyrównanych do lewej (mecz to dwa wiersze, nie starcie twarzą w twarz),
  klasyfikacja jako wykres słupkowy. Kolor turnieju w pionowym pasie z lewej.
*/
import { cn } from '../../lib/utils'
import { Crest } from '../crest'
import { TournamentLogo } from '../tournament-logo'
import { STANDINGS_LIMIT, type GLeaderboard, type GPreview, type GResult, type GStandings } from './data'
import { DENSITY, contentPadding, scorerText, useFit, type VariantProps, type LayoutCtx } from './shared'

export const name = 'Belka'

function Head({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="font-display text-pub-14 font-semibold text-brand-text">{kicker}</p>
      <h2 className="pub-h2 text-pub-40 leading-none">{title}</h2>
      <div className="mt-2 h-1 bg-rule" />
    </div>
  )
}

function TeamRow({ team, right, dim, sets }: { team: { name: string; logoUrl: string | null }; right: React.ReactNode; dim?: boolean; sets?: number[] }) {
  return (
    <div className={cn('flex items-center gap-3 border-b border-hairline py-2.5', dim && 'text-muted-foreground')}>
      <Crest name={team.name} logoUrl={team.logoUrl} className="size-10" />
      <span className="min-w-0 flex-1 font-display text-pub-20 font-bold leading-tight text-balance">{team.name}</span>
      {sets && (
        <span className="flex gap-2">
          {sets.map((s, i) => (
            <span key={i} className="w-5 text-right pub-num text-pub-14 text-muted-foreground">
              {s}
            </span>
          ))}
        </span>
      )}
      <span className="w-12 text-right pub-score text-pub-40">{right}</span>
    </div>
  )
}

function Preview({ value }: { value: GPreview }) {
  const [date, time] = value.kickoff.split(' · ')
  return (
    <>
      <Head kicker={value.roundName} title="Zapowiedź meczu" />
      <div className="mt-2">
        <TeamRow team={value.home} right="" />
        <TeamRow team={value.away} right="" />
      </div>
      <dl className="mt-4 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1">
        <dt className="font-display text-pub-14 font-semibold text-muted-foreground">Kiedy</dt>
        <dd>
          <span className="pub-score text-pub-40 text-brand-text">{time}</span> <span className="text-pub-14">{date}</span>
        </dd>
        {value.venue && (
          <>
            <dt className="font-display text-pub-14 font-semibold text-muted-foreground">Gdzie</dt>
            <dd className="text-pub-16 font-medium">{value.venue}</dd>
          </>
        )}
      </dl>
    </>
  )
}

function Result({ value }: { value: GResult }) {
  const homeWon = value.penalties ? value.penalties[0] > value.penalties[1] : value.homeScore > value.awayScore
  return (
    <>
      <Head kicker={`${value.roundName} · ${value.kickoff}`} title="Wynik meczu" />
      <div className="mt-2">
        <TeamRow
          team={value.home}
          right={value.homeScore}
          dim={!homeWon}
          sets={value.sets?.map(([h]) => h)}
        />
        <TeamRow team={value.away} right={value.awayScore} dim={homeWon} sets={value.sets?.map(([, a]) => a)} />
      </div>
      {value.penalties && (
        <p className="mt-2 text-right pub-num text-pub-16 text-muted-foreground">
          Rzuty karne {value.penalties[0]}:{value.penalties[1]}
        </p>
      )}
      {value.scorers && (
        <div className="mt-3 space-y-1 text-pub-13">
          <p>
            <span className="font-semibold">{value.home.name}:</span>{' '}
            <span className="text-muted-foreground">{value.scorers.home.map(scorerText).join(', ') || '—'}</span>
          </p>
          <p>
            <span className="font-semibold">{value.away.name}:</span>{' '}
            <span className="text-muted-foreground">{value.scorers.away.map(scorerText).join(', ') || '—'}</span>
          </p>
        </div>
      )}
    </>
  )
}

function Standings({ value, ctx }: { value: GStandings; ctx: LayoutCtx }) {
  const all = value.rows.slice(0, STANDINGS_LIMIT[ctx.format])
  // Nagłówek kolumn: 24 px.
  const fit = useFit(all.length, { minRow: 18, maxRow: 30, reserved: 24, note: value.rows.length > all.length })
  const rows = all.slice(0, fit.visible)
  const hidden = value.rows.length - rows.length
  const d = DENSITY[fit.density]
  return (
    <>
      <Head kicker={`Po kolejce ${value.afterRound}`} title="Tabela" />
      <div ref={fit.ref} className="mt-1 min-h-0 flex-1">
        <div className="flex h-6 items-center gap-2 font-display text-pub-13 font-semibold text-muted-foreground">
          <span className="w-6">#</span>
          <span className="flex-1">Drużyna</span>
          <span className="w-6 text-right">M</span>
          <span className="w-14 text-right">{value.balanceLabel}</span>
          <span className="w-9 text-right">Pkt</span>
        </div>
        {rows.map((row) => (
          <div key={row.position} style={{ height: fit.rowH }} className={cn('flex items-center gap-2 border-t border-hairline', d.text)}>
            <span className="w-6 pub-num">{row.position}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{row.team.name}</span>
            <span className="w-6 text-right pub-num text-muted-foreground">{row.played}</span>
            <span className="w-14 text-right pub-num text-muted-foreground">{row.balance}</span>
            <span className={cn('w-9 text-right pub-num', d.num)}>{row.points}</span>
          </div>
        ))}
        {hidden > 0 && (
          <p className="h-[24px] border-t border-hairline pt-2 text-pub-13 leading-none text-muted-foreground">
            Pokazano {rows.length} z {value.rows.length} drużyn.
          </p>
        )}
      </div>
    </>
  )
}

function Leaderboard({ value }: { value: GLeaderboard }) {
  const max = Math.max(...value.rows.map((r) => r.value))
  // Wiersz to nazwisko nad słupkiem (min. 40 px); ciaśniej słupek staje obok nazwiska.
  const fit = useFit(value.rows.length, { minRow: 22, maxRow: 52, note: Boolean(value.more) })
  const rows = value.rows.slice(0, fit.visible)
  const hidden = (value.more ?? 0) + fit.hidden
  const stacked = fit.rowH >= 40
  return (
    <>
      <Head kicker="Klasyfikacja" title={value.statLabel} />
      <div ref={fit.ref} className="mt-2 min-h-0 flex-1">
        <ol>
          {rows.map((row, i) => {
            const bar = (
              <div className="h-2.5 flex-1 rounded-sm bg-sunken">
                <div className={cn('h-full rounded-sm', i === 0 ? 'bg-brand-line' : 'bg-muted-foreground/50')} style={{ width: `${(row.value / max) * 100}%` }} />
              </div>
            )
            return (
              <li key={i} style={{ height: fit.rowH }} className="flex flex-col justify-center">
                <div className="flex items-center gap-2">
                  <span className="w-4 pub-num text-pub-14 text-muted-foreground">{row.position}</span>
                  <span
                    className={cn(
                      'min-w-0 truncate font-medium',
                      stacked ? 'flex-1' : 'w-36 shrink-0',
                      i === 0 && stacked ? 'font-display text-pub-20 font-bold' : stacked ? 'text-pub-14' : 'text-pub-13',
                    )}
                  >
                    {row.player}
                  </span>
                  {stacked ? <span className="truncate text-pub-13 text-muted-foreground">{row.team.name}</span> : bar}
                  {!stacked && <span className="w-7 text-right pub-num text-pub-14">{row.value}</span>}
                </div>
                {stacked && (
                  <div className="mt-1 flex items-center gap-2 pl-6">
                    {bar}
                    <span className="w-8 text-right pub-num text-pub-16">{row.value}</span>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
        {hidden > 0 && <p className="h-[24px] pt-2 text-pub-13 leading-none text-muted-foreground">i {hidden} kolejnych ex aequo</p>}
      </div>
    </>
  )
}

export function VariantC({ kind, data, ctx }: VariantProps) {
  const pad = contentPadding(ctx)
  return (
    <div className="flex size-full">
      <div className="w-3 shrink-0 bg-brand" />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ padding: `${pad.top}px ${pad.side}px ${pad.bottom}px ${pad.side - 6}px` }}>
        <div className="flex min-h-0 flex-1 flex-col">
          {kind === 'matchPreview' && 'home' in data.preview && <Preview value={data.preview} />}
          {kind === 'matchResult' && 'home' in data.result && <Result value={data.result} />}
          {kind === 'standings' && 'rows' in data.standings && <Standings value={data.standings} ctx={ctx} />}
          {kind === 'leaderboard' && 'rows' in data.leaderboard && <Leaderboard value={data.leaderboard} />}
        </div>
        <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-3">
          <TournamentLogo logoUrl={data.tournament.logoUrl} className="size-6" />
          <span className="truncate font-display text-pub-14 font-bold uppercase tracking-wide text-muted-foreground">{data.tournament.name}</span>
        </div>
      </div>
    </div>
  )
}
