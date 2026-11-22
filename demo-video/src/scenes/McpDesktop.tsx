import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption";
import { Clip, type CameraKey, type Segment } from "../components/Clip";

/**
 * Prawdziwa rozmowa w aplikacji Claude z serwerem MCP „turnieje”, nagrana
 * z ekranu (`clips/mcp-desktop.mp4`). Podpis pojawia się po wysłaniu
 * polecenia (wcześniej zasłaniałby pole wiadomości) i znika, zanim odpowiedź
 * agenta wypełni dół kadru. `caption` to [od, do] w sekundach sceny.
 */
export const McpDesktop: React.FC<{
  segs: Segment[];
  camera: CameraKey[];
  caption: [number, number];
  step: string;
  title: string;
  text: string;
}> = ({ segs, camera, caption, step, title, text }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill name={title} style={{ backgroundColor: "#1f1f1e" }}>
      <Clip src="mcp-desktop" from={segs[0].s0} to={segs[segs.length - 1].s1} segs={segs} camera={camera} />
      <Sequence
        from={Math.round(caption[0] * fps)}
        durationInFrames={Math.round((caption[1] - caption[0]) * fps)}
        layout="none"
      >
        <Caption step={step} title={title} text={text} />
      </Sequence>
    </AbsoluteFill>
  );
};
