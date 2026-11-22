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

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill name="Intro">
      <PitchBackground drift={interpolate(frame, [0, 5 * fps], [0, -60])} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <Interactive.Div
          name="Logo"
          style={{
            scale: interpolate(frame, [0, 0.8 * fps], [0.6, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.spring({ damping: 12 }),
              output: "perceptual-scale",
            }),
            opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <LogoMark size={170} />
        </Interactive.Div>
        <Interactive.Div
          name="Title"
          style={{
            marginTop: 44,
            fontFamily: headingFont,
            fontWeight: 800,
            fontSize: 150,
            lineHeight: 1,
            color: "#fff",
            letterSpacing: 1,
            opacity: interpolate(frame, [0.4 * fps, 1.1 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(frame, [0.4 * fps, 1.2 * fps], ["0px 40px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: ease,
            }),
          }}
        >
          Tournament<span style={{ color: "#3DBA74" }}>App</span>
        </Interactive.Div>
        <Interactive.Div
          name="Subtitle"
          style={{
            marginTop: 26,
            fontFamily: bodyFont,
            fontSize: 46,
            color: "#CFE3D7",
            opacity: interpolate(frame, [1.1 * fps, 1.8 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {typo("Liga od zera do strony dla kibiców - krok po kroku")}
        </Interactive.Div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
