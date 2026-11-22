import { Video } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/** Najazd kamery: od `at` do `to` (sekundy nagrania) skala i punkt, w który patrzymy (0–1). */
export type Zoom = { at: number; to: number; scale: number; x: number; y: number };

/** Odcinek nagrania [s0, s1] (sekundy) grany w tempie `rate`. */
export type Segment = { s0: number; s1: number; rate: number };

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

/** Długość odcinków w sekundach filmu. */
export const outLength = (segs: Segment[]) => segs.reduce((sum, g) => sum + (g.s1 - g.s0) / g.rate, 0);

/** Sekunda nagrania → sekunda filmu. */
export function srcToOut(segs: Segment[], t: number): number {
  let acc = 0;
  for (const g of segs) {
    if (t <= g.s1) return acc + (Math.max(t, g.s0) - g.s0) / g.rate;
    acc += (g.s1 - g.s0) / g.rate;
  }
  return acc;
}

const ease = Easing.bezier(0.65, 0, 0.35, 1);

/**
 * Ujęcie z nagrania aplikacji (1920×1080) na cały kadr, od sekundy `from` do
 * `to`, przyspieszone `rate` poza kliknięciami nawigacji. Najazdy kamery
 * wchodzą i schodzą płynnie w 0,6 s.
 */
export const Clip: React.FC<{
  src: string;
  from: number;
  to: number;
  rate?: number;
  navs?: number[];
  zooms?: Zoom[];
}> = ({ src, from, to, rate = 1, navs = [], zooms = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const segs = segments(from, to, rate, navs);

  let scale = 1;
  let ox = 0.5;
  let oy = 0.5;
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
  let acc = 0;
  const parts = segs.map((g) => {
    const start = Math.round(acc * fps);
    acc += (g.s1 - g.s0) / g.rate;
    return { ...g, start, end: Math.round(acc * fps) };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#fff", overflow: "hidden" }}>
      <AbsoluteFill style={{ scale: String(scale), transformOrigin: `${ox * 100}% ${oy * 100}%` }}>
        {parts.map((g, i) => (
          <Sequence
            key={i}
            from={g.start}
            // Ostatni odcinek trzyma ostatnią klatkę do końca sceny.
            durationInFrames={i === parts.length - 1 ? Infinity : Math.max(1, g.end - g.start)}
            layout="absolute-fill"
          >
            <Video
              src={staticFile(`clips/${src}.mp4`)}
              trimBefore={Math.round(g.s0 * fps)}
              playbackRate={g.rate}
              muted
              style={{ width: "100%", height: "100%" }}
            />
          </Sequence>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
