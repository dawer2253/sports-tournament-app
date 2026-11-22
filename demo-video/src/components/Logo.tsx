import React from "react";
import { colors } from "../theme";

/** Puchar w zielonym kafelku, jak logo panelu („TournamentApp”). */
export const LogoMark: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.24,
      background: colors.brand,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 20px 60px rgba(31,122,69,.45)",
    }}
  >
    <svg
      width={size * 0.58}
      height={size * 0.58}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  </div>
);

/** Tło planszy: ciemna zieleń z liniami boiska. */
export const PitchBackground: React.FC<{ drift?: number }> = ({ drift = 0 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: `radial-gradient(circle at 30% 20%, #17583A 0%, ${colors.brandDark} 55%, #07160E 100%)`,
      overflow: "hidden",
    }}
  >
    <svg
      width="2400"
      height="1400"
      viewBox="0 0 2400 1400"
      style={{ position: "absolute", left: -240 + drift, top: -160, opacity: 0.09 }}
      fill="none"
      stroke="#fff"
      strokeWidth={6}
    >
      <rect x="120" y="120" width="2160" height="1160" />
      <line x1="1200" y1="120" x2="1200" y2="1280" />
      <circle cx="1200" cy="700" r="190" />
      <rect x="120" y="420" width="300" height="560" />
      <rect x="1980" y="420" width="300" height="560" />
    </svg>
  </div>
);
