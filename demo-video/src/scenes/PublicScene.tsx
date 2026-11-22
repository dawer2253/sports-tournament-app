import { Video } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caption } from "../components/Caption";
import { bodyFont } from "../theme";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

/** Strona publiczna: komputer w oknie przeglądarki i telefon obok. */
export const PublicScene: React.FC<{
  desktopFrom: number;
  desktopRate: number;
  phoneFrom: number;
  phoneRate: number;
  step?: string;
  title: string;
  text?: string;
}> = ({ desktopFrom, desktopRate, phoneFrom, phoneRate, step, title, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const browserW = 1300;
  const browserH = (browserW * 1080) / 1920;

  return (
    <AbsoluteFill
      name="Strona publiczna"
      style={{ background: "radial-gradient(circle at 25% 15%, #3A1520 0%, #12161C 60%, #0A0D11 100%)" }}
    >
      <Interactive.Div
        name="Przeglądarka"
        style={{
          position: "absolute",
          left: 80,
          top: 96,
          width: browserW,
          borderRadius: 18,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,.55)",
          border: "1px solid rgba(255,255,255,.12)",
          translate: interpolate(frame, [0, 0.8 * fps], ["-60px 0px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          }),
        }}
      >
        <div
          style={{
            height: 54,
            background: "#1C2129",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 22px",
          }}
        >
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => (
            <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
          ))}
          <div
            style={{
              marginLeft: 24,
              flex: 1,
              height: 34,
              borderRadius: 10,
              background: "#0F1318",
              color: "#AEB6C2",
              fontFamily: bodyFont,
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              paddingLeft: 18,
            }}
          >
            /t/liga-podworkowa-2026
          </div>
        </div>
        <div style={{ width: browserW, height: browserH, position: "relative", background: "#12161C" }}>
          <Video
            src={staticFile("clips/publiczna.mp4")}
            trimBefore={Math.round(desktopFrom * fps)}
            playbackRate={desktopRate}
            muted
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </Interactive.Div>

      <Interactive.Div
        name="Telefon"
        style={{
          position: "absolute",
          right: 90,
          top: 70,
          width: 420,
          height: 900,
          borderRadius: 64,
          padding: 16,
          background: "#05070A",
          boxShadow: "0 30px 90px rgba(0,0,0,.6), inset 0 0 0 3px #2A2F37",
          opacity: interpolate(frame, [0.4 * fps, 1 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0.4 * fps, 1.3 * fps], ["0px 120px", "0px 0px"], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: ease,
          }),
        }}
      >
        <div style={{ width: "100%", height: "100%", borderRadius: 50, overflow: "hidden", position: "relative" }}>
          <Video
            src={staticFile("clips/telefon.mp4")}
            trimBefore={Math.round(phoneFrom * fps)}
            playbackRate={phoneRate}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }}
          />
        </div>
      </Interactive.Div>

      <Caption step={step} title={title} text={text} dark />
    </AbsoluteFill>
  );
};
