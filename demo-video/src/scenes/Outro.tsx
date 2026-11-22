import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { LogoMark, PitchBackground } from "../components/Logo";
import { bodyFont, headingFont, typo } from "../theme";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

const MORE = [
  "Drabinka pucharowa i faza grupowa",
  "Statystyki i klasyfikacja strzelców",
  "Zgłoszenia drużyn ze strony publicznej",
  "Piłka nożna, koszykówka, siatkówka",
];

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill name="Outro">
      <PitchBackground drift={interpolate(frame, [0, 7 * fps], [0, 60])} />
      <AbsoluteFill style={{ padding: "150px 160px", flexDirection: "row", alignItems: "center", gap: 120 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 96, color: "#fff", textTransform: "uppercase", lineHeight: 1 }}>
            A to nie wszystko
          </div>
          <div style={{ marginTop: 46, display: "flex", flexDirection: "column", gap: 22 }}>
            {MORE.map((item, i) => (
              <Interactive.Div
                key={item}
                name={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 22,
                  fontFamily: bodyFont,
                  fontSize: 44,
                  color: "#E3EFE8",
                  opacity: interpolate(frame, [(0.5 + i * 0.35) * fps, (0.9 + i * 0.35) * fps], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  translate: interpolate(frame, [(0.5 + i * 0.35) * fps, (1.1 + i * 0.35) * fps], ["-40px 0px", "0px 0px"], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                    easing: ease,
                  }),
                }}
              >
                <div style={{ width: 16, height: 16, borderRadius: 8, background: "#3DBA74", flexShrink: 0 }} />
                {typo(item)}
              </Interactive.Div>
            ))}
          </div>
        </div>
        <Interactive.Div
          name="Logo końcowe"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 30,
            opacity: interpolate(frame, [2 * fps, 2.6 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            scale: interpolate(frame, [2 * fps, 2.8 * fps], [0.85, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 14 }),
              output: "perceptual-scale",
            }),
          }}
        >
          <LogoMark size={150} />
          <div style={{ fontFamily: headingFont, fontWeight: 800, fontSize: 96, color: "#fff" }}>
            Tournament<span style={{ color: "#3DBA74" }}>App</span>
          </div>
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
