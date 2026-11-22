import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { bodyFont, colors, headingFont, typo } from "../theme";

/**
 * Podpis w dolnym lewym rogu: numer kroku, tytuł i jedno zdanie. Wjeżdża
 * po 0,3 s i znika 0,5 s przed końcem sceny, żeby nie wisiał na przejściu.
 */
export const Caption: React.FC<{
  step?: string;
  title: string;
  text?: string;
  dark?: boolean;
}> = ({ step, title, text, dark = false }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);

  return (
    <div
      style={{
        position: "absolute",
        left: 56,
        bottom: 56,
        maxWidth: 860,
        display: "flex",
        gap: 22,
        alignItems: "stretch",
        padding: "22px 30px 24px 24px",
        borderRadius: 22,
        background: dark ? "rgba(255,255,255,.96)" : "rgba(11,20,16,.88)",
        boxShadow: "0 18px 50px rgba(0,0,0,.28)",
        opacity: interpolate(
          frame,
          [0.3 * fps, 0.8 * fps, durationInFrames - 0.9 * fps, durationInFrames - 0.4 * fps],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        ),
        translate: interpolate(frame, [0.3 * fps, 0.9 * fps], ["0px 40px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: ease,
        }),
      }}
    >
      <div style={{ width: 8, borderRadius: 4, background: colors.brand }} />
      <div>
        <div
          style={{
            fontFamily: headingFont,
            fontWeight: 700,
            fontSize: 58,
            lineHeight: 1,
            textTransform: "uppercase",
            color: dark ? colors.ink : "#fff",
          }}
        >
          {step && <span style={{ color: dark ? colors.brand : "#3DBA74" }}>{step} </span>}
          {typo(title)}
        </div>
        {text && (
          <div
            style={{
              marginTop: 10,
              fontFamily: bodyFont,
              fontSize: 30,
              lineHeight: 1.3,
              color: dark ? "#3a4a42" : "#D5E2DA",
            }}
          >
            {typo(text)}
          </div>
        )}
      </div>
    </div>
  );
};
