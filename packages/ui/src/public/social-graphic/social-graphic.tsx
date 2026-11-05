import * as React from 'react'
import { brandVars } from '../../lib/brand-on-dark'
import { formatKickoff, formatMatchDay } from '../../lib/kickoff'
import { formatSets } from '../../lib/sets'
import { cn } from '../../lib/utils'
import { Crest } from '../crest'
import { TournamentLogo } from '../tournament-logo'
import {
  SOCIAL_GRAPHIC_KINDS,
  SOCIAL_GRAPHIC_SIZE,
  type GraphicLeaderboard,
  type GraphicPreview,
  type GraphicResult,
  type GraphicScorer,
  type GraphicStandings,
  type GraphicTournament,
  type SocialGraphicContent,
  type SocialGraphicFormat,
} from './data'
import { leaderboardCut, standingsCut } from './rows'

/*
  Grafika turnieju do social mediów (`SocialGraphic`, #333): wariant B
  „Plakat” z prototypu #324. Cały kadr w kolorze turnieju (`pub-brand-fill`),
  jedna ogromna rzecz (nazwy, wynik, liczba lidera) wyrównana do lewej, dane
  na ciemnej skośnej płycie u dołu.

  Kadr ma stałe wymiary w pikselach CSS (`SOCIAL_GRAPHIC_SIZE`), a eksport
  mnoży je przez `SOCIAL_GRAPHIC_SCALE`. Grafika jest zawsze ciemna (`dark`
  na korzeniu), także w jasnym panelu. 9:16 trzyma treść w strefie
  bezpiecznej Stories (14% góry, 35% dołu, 6% boków, #321 §5).
*/

/** Odstępy treści od krawędzi kadru. */
function insets(format: SocialGraphicFormat) {
  if (format === '4:5') return { top: 24, bottom: 20, side: 22 }
  const { width, height } = SOCIAL_GRAPHIC_SIZE[format]
  return { top: Math.round(height * 0.14), bottom: Math.round(height * 0.35), side: Math.round(width * 0.06) }
}

type Density = 'normal' | 'compact' | 'tight'

/** Krój i herb wiersza listy dla gęstości. */
const DENSITY = {
  normal: { text: 'text-pub-14', num: 'text-pub-16', crest: 'size-5' },
  compact: { text: 'text-pub-13', num: 'text-pub-14', crest: 'size-5' },
  tight: { text: 'text-pub-13', num: 'text-pub-13', crest: 'size-4' },
} as const

/** Wysokość dopisku „i N kolejnych”. */
const NOTE_HEIGHT = 24

/**
 * Dopasowanie listy do miejsca w kadrze. `ref` idzie na pudełko `flex-1
 * min-h-0`, które dostaje resztę wysokości; hook mierzy je i zwraca wysokość
 * wiersza, gęstość oraz liczbę wierszy, które mieszczą się przy `minRow`.
 * Reszta idzie w dopisek zamiast wiersza uciętego w pół. `note` rezerwuje
 * miejsce na dopisek, który stoi niezależnie od dopasowania (twarde granice
 * z `rows.ts`). Bez pomiaru (jsdom) pokazuje wszystkie wiersze.
 */
function useFit(count: number, { minRow, maxRow, note }: { minRow: number; maxRow: number; note: boolean }) {
  // Węzeł w stanie, nie w `useRef`: pomiar rusza, gdy pudełko się pojawi.
  const [element, ref] = React.useState<HTMLDivElement | null>(null)
  const [height, setHeight] = React.useState(0)
  React.useLayoutEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return
    const measure = () => setHeight(element.clientHeight)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  let visible = count
  if (height > 0 && count * minRow > height - (note ? NOTE_HEIGHT : 0)) {
    visible = Math.max(1, Math.floor((height - NOTE_HEIGHT) / minRow))
  }
  const rowSpace = height - (visible < count || note ? NOTE_HEIGHT : 0)
  const rowHeight = height > 0 ? Math.max(minRow, Math.min(maxRow, rowSpace / Math.max(1, visible))) : maxRow
  const density: Density = rowHeight >= 30 ? 'normal' : rowHeight >= 24 ? 'compact' : 'tight'
  return { setBox: ref, visible, hidden: count - visible, rowHeight, density }
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="font-display text-pub-16 font-bold uppercase tracking-[0.12em] opacity-80">{children}</p>
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p data-slot="social-graphic-note" className="pt-2 text-pub-13 leading-none text-muted-foreground" style={{ height: NOTE_HEIGHT }}>
      {children}
    </p>
  )
}

/** Ciemna płyta ze skośną górną krawędzią, do krawędzi kadru. */
function Slab({ format, className, children }: { format: SocialGraphicFormat; className?: string; children: React.ReactNode }) {
  const pad = insets(format)
  return (
    <div
      className={cn('relative mt-auto bg-background text-foreground', className)}
      style={{
        clipPath: 'polygon(0 22px, 100% 0, 100% 100%, 0 100%)',
        padding: `34px ${pad.side}px ${pad.bottom}px`,
        marginLeft: -pad.side,
        marginRight: -pad.side,
      }}
    >
      {children}
    </div>
  )
}

function Preview({ value, format, timeZone }: { value: GraphicPreview; format: SocialGraphicFormat; timeZone?: string }) {
  return (
    <>
      <div className="relative flex flex-1 flex-col justify-center gap-1">
        <Kicker>Zapowiedź · {value.roundName}</Kicker>
        <p className="pub-title text-pub-40 leading-[0.95] wrap-break-word">{value.home.name}</p>
        <p className="font-display text-pub-20 font-bold opacity-70">vs</p>
        <p className="pub-title text-pub-40 leading-[0.95] wrap-break-word">{value.away.name}</p>
      </div>
      <Slab format={format}>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="pub-score text-pub-64">{formatKickoff(value.kickoffAt, { showDate: false, timeZone })}</p>
            <p className="mt-1 text-pub-14 text-muted-foreground">{formatMatchDay(value.kickoffAt, timeZone)}</p>
            {value.venue !== null && <p className="truncate text-pub-14 font-medium">{value.venue}</p>}
          </div>
          <div className="flex shrink-0 -space-x-3">
            <Crest name={value.home.name} logoUrl={value.home.logoUrl} className="size-14" />
            <Crest name={value.away.name} logoUrl={value.away.logoUrl} className="size-14" />
          </div>
        </div>
      </Slab>
    </>
  )
}

/** „Jan Kowalczyk 45+2′”, samobój z dopiskiem, bez minuty samo nazwisko. */
function scorerText(scorer: GraphicScorer): string {
  return [scorer.player, scorer.minute, scorer.ownGoal ? '(sam.)' : null].filter(Boolean).join(' ')
}

function Result({ value, format }: { value: GraphicResult; format: SocialGraphicFormat }) {
  const sides = [
    { team: value.home, scorers: value.scorers?.home ?? [] },
    { team: value.away, scorers: value.scorers?.away ?? [] },
  ]
  return (
    <>
      <div className="relative flex flex-1 flex-col justify-center">
        <Kicker>Wynik · {value.roundName}</Kicker>
        <p className="pub-score text-pub-120 leading-[0.9]">
          {value.homeScore}–{value.awayScore}
        </p>
        {value.penalties && (
          <p className="font-display text-pub-20 font-bold">
            karne {value.penalties.home}:{value.penalties.away}
          </p>
        )}
        {value.sets && value.sets.length > 0 && <p className="pub-num text-pub-16 opacity-80">{formatSets(value.sets)}</p>}
      </div>
      <Slab format={format}>
        {sides.map(({ team, scorers }, index) => (
          <div key={index} className={cn('flex gap-3', index === 1 && 'mt-3 border-t border-hairline pt-3')}>
            <Crest name={team.name} logoUrl={team.logoUrl} className="size-9" />
            <div className="min-w-0">
              <p className="pub-title text-pub-20 leading-tight wrap-break-word">{team.name}</p>
              {scorers.length > 0 && <p className="text-pub-13 text-muted-foreground">{scorers.map(scorerText).join(', ')}</p>}
            </div>
          </div>
        ))}
      </Slab>
    </>
  )
}

function Standings({ value, format }: { value: GraphicStandings; format: SocialGraphicFormat }) {
  const cut = standingsCut(value.rows)
  const { setBox, ...fit } = useFit(cut.rows.length, { minRow: 18, maxRow: 32, note: cut.hidden > 0 })
  const rows = cut.rows.slice(0, fit.visible)
  const hidden = value.rows.length - rows.length
  const d = DENSITY[fit.density]
  // Przy wielu drużynach nagłówek plakatu maleje, żeby oddać miejsce płycie.
  const crowded = cut.rows.length > 6
  return (
    <>
      <div className={cn('relative flex flex-col justify-end', crowded ? 'pb-2' : 'pb-4')}>
        {value.afterRound !== null && <Kicker>Po kolejce {value.afterRound}</Kicker>}
        <p className={cn('pub-title leading-[0.9]', crowded ? 'text-pub-40' : 'text-pub-64')}>Tabela</p>
      </div>
      <Slab format={format} className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 pb-1 font-display text-pub-13 font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="min-w-0 flex-1">Drużyna</span>
          <span className="w-6 text-right">M</span>
          <span className="w-14 text-right">{value.scoreLabel}</span>
          <span className="w-9 text-right">Pkt</span>
        </div>
        <div ref={setBox} className="min-h-0 flex-1">
          <ol>
            {rows.map((row) => (
              <li key={row.position} style={{ height: fit.rowHeight }} className="flex items-center gap-2">
                <span
                  className={cn(
                    'grid shrink-0 place-items-center rounded-sm pub-num text-pub-13',
                    fit.density === 'tight' ? 'size-5' : 'size-6',
                    row.position === 1 ? 'pub-brand-fill' : 'bg-sunken',
                  )}
                >
                  {row.position}
                </span>
                <Crest name={row.team.name} logoUrl={row.team.logoUrl} className={d.crest} />
                <span className={cn('min-w-0 flex-1 truncate font-medium', d.text)}>{row.team.name}</span>
                <span className={cn('w-6 text-right pub-num text-muted-foreground', d.text)}>{row.played}</span>
                <span className={cn('w-14 text-right pub-num text-muted-foreground', d.text)}>
                  {row.scoreFor}:{row.scoreAgainst}
                </span>
                <span className={cn('w-9 text-right pub-num', fit.density === 'normal' ? 'text-pub-20' : d.num)}>{row.points}</span>
              </li>
            ))}
          </ol>
          {hidden > 0 && <Note>i {hidden} kolejnych drużyn</Note>}
        </div>
      </Slab>
    </>
  )
}

function Leaderboard({ value, format }: { value: GraphicLeaderboard; format: SocialGraphicFormat }) {
  const cut = leaderboardCut(value.rows)
  const [leader, ...others] = cut.rows
  const { setBox, ...fit } = useFit(others.length, { minRow: 20, maxRow: 26, note: cut.hidden > 0 })
  const rest = others.slice(0, fit.visible)
  const hidden = cut.hidden + fit.hidden
  const d = DENSITY[fit.density]
  // Długa lista zabiera miejsce bohaterowi plakatu: liczba lidera z 120 na 64.
  const crowded = others.length > 4
  if (!leader) return null
  return (
    <>
      <div className="relative flex shrink-0 flex-col justify-center py-2">
        <Kicker>{value.label} · lider</Kicker>
        <p className={cn('pub-score leading-[0.9]', crowded ? 'text-pub-64' : 'text-pub-120')}>{leader.value}</p>
        <p className={cn('pub-title leading-tight wrap-break-word', crowded ? 'text-pub-20' : 'text-pub-28')}>{leader.player}</p>
        <p className="text-pub-14 opacity-80">{leader.team.name}</p>
      </div>
      <Slab format={format} className="flex min-h-0 flex-1 flex-col">
        <div ref={setBox} className="min-h-0 flex-1">
          <ol>
            {rest.map((row, index) => (
              <li key={index} style={{ height: fit.rowHeight }} className="flex items-center gap-2">
                <span className={cn('w-4 pub-num text-muted-foreground', d.text)}>{row.position}</span>
                <span className={cn('min-w-0 flex-1 truncate font-medium', d.text)}>
                  {row.player} <span className="text-muted-foreground">· {row.team.name}</span>
                </span>
                <span className={cn('pub-num', d.num)}>{row.value}</span>
              </li>
            ))}
          </ol>
          {hidden > 0 && <Note>i {hidden} kolejnych</Note>}
        </div>
      </Slab>
    </>
  )
}

export interface SocialGraphicProps {
  tournament: GraphicTournament
  format: SocialGraphicFormat
  content: SocialGraphicContent
  /** Strefa terminów zapowiedzi; bez niej strefa przeglądarki, jak w panelu. Makiety podają jawną. */
  timeZone?: string
  /** Węzeł do eksportu PNG. */
  ref?: React.Ref<HTMLDivElement>
}

/**
 * Grafika turnieju: jeden z czterech szablonów w jednym z dwóch formatów.
 * Dane podaje panel (`data.ts`), a szablon przycina listy (`rows.ts`)
 * i dopasowuje je do kadru. Herb albo logo, którego nie da się wczytać,
 * zastępuje herb zastępczy (`Crest`, `TournamentLogo`).
 */
export function SocialGraphic({ tournament, format, content, timeZone, ref }: SocialGraphicProps) {
  const { width, height } = SOCIAL_GRAPHIC_SIZE[format]
  const pad = insets(format)
  const label = SOCIAL_GRAPHIC_KINDS.find(({ kind }) => kind === content.kind)!.label
  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Grafika: ${label}, ${tournament.name}`}
      data-slot="social-graphic"
      data-kind={content.kind}
      data-format={format}
      className="dark public-site relative shrink-0 overflow-hidden bg-background text-foreground"
      style={{ ...brandVars(tournament.primaryColor), width, height }}
    >
      <div className="pub-brand-fill relative flex size-full flex-col border-0">
        {/* Znak wodny: logo turnieju ogromne i przycięte w prawym górnym rogu. */}
        <TournamentLogo logoUrl={tournament.logoUrl} className="pointer-events-none absolute -top-10 -right-16 size-72 opacity-15" />
        <div className="relative flex items-center gap-2" style={{ padding: `${pad.top}px ${pad.side}px 0` }}>
          <TournamentLogo logoUrl={tournament.logoUrl} className="size-7" />
          <span className="truncate font-display text-pub-14 font-bold uppercase tracking-wide">{tournament.name}</span>
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col" style={{ paddingLeft: pad.side, paddingRight: pad.side }}>
          {content.kind === 'matchPreview' && <Preview value={content.data} format={format} timeZone={timeZone} />}
          {content.kind === 'matchResult' && <Result value={content.data} format={format} />}
          {content.kind === 'standings' && <Standings value={content.data} format={format} />}
          {content.kind === 'leaderboard' && <Leaderboard value={content.data} format={format} />}
        </div>
      </div>
    </div>
  )
}
