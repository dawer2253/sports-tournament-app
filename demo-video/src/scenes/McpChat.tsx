import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Caption } from "../components/Caption";
import { PitchBackground } from "../components/Logo";
import { bodyFont, colors, typo } from "../theme";

const ease = Easing.bezier(0.16, 1, 0.3, 1);

// Prośba organizatora i wywołania narzędzi serwera MCP (`apps/mcp-server`)
// odpowiadają temu, co naprawdę poszło do API przy nagraniu sceny „mcp-panel”.
const PROMPT =
  "Załóż Turniej Szkół 2026: piłka nożna, grupy + puchar. Drużyny: SP 3 Wola, SP 7 Mokotów, SP 12 Bemowo, SP 21 Ursus, SP 34 Ochota, SP 45 Żoliborz, SP 58 Bielany, SP 63 Praga. Dwie grupy, wychodzą po dwie. Gramy 5 grudnia od 10:00 na Orliku przy Szkolnej i boisku SP 12, mecze 2 × 20 min. Kolor granatowy i opublikuj.";

const TOOLS: [string, string][] = [
  ["create_tournament", "Turniej Szkół 2026 · grupy + puchar"],
  ["add_teams", "8 drużyn dodanych"],
  ["add_venues", "Orlik przy Szkolnej, Boisko SP 12"],
  ["update_tournament", "kolor #1D4E89 · mecz 2 × 20 min"],
  ["draw_groups", "Grupa A i Grupa B, wychodzą po 2"],
  ["generate_schedule", "3 kolejki · 12 meczów"],
  ["set_schedule_dates", "5 grudnia 10:00–14:00 · 0 kolizji"],
  ["set_tournament_status", "opublikowany"],
];

const REPLY =
  "Gotowe! Turniej Szkół 2026 jest opublikowany pod /t/turniej-szkol-2026: 8 drużyn w dwóch grupach, 12 meczów 5 grudnia między 10:00 a 14:00 na dwóch boiskach, bez kolizji.";

const typed = (text: string, frame: number, start: number, cps: number, fps: number) =>
  text.slice(0, Math.max(0, Math.floor(((frame - start) / fps) * cps)));

export const McpChat: React.FC<{ step?: string; title: string; text?: string }> = ({ step, title, text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const promptStart = 0.6 * fps;
  const toolsStart = 4.4 * fps;
  const toolGap = 0.75 * fps;
  const replyStart = toolsStart + TOOLS.length * toolGap + 0.5 * fps;

  return (
    <AbsoluteFill name="Rozmowa MCP">
      <PitchBackground />
      <Interactive.Div
        name="Okno czatu"
        style={{
          position: "absolute",
          left: 250,
          top: 50,
          width: 1420,
          height: 800,
          borderRadius: 26,
          background: "#FAF9F6",
          boxShadow: "0 40px 120px rgba(0,0,0,.5)",
          overflow: "hidden",
          opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], { extrapolateRight: "clamp" }),
          scale: interpolate(frame, [0, 0.6 * fps], [0.95, 1], {
            extrapolateRight: "clamp",
            easing: ease,
            output: "perceptual-scale",
          }),
          fontFamily: bodyFont,
        }}
      >
        <div
          style={{
            height: 70,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 34px",
            borderBottom: "1px solid #E6E2DA",
            fontSize: 24,
            color: "#3B3A36",
          }}
        >
          <div style={{ fontWeight: 600 }}>Claude Desktop</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 21,
              padding: "6px 16px",
              borderRadius: 999,
              background: "#EAF4EE",
              color: colors.brand,
              fontWeight: 600,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 5, background: colors.brand }} />
            serwer MCP „turnieje”
          </div>
        </div>

        <div style={{ padding: "30px 44px", display: "flex", flexDirection: "column", gap: 22 }}>
          {/* Wiadomość organizatora */}
          <div
            style={{
              alignSelf: "flex-end",
              maxWidth: 1080,
              padding: "18px 24px",
              borderRadius: 20,
              background: "#EDE9E1",
              fontSize: 25,
              lineHeight: 1.45,
              color: "#22211E",
              minHeight: 40,
            }}
          >
            {typed(typo(PROMPT), frame, promptStart, 140, fps) || " "}
          </div>

          {/* Wywołania narzędzi */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
            {TOOLS.map(([name, result], i) => {
              const at = toolsStart + i * toolGap;
              const done = frame > at + 0.45 * fps;
              return (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "12px 18px",
                    borderRadius: 14,
                    border: "1px solid #E1DDD4",
                    background: "#fff",
                    fontSize: 21,
                    opacity: interpolate(frame, [at, at + 0.2 * fps], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                    translate: interpolate(frame, [at, at + 0.35 * fps], ["0px 14px", "0px 0px"], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: ease,
                    }),
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: 17,
                      fontWeight: 700,
                      background: done ? colors.brand : "#C9C4B9",
                    }}
                  >
                    {done ? "✓" : "…"}
                  </div>
                  <span style={{ fontFamily: "Consolas, monospace", fontWeight: 600, color: "#2F2E2A" }}>{name}</span>
                  <span style={{ color: "#6E6A62", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {done ? result : ""}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Odpowiedź agenta */}
          <div style={{ fontSize: 27, lineHeight: 1.5, color: "#22211E", maxWidth: 1250, minHeight: 80 }}>
            {typed(typo(REPLY), frame, replyStart, 95, fps)}
          </div>
        </div>
      </Interactive.Div>
      <Caption step={step} title={title} text={text} />
    </AbsoluteFill>
  );
};
