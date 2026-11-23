import { Video } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Freeze,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/** Najazd kamery: od `at` do `to` (sekundy nagrania) skala i punkt, w który patrzymy (0–1). */
export type Zoom = { at: number; to: number; scale: number; x: number; y: number };

/**
 * Odcinek nagrania [s0, s1] (sekundy) grany w tempie `rate`. `xfade` (sekundy
 * filmu): odcinek wchodzi tyle wcześniej, przenikając się z poprzednim —
 * łagodne cięcie zamiast skoku obrazu. `hold` (sekundy filmu): po odcinku
 * kadr stoi na jego ostatniej klatce, żeby widz zdążył obejrzeć wynik.
 */
export type Segment = { s0: number; s1: number; rate: number; xfade?: number; hold?: number };

/** Długość odcinka w filmie razem z przytrzymaniem, bez przenikania. */
const segLength = (g: Segment) => (g.s1 - g.s0) / g.rate + (g.hold ?? 0);

/**
 * Ujęcie kamery w sekundzie nagrania `at`: skala i punkt, w który patrzymy
 * (0–1). Między ujęciami kamera przechodzi płynnie.
 */
export type CameraKey = { at: number; scale: number; x: number; y: number };

// Ile przed kliknięciem nawigacji i ile po nim nagranie gra w 1×: kursor
// dojeżdża do zakładki, klik, nowy widok ma chwilę, żeby się pokazać.
const NAV_BEFORE = 0.6;
const NAV_AFTER = 1.4;

/**
 * Tnie nagranie [from, to] na odcinki: wokół kliknięć nawigacji (`navs`,
 * sekundy nagrania) tempo 1×, poza nimi `rate`. Wpisywanie i zaznaczanie
 * zostaje przyspieszone, a przejścia między ekranami widać w zwykłym tempie.
 */
export function segments(from: number, to: number, rate: number, navs: number[] = []): Segment[] {
  if (rate <= 1) return [{ s0: from, s1: to, rate }];
  const windows: [number, number][] = [];
  for (const t of [...navs].sort((a, b) => a - b)) {
    const a = Math.max(from, t - NAV_BEFORE);
    const b = Math.min(to, t + NAV_AFTER);
    if (b <= a) continue;
    const last = windows[windows.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else windows.push([a, b]);
  }
  const out: Segment[] = [];
  let cursor = from;
  for (const [a, b] of windows) {
    if (a > cursor) out.push({ s0: cursor, s1: a, rate });
    out.push({ s0: a, s1: b, rate: 1 });
    cursor = b;
  }
  if (cursor < to) out.push({ s0: cursor, s1: to, rate });
  return out;
}

/**
 * Wstawia przytrzymania kadru: `[sekunda nagrania, ile sekund filmu]`. Odcinek,
 * w który wypada przytrzymanie, dzieli się w tym miejscu na dwa.
 */
export function withHolds(segs: Segment[], holds: [number, number][]): Segment[] {
  let out = segs;
  for (const [at, seconds] of holds) {
    out = out.flatMap((g) => {
      if (at <= g.s0 || at > g.s1) return [g];
      if (at === g.s1) return [{ ...g, hold: (g.hold ?? 0) + seconds }];
      return [
        { ...g, s1: at, hold: seconds },
        { s0: at, s1: g.s1, rate: g.rate, hold: g.hold },
      ];
    });
  }
  return out;
}

/**
 * Wycina z odcinków fragmenty nagrania `[od, do]` (sekundy nagrania) — postoje,
 * w których nic się nie dzieje. Na nieruchomym ekranie cięcia nie widać.
 */
export function withCuts(segs: Segment[], cuts: [number, number][]): Segment[] {
  let out = segs;
  for (const [a, b] of cuts) {
    out = out.flatMap((g) => {
      if (b <= g.s0 || a >= g.s1) return [g];
      const parts: Segment[] = [];
      if (a > g.s0) parts.push({ ...g, s1: a, hold: undefined });
      if (b < g.s1) parts.push({ s0: b, s1: g.s1, rate: g.rate, hold: g.hold });
      return parts;
    });
  }
  return out;
}

/** Długość odcinków w sekundach filmu. */
export const outLength = (segs: Segment[]) => segs.reduce((sum, g) => sum + segLength(g) - (g.xfade ?? 0), 0);

/**
 * Sekunda nagrania → sekunda filmu. Odcinek z `xfade` zaczyna się w filmie
 * przed końcem poprzedniego, więc na styku czasy się zakładają.
 */
export function srcToOut(segs: Segment[], t: number): number {
  let acc = 0;
  for (const g of segs) {
    acc -= g.xfade ?? 0;
    if (t <= g.s1) return acc + (Math.max(t, g.s0) - g.s0) / g.rate;
    acc += segLength(g);
  }
  return acc;
}

const ease = Easing.bezier(0.65, 0, 0.35, 1);

/** Odcinek z `xfade` wchodzi przez przenikanie nad poprzednim. */
const FadeIn: React.FC<{ seconds: number; children: React.ReactNode }> = ({ seconds, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity =
    seconds > 0 ? interpolate(frame, [0, seconds * fps], [0, 1], { extrapolateRight: "clamp", easing: ease }) : 1;
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/**
 * Ujęcie z nagrania aplikacji (1920×1080) na cały kadr, od sekundy `from` do
 * `to`, przyspieszone `rate` poza kliknięciami nawigacji. Najazdy kamery
 * wchodzą i schodzą płynnie w 0,6 s. Zamiast tego można podać własne odcinki
 * (`segs`) i ujęcia kamery (`camera`), gdy tempo zmienia się w scenie kilka razy.
 */
export const Clip: React.FC<{
  src: string;
  from: number;
  to: number;
  rate?: number;
  navs?: number[];
  zooms?: Zoom[];
  segs?: Segment[];
  camera?: CameraKey[];
}> = ({ src, from, to, rate = 1, navs = [], zooms = [], segs: ownSegs, camera = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const segs = ownSegs ?? segments(from, to, rate, navs);

  let scale = 1;
  let ox = 0.5;
  let oy = 0.5;
  if (camera.length > 1) {
    const times = camera.map((k) => srcToOut(segs, k.at));
    const opts = { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease } as const;
    scale = interpolate(t, times, camera.map((k) => k.scale), opts);
    ox = interpolate(t, times, camera.map((k) => k.x), opts);
    oy = interpolate(t, times, camera.map((k) => k.y), opts);
  }
  for (const z of zooms) {
    const a = srcToOut(segs, z.at);
    const b = srcToOut(segs, z.to);
    const p = interpolate(t, [a, a + 0.6, b - 0.6, b], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: ease,
    });
    if (p > 0) {
      scale = 1 + (z.scale - 1) * p;
      ox = z.x;
      oy = z.y;
    }
  }

  // Granice odcinków liczone narastająco, żeby zaokrąglenia nie robiły dziur.
  // Przytrzymanie to osobna część: zamrożona ostatnia klatka odcinka.
  type Part = { g: Segment; freeze: boolean; start: number; end: number };
  const parts: Part[] = [];
  let acc = 0;
  for (const g of segs) {
    acc -= g.xfade ?? 0;
    const start = Math.round(acc * fps);
    acc += (g.s1 - g.s0) / g.rate;
    const end = Math.round(acc * fps);
    parts.push({ g, freeze: false, start, end });
    if (g.hold) {
      acc += g.hold;
      parts.push({ g, freeze: true, start: end, end: Math.round(acc * fps) });
    }
  }

  return (
    <AbsoluteFill style={{ backgroundColor: "#fff", overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: String(scale), transformOrigin: `${ox * 100}% ${oy * 100}%` }}>
        {parts.map(({ g, freeze, start, end }, i) => {
          const video = (
            <Video
              src={staticFile(`clips/${src}.mp4`)}
              trimBefore={Math.round((freeze ? g.s1 : g.s0) * fps)}
              playbackRate={g.rate}
              muted
              style={{ width: "100%", height: "100%" }}
            />
          );
          return (
            <Sequence
              key={i}
              from={start}
              // Ostatnia część trzyma ostatnią klatkę do końca sceny.
              durationInFrames={i === parts.length - 1 ? Infinity : Math.max(1, end - start)}
              layout="absolute-fill"
            >
              {freeze ? <Freeze frame={0}>{video}</Freeze> : <FadeIn seconds={g.xfade ?? 0}>{video}</FadeIn>}
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
