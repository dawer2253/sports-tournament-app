import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caption } from "../components/Caption";
import { Clip, type Segment } from "../components/Clip";
import { bodyFont, headingFont, typo } from "../theme";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

/** Zakładka Grafiki, a po kliknięciu „Pobierz PNG” - pobrany plik na pierwszym planie. */
export const GraphicsScene: React.FC<{
  from: number;
  to: number;
  navs?: number[];
  rate: number;
  segs?: Segment[];
  revealAt: number;
  step?: string;
  title: string;
  text?: string;
}> = ({ from, to, navs, rate, segs, revealAt, step, title, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const r = revealAt * fps;

  return (
    <AbsoluteFill name="Grafiki">
      <Clip src="grafiki" from={from} to={to} rate={rate} navs={navs} segs={segs} />
      <AbsoluteFill
        style={{
          // Pełne krycie: nagranie kończy się chwilę po odsłonięciu pliku.
          background: "radial-gradient(circle at 30% 30%, #17583A 0%, #0E3B22 55%, #07160E 100%)",
          opacity: interpolate(frame, [r, r + 0.35 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
      <Interactive.Div
        name="Pobrany PNG"
        style={{
          position: "absolute",
          left: 1100,
          top: 70,
          height: 860,
          width: (860 * 1440) / 1800,
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 40px 100px rgba(0,0,0,.6)",
          opacity: interpolate(frame, [r, r + 0.3 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [r, r + 0.9 * fps], ["0px 160px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          }),
          rotate: interpolate(frame, [r, r + 0.9 * fps], ["6deg", "-2deg"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          }),
        }}
      >
        <Img src={staticFile("clips/grafika.png")} style={{ width: "100%", height: "100%" }} />
      </Interactive.Div>
      <Interactive.Div
        name="Opis pliku"
        style={{
          position: "absolute",
          left: 120,
          top: 300,
          width: 860,
          color: "#fff",
          opacity: interpolate(frame, [r + 0.3 * fps, r + 0.8 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 120, lineHeight: 0.95, textTransform: "uppercase" }}>
          Gotowe do wrzucenia
        </div>
        <div style={{ marginTop: 26, fontFamily: bodyFont, fontSize: 40, color: "#CFE3D7", lineHeight: 1.35 }}>
          {typo("PNG 1440 × 1800 w barwach turnieju - z panelu prosto na Instagram czy Facebooka.")}
        </div>
      </Interactive.Div>
      <Sequence durationInFrames={Math.round(r)} layout="none">
        <Caption step={step} title={title} text={text} />
      </Sequence>

    </AbsoluteFill>
  );
};
