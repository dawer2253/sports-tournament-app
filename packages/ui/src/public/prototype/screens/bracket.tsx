/**
 * PROTOTYP S7 (#288) — Drabinka w trzech wariantach:
 * - A „Drzewo”: kolumny rund z łącznikami w oknie (do czterech kolumn na
 *   desktopie, dwie na telefonie) i pigułki rund, jak dziś (#218);
 * - B „Rundy”: bez drzewa, bieżąca runda jak pas kolejki z Przeglądu, reszta
 *   rund listą; drabinka czyta się jak terminarz;
 * - C „Plakat”: drzewo z dwóch stron zbiega się do finału i mistrza na
 *   środku. Tylko desktop i do trzech rund (8 drużyn): przy 16 kafel ma
 *   ok. 145 px i nazwy są nieczytelne, więc wariant wraca do drzewa z A.
 *
 * Zostaje z S4: karne w nawiasie przy nazwie (poza polem wyniku), wolne
 * losy w miejscu brakującego meczu, mecz o 3. miejsce pod finałem.
 */
import * as React from 'react'
import {
  bracketChampion,
  bracketTeamsInPlay,
  bracketTree,
  currentRoundOrder,
  type BracketTreeRound,
  type BracketTreeSlot,
} from '../../../lib/bracket'
import type { DemoBracketMatch } from '../../../lib/demo-data'
import { cn } from '../../../lib/utils'
import { Crest, DeadLink, LiveTag } from '../parts'
import { EmptyBoard, Fact, PageHead, Shell, TextLink } from './kit'
import { lost, Penalties, scoreOf, shortDay, kickoffTime, TeamName, teamOf } from './match-bits'
import { Board, MatchLine } from './rounds'
import { bracketRow, type Season, type ScreenMatch } from './screen-demo'

export const BRACKET_VARIANTS = { A: 'Drzewo, wybrane', B: 'Rundy', C: 'Plakat' } as const
export type BracketVariant = keyof typeof BRACKET_VARIANTS

type Round = BracketTreeRound<DemoBracketMatch>

/** Wysokość kafla i odstępy drzewa (px). */
const TILE = 92
const GAP = 14
const UNIT = TILE + GAP
const CONNECTOR = 28

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null)
  const [width, setWidth] = React.useState(1200)
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(element.getBoundingClientRect().width)
    const observer = new ResizeObserver(([entry]) => setWidth(entry!.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}

// --- Kafel ----------------------------------------------------------------------

/**
 * Kafel meczu drabinki: nad parą pozycja i termin (albo „Na żywo”), dwie
 * linie herb–nazwa–wynik. Wynik w okienku stałej szerokości, karne przy
 * nazwie. Zwycięzca pełną bielą, przegrany przygaszony.
 */
function Tile({ match, data, className }: { match: ScreenMatch; data: Season; className?: string }) {
  const live = match.status === 'live'
  const played = match.status !== 'scheduled'
  return (
    <DeadLink
      style={{ height: TILE }}
      className={cn(
        'flex min-w-0 flex-col justify-center gap-1 rounded-md bg-card px-3 ring-1 ring-inset hover:bg-muted',
        live ? 'ring-destructive/70' : 'ring-border',
        className,
      )}
    >
      <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{match.bracket?.label}</span>
        {live ? (
          <LiveTag className="shrink-0 text-xs" />
        ) : match.status === 'scheduled' && match.kickoffAt ? (
          <span className="shrink-0">{shortDay(match, data.timeZone)} {kickoffTime(match, data.timeZone)}</span>
        ) : null}
      </span>
      {(['home', 'away'] as const).map((side) => (
        <span key={side} className={cn('grid h-7 grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-2 sm:grid-cols-[1.25rem_minmax(0,1fr)_2.25rem]', lost(match, side) ? 'text-muted-foreground' : 'font-semibold')}>
          {teamOf(match, side) ? <Crest name={teamOf(match, side)!.name} className="hidden size-5 sm:block" /> : <span className="hidden sm:block" />}
          <span className="flex min-w-0 items-center gap-1.5 text-[0.9375rem]">
            <TeamName match={match} side={side} className={!teamOf(match, side) ? 'text-[0.8125rem]' : undefined} />
            <Penalties match={match} side={side} />
          </span>
          <span className={cn('grid h-7 place-items-center rounded-sm bg-sunken pub-num text-lg', !played && 'text-transparent')}>
            {played ? scoreOf(match, side) : 0}
          </span>
        </span>
      ))}
    </DeadLink>
  )
}

function ByeTile({ name }: { name: string }) {
  return (
    <div style={{ height: TILE }} className="flex flex-col justify-center gap-1.5 rounded-md px-3 ring-1 ring-inset ring-border [border-style:dashed]">
      <span className="text-xs text-muted-foreground">Wolny los</span>
      <span className="flex min-w-0 items-center gap-2 font-medium">
        <Crest name={name} className="size-5" />
        <span className="truncate">{name}</span>
      </span>
    </div>
  )
}

function ChampionTile({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-brand px-4 py-3 text-brand-foreground">
      <Crest name={name} className="size-9" />
      <span className="flex min-w-0 flex-col">
        <span className="text-xs opacity-85">Mistrz</span>
        <span className="pub-title truncate leading-[1.2] text-[1.375rem]">{name}</span>
      </span>
    </div>
  )
}

// --- Drzewo -------------------------------------------------------------------------

function slotContent(slot: BracketTreeSlot<DemoBracketMatch>, data: Season) {
  if (slot.kind === 'match') return <Tile match={bracketRow(slot.match, data.bracket)} data={data} />
  if (slot.kind === 'bye') return <ByeTile name={slot.bye.team.name} />
  return null
}

/**
 * Kolumna drzewa: `slots` miejsc na równej wysokości `height`, kafel na
 * środku miejsca. Łącznik idzie od środków dwóch kafli poprzedniej kolumny
 * (¼ i ¾ miejsca) do środka tego kafla; `dir` odwraca go dla prawej połowy plakatu.
 */
function Column({
  slots,
  height,
  data,
  joined,
  dir = 'ltr',
  children,
}: {
  slots: BracketTreeSlot<DemoBracketMatch>[]
  height: number
  data: Season
  joined: boolean
  dir?: 'ltr' | 'rtl'
  children?: React.ReactNode
}) {
  const slotHeight = height / slots.length
  const side = dir === 'ltr' ? 'left' : 'right'
  return (
    <div className="relative min-w-0" style={{ height }}>
      {slots.map((slot, index) => (
        <div key={index} className="absolute inset-x-0" style={{ top: index * slotHeight, height: slotHeight }}>
          <div className="absolute inset-x-0" style={{ top: slotHeight / 2 - TILE / 2 }}>
            {slotContent(slot, data)}
          </div>
          {joined && slot.kind !== 'empty' && (
            <>
              <span
                aria-hidden
                className={cn('absolute border-y border-muted-foreground/35', dir === 'ltr' ? 'border-r' : 'border-l')}
                style={{ [side]: -CONNECTOR, width: CONNECTOR / 2, top: slotHeight / 4, height: slotHeight / 2 }}
              />
              <span aria-hidden className="absolute border-t border-muted-foreground/35" style={{ [side]: -CONNECTOR / 2, width: CONNECTOR / 2, top: slotHeight / 2 }} />
            </>
          )}
        </div>
      ))}
      {children}
    </div>
  )
}

/** Finał z mistrzem nad nim i meczem o 3. miejsce pod nim; finał stoi na środku kolumny. */
function FinalExtras({ round, data, height }: { round: Round; data: Season; height: number }) {
  const champion = bracketChampion(data.bracket)
  return (
    <>
      {champion && (
        <div className="absolute inset-x-0" style={{ bottom: height / 2 + TILE / 2 + 16 }}>
          <ChampionTile name={champion.name} />
        </div>
      )}
      {round.third && (
        <div className="absolute inset-x-0" style={{ top: height / 2 + TILE / 2 + 18 }}>
          <Tile match={bracketRow(round.third, data.bracket)} data={data} />
        </div>
      )}
    </>
  )
}

function RoundHead({ round, slots, className }: { round: Round; slots?: BracketTreeSlot<DemoBracketMatch>[]; className?: string }) {
  // Połówka plakatu liczy swoje mecze, nie całej rundy.
  const matches = slots ? slots.flatMap((slot) => (slot.kind === 'match' ? [slot.match] : [])) : null
  const live = matches ? matches.some((match) => match.status === 'live') : round.live
  const finished = matches ? matches.filter((match) => match.status === 'finished').length : round.finished
  const total = matches ? matches.length : round.total
  return (
    <div className={cn('flex min-w-0 flex-col gap-0.5 border-b-2 border-rule pb-2', className)}>
      <span className="truncate pub-tab text-lg">{round.name}</span>
      <span className="text-xs text-muted-foreground">
        {live ? <LiveTag className="text-xs" /> : `${finished} z ${total} rozegrane`}
      </span>
    </div>
  )
}

/** Wysokość drzewa: od pierwszej widocznej kolumny, z miejscem na mistrza i 3. miejsce. */
function treeHeight(firstSlots: number) {
  return Math.max(firstSlots * UNIT, 3 * UNIT + 80)
}

function TreeWindow({ data }: { data: Season }) {
  const rounds = bracketTree(data.bracket)
  const [ref, width] = useWidth<HTMLDivElement>()
  const cols = Math.min(rounds.length, width < 600 ? 2 : width < 860 ? 3 : 4)
  const current = (currentRoundOrder(data.bracket) ?? 1) - 1
  const [start, setStart] = React.useState<number | null>(null)
  const first = Math.min(Math.max(0, start ?? current), rounds.length - cols)
  const visible = rounds.slice(first, first + cols)
  const height = treeHeight(visible[0]!.slots.length)

  return (
    <div ref={ref} className="flex flex-col gap-5">
      {rounds.length > cols && (
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Wcześniejsza runda" disabled={first === 0} onClick={() => setStart(first - 1)} className="grid size-9 place-items-center rounded-md ring-1 ring-inset ring-border disabled:opacity-40">‹</button>
          <div className="flex gap-1 overflow-x-auto">
            {rounds.map((round, index) => (
              <button
                key={round.id}
                type="button"
                aria-pressed={index >= first && index < first + cols}
                onClick={() => setStart(index)}
                className={cn(
                  'min-h-9 rounded-md px-3 pub-tab text-base',
                  index >= first && index < first + cols ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {round.shortName}
              </button>
            ))}
          </div>
          <button type="button" aria-label="Dalsza runda" disabled={first + cols >= rounds.length} onClick={() => setStart(first + 1)} className="grid size-9 place-items-center rounded-md ring-1 ring-inset ring-border disabled:opacity-40">›</button>
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, columnGap: CONNECTOR }}>
        {visible.map((round) => <RoundHead key={round.id} round={round} />)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, columnGap: CONNECTOR }}>
        {visible.map((round, index) => (
          <Column key={round.id} slots={round.slots} height={height} data={data} joined={index > 0}>
            {round.order === rounds.length && <FinalExtras round={round} data={data} height={height} />}
          </Column>
        ))}
      </div>
    </div>
  )
}

/** Plakat: lewa połowa drabinki od lewej, prawa od prawej, finał na środku. */
function Poster({ data }: { data: Season }) {
  const rounds = bracketTree(data.bracket)
  const final = rounds.at(-1)!
  const sides = rounds.slice(0, -1)
  const height = treeHeight(sides[0] ? sides[0].slots.length / 2 : 1)
  const half = (round: Round, part: 0 | 1) => round.slots.slice(part * (round.slots.length / 2), (part + 1) * (round.slots.length / 2))
  const columns = sides.length * 2 + 1
  const template = `repeat(${sides.length}, minmax(0, 1fr)) minmax(0, 1.15fr) repeat(${sides.length}, minmax(0, 1fr))`

  return (
    <div className="flex flex-col gap-5">
      <div className="grid" style={{ gridTemplateColumns: template, columnGap: CONNECTOR }}>
        {sides.map((round) => <RoundHead key={round.id} round={round} slots={half(round, 0)} />)}
        <RoundHead round={final} className="text-center [&>span]:self-center" />
        {sides.toReversed().map((round) => <RoundHead key={`r${round.id}`} round={round} slots={half(round, 1)} className="items-end text-right" />)}
      </div>
      <div className="grid" style={{ gridTemplateColumns: template, columnGap: CONNECTOR }} data-columns={columns}>
        {sides.map((round, index) => <Column key={round.id} slots={half(round, 0)} height={height} data={data} joined={index > 0} />)}
        <div className="relative" style={{ height }}>
          <div className="absolute inset-x-0" style={{ top: height / 2 - TILE / 2 }}>
            {final.slots[0] && slotContent(final.slots[0], data)}
          </div>
          {/* Wąsy z obu półfinałów do finału. */}
          <span aria-hidden className="absolute border-t border-muted-foreground/35" style={{ left: -CONNECTOR, width: CONNECTOR, top: height / 2 }} />
          <span aria-hidden className="absolute border-t border-muted-foreground/35" style={{ right: -CONNECTOR, width: CONNECTOR, top: height / 2 }} />
          <FinalExtras round={final} data={data} height={height} />
        </div>
        {sides.toReversed().map((round, index) => (
          <Column key={`r${round.id}`} slots={half(round, 1)} height={height} data={data} joined={index < sides.length - 1} dir="rtl" />
        ))}
      </div>
    </div>
  )
}

// --- B „Rundy” ----------------------------------------------------------------------

function RoundsView({ data }: { data: Season }) {
  const rounds = bracketTree(data.bracket)
  const champion = bracketChampion(data.bracket)
  const currentOrder = currentRoundOrder(data.bracket) ?? 1
  const rows = (round: Round) =>
    data.bracket.filter((match) => match.round.order === round.order).map((match) => bracketRow(match, data.bracket)).toSorted((a, b) => (a.kickoffAt ?? '').localeCompare(b.kickoffAt ?? ''))
  const current = rounds.find((round) => round.order === currentOrder)!
  const later = rounds.filter((round) => round.order > currentOrder)
  const earlier = rounds.filter((round) => round.order < currentOrder).toReversed()
  const finished = data.state === 'zakonczony'

  return (
    <div className="flex flex-col gap-12">
      {champion && <ChampionTile name={champion.name} />}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-1">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{finished ? 'Ostatnia runda' : 'Bieżąca runda'}</span>
            <h2 className="pub-title text-[2.5rem] sm:text-[3.5rem]">{current.name}</h2>
          </div>
          <Fact value={current.finished}>z {current.total} rozegrane</Fact>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rows(current).map((match) => <Board key={match.id} match={match} data={data} mode="fixtures" />)}
        </div>
      </section>
      {[...later, ...earlier].map((round) => (
        <section key={round.id} className="flex flex-col">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 border-b-2 border-rule pb-2">
            <h2 className="pub-h2 text-[1.75rem]">{round.name}</h2>
            <span className="text-sm text-muted-foreground">{round.order < currentOrder ? 'rozegrana' : `${round.total} ${round.total === 1 ? 'mecz' : 'mecze'}`}</span>
          </div>
          {rows(round).map((match) => (
            <MatchLine key={match.id} match={match} data={data} showDay mode={round.order < currentOrder ? 'results' : 'fixtures'} />
          ))}
        </section>
      ))}
    </div>
  )
}

// --- Ekran --------------------------------------------------------------------------

export function BracketScreen({ data, accent, variant }: { data: Season; accent: string; variant: BracketVariant }) {
  const empty = data.bracket.length === 0
  const { inPlay, total } = bracketTeamsInPlay(data.bracket)
  const champion = bracketChampion(data.bracket)

  return (
    <Shell tournament={data.tournament} tabs={data.tabs} active="bracket" accent={accent}>
      <PageHead
        eyebrow={data.format === 'grupy' ? 'Playoff' : 'Puchar'}
        title="Drabinka"
        meta={!empty && (champion ? <Fact value={total}>drużyn, puchar rozstrzygnięty</Fact> : <Fact value={inPlay}>z {total} drużyn w grze</Fact>)}
      />
      {empty ? (
        data.format === 'grupy' ? (
          <EmptyBoard title="Drabinka powstanie po fazie grupowej" action={<TextLink>Zobacz tabele grup</TextLink>}>
            Z każdej grupy wychodzą dwie drużyny. Pary playoffu pojawią się tutaj, gdy organizator je ułoży.
          </EmptyBoard>
        ) : (
          <EmptyBoard title="Drabinka jeszcze nie jest ułożona" action={<TextLink>Zobacz drużyny na Przeglądzie</TextLink>}>
            Pary pojawią się tutaj, gdy organizator rozstawi drużyny.
          </EmptyBoard>
        )
      ) : variant === 'B' ? (
        <RoundsView data={data} />
      ) : variant === 'C' && bracketTree(data.bracket).length <= 3 ? (
        <>
          <div className="hidden lg:block">
            <Poster data={data} />
          </div>
          <div className="lg:hidden">
            <TreeWindow data={data} />
          </div>
        </>
      ) : (
        <TreeWindow data={data} />
      )}
    </Shell>
  )
}
