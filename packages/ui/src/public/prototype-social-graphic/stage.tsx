/*
  PROTOTYP (#324) — do wyrzucenia. Trzy warianty czterech szablonów
  `SocialGraphic`, przełączane `?variant=` z pływającego paska (strzałki ←/→),
  na danych z seeda demo. Każda grafika ma obok PNG z modern-screenshot (#321),
  żeby było widać, czy eksport trzyma wygląd.
*/
import { domToPng } from 'modern-screenshot'
import * as React from 'react'
import { DATASETS, EXPORT_SCALE, FORMAT_SIZE, KINDS, isDisabled, type Format, type GDataset, type Kind } from './data'
import { GraphicFrame, safeInsets, type LayoutCtx, type VariantProps } from './shared'
import { VariantA, name as nameA } from './variant-a'
import { VariantB, name as nameB } from './variant-b'
import { VariantC, name as nameC } from './variant-c'

const VARIANTS: { key: string; name: string; Component: React.ComponentType<VariantProps> }[] = [
  { key: 'A', name: nameA, Component: VariantA },
  { key: 'B', name: nameB, Component: VariantB },
  { key: 'C', name: nameC, Component: VariantC },
]

type State = { variant: string; data: string; format: Format; safe: boolean; zone: boolean }

function readState(): State {
  const p = new URLSearchParams(window.location.search)
  return {
    variant: VARIANTS.some((v) => v.key === p.get('variant')) ? p.get('variant')! : 'A',
    data: DATASETS.some((d) => d.key === p.get('data')) ? p.get('data')! : 'pilka',
    format: p.get('format') === '9:16' ? '9:16' : '4:5',
    safe: p.get('safe') !== '0',
    zone: p.get('zone') === '1',
  }
}

function writeState(s: State) {
  const p = new URLSearchParams(window.location.search)
  p.set('variant', s.variant)
  p.set('data', s.data)
  p.set('format', s.format)
  p.set('safe', s.safe ? '1' : '0')
  p.set('zone', s.zone ? '1' : '0')
  window.history.replaceState(null, '', `${window.location.pathname}?${p}`)
}

type Exported = { url: string; ms: number; w: number; h: number; kb: number }

function disabledReason(data: GDataset, kind: Kind): string | null {
  const value = { matchPreview: data.preview, matchResult: data.result, standings: data.standings, leaderboard: data.leaderboard }[kind]
  return isDisabled(value) ? value.disabled : null
}

function GraphicCard({
  kind,
  label,
  data,
  ctx,
  zone,
  Variant,
  exportTick,
}: {
  kind: Kind
  label: string
  data: GDataset
  ctx: LayoutCtx
  zone: boolean
  Variant: React.ComponentType<VariantProps>
  exportTick: number
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [exported, setExported] = React.useState<Exported | null>(null)
  const [busy, setBusy] = React.useState(false)
  const reason = disabledReason(data, kind)
  const { w, h } = FORMAT_SIZE[ctx.format]
  const inset = safeInsets(ctx.format)

  const run = React.useCallback(async () => {
    if (!ref.current) return
    setBusy(true)
    const start = performance.now()
    const url = await domToPng(ref.current, { scale: EXPORT_SCALE })
    const ms = Math.round(performance.now() - start)
    const blob = await (await fetch(url)).blob()
    const img = new Image()
    img.src = url
    await img.decode()
    setExported({ url, ms, w: img.naturalWidth, h: img.naturalHeight, kb: Math.round(blob.size / 1024) })
    setBusy(false)
  }, [])

  // Zmiana wariantu, danych albo formatu unieważnia stary PNG.
  React.useEffect(() => setExported(null), [Variant, data, ctx.format, ctx.safe])
  React.useEffect(() => {
    if (exportTick > 0 && !reason) void run()
  }, [exportTick, reason, run])

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-pub-16 font-bold">{label}</h3>
        {!reason && (
          <button type="button" onClick={run} disabled={busy} className="ml-auto rounded-sm border border-hairline px-2 py-0.5 text-pub-13 hover:bg-card">
            {busy ? 'Renderuję…' : exported ? 'Odśwież PNG' : 'Eksportuj PNG'}
          </button>
        )}
      </div>
      {reason ? (
        <div className="grid place-items-center rounded-md border border-dashed border-hairline p-4 text-center text-pub-14 text-muted-foreground" style={{ width: w, height: h }}>
          Rodzaj nieaktywny: {reason}
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-3">
          <div className="relative">
            <GraphicFrame ref={ref} format={ctx.format} primaryColor={data.tournament.primaryColor}>
              <Variant kind={kind} data={data} ctx={ctx} />
            </GraphicFrame>
            {zone && ctx.format === '9:16' && (
              <div aria-hidden className="pointer-events-none absolute inset-0">
                <div className="absolute inset-x-0 top-0 bg-destructive/30" style={{ height: inset.top }} />
                <div className="absolute inset-x-0 bottom-0 bg-destructive/30" style={{ height: inset.bottom }} />
                <div className="absolute inset-y-0 left-0 bg-destructive/30" style={{ width: inset.side }} />
                <div className="absolute inset-y-0 right-0 bg-destructive/30" style={{ width: inset.side }} />
              </div>
            )}
            <p className="mt-1 text-pub-13 text-muted-foreground">DOM · {w}×{h} CSS px</p>
          </div>
          {exported && (
            <div>
              <img src={exported.url} alt={`PNG: ${label}`} style={{ width: w, height: h }} className="block outline outline-1 outline-hairline" />
              <p className="mt-1 text-pub-13 text-muted-foreground">
                PNG · {exported.w}×{exported.h} · {exported.kb} KB · {exported.ms} ms ·{' '}
                <a className="text-brand-text underline" href={exported.url} download={`grafika-${kind}-${data.key}-${ctx.format.replace(':', 'x')}.png`}>
                  Pobierz
                </a>
              </p>
            </div>
          )}
        </div>
      )}
      {kind === 'standings' && 'aheadWarning' in data.standings && data.standings.aheadWarning && (
        <p className="text-pub-13 text-brand-text">Uwaga w podglądzie (nie na grafice): {data.standings.aheadWarning}</p>
      )}
    </section>
  )
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <span className="flex overflow-hidden rounded-full border border-neutral-300">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={o.value === value ? 'bg-neutral-900 px-2.5 py-1 text-white' : 'px-2.5 py-1 hover:bg-neutral-100'}
        >
          {o.label}
        </button>
      ))}
    </span>
  )
}

/** Pływający pasek prototypu: celowo jasny i obcy dla projektu, żeby nie mylił się z grafiką. */
function Switcher({ state, set, onExportAll }: { state: State; set: (s: Partial<State>) => void; onExportAll: () => void }) {
  const index = VARIANTS.findIndex((v) => v.key === state.variant)
  const cycle = React.useCallback(
    (step: number) => set({ variant: VARIANTS[(index + step + VARIANTS.length) % VARIANTS.length]!.key }),
    [index, set],
  )
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, [contenteditable]')) return
      if (e.key === 'ArrowLeft') cycle(-1)
      if (e.key === 'ArrowRight') cycle(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cycle])
  const current = VARIANTS[index]!
  return (
    <div
      data-prototype-switcher
      className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl bg-white px-3 py-2 font-sans text-[13px] text-neutral-900 shadow-2xl ring-1 ring-black/10"
    >
      <span className="flex items-center gap-1">
        <button type="button" aria-label="Poprzedni wariant" onClick={() => cycle(-1)} className="rounded-full px-2 py-1 hover:bg-neutral-100">
          ←
        </button>
        <span className="min-w-28 text-center font-semibold">
          {current.key} ({current.name})
        </span>
        <button type="button" aria-label="Następny wariant" onClick={() => cycle(1)} className="rounded-full px-2 py-1 hover:bg-neutral-100">
          →
        </button>
      </span>
      <Seg value={state.data} options={DATASETS.map((d) => ({ value: d.key, label: d.label }))} onChange={(data) => set({ data })} />
      <Seg value={state.format} options={[{ value: '4:5', label: '4:5' }, { value: '9:16', label: '9:16' }]} onChange={(format) => set({ format })} />
      {state.format === '9:16' && (
        <>
          <Seg
            value={state.safe ? 'safe' : 'full'}
            options={[{ value: 'safe', label: 'W strefie' }, { value: 'full', label: 'Cały kadr' }]}
            onChange={(v) => set({ safe: v === 'safe' })}
          />
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={state.zone} onChange={(e) => set({ zone: e.target.checked })} />
            Pokaż strefę
          </label>
        </>
      )}
      <button type="button" onClick={onExportAll} className="rounded-full bg-neutral-900 px-3 py-1 text-white">
        Eksportuj wszystkie
      </button>
    </div>
  )
}

export function SocialGraphicPrototype() {
  const [state, setState] = React.useState<State>(readState)
  const [exportTick, setExportTick] = React.useState(0)
  const set = React.useCallback((patch: Partial<State>) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      writeState(next)
      return next
    })
  }, [])
  React.useEffect(() => writeState(state), []) // eslint-disable-line react-hooks/exhaustive-deps

  const data = DATASETS.find((d) => d.key === state.data)!
  const Variant = VARIANTS.find((v) => v.key === state.variant)!.Component
  const ctx: LayoutCtx = { format: state.format, safe: state.safe }

  return (
    <div className="min-h-screen bg-sunken p-6 pb-32">
      <p className="mb-4 max-w-3xl text-pub-14 text-muted-foreground">
        PROTOTYP #324 — trzy warianty czterech grafik (`?variant=A|B|C`, strzałki ← →), dane z seeda demo, kolor z przełącznika
        „Kolor turnieju”. „Eksportuj PNG” renderuje modern-screenshot ×{EXPORT_SCALE}; PNG stoi obok DOM do porównania.
      </p>
      <div className="flex flex-wrap gap-x-10 gap-y-8">
        {KINDS.map(({ kind, label }) => (
          <GraphicCard key={kind} kind={kind} label={label} data={data} ctx={ctx} zone={state.zone} Variant={Variant} exportTick={exportTick} />
        ))}
      </div>
      <Switcher state={state} set={set} onExportAll={() => setExportTick((n) => n + 1)} />
    </div>
  )
}
