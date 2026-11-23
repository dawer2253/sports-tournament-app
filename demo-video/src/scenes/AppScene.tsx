import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption";
import { Clip, type Segment, type Zoom } from "../components/Clip";

export type AppSceneProps = {
  src: string;
  from: number;
  to: number;
  rate?: number;
  navs?: number[];
  segs?: Segment[];
  zooms?: Zoom[];
  step?: string;
  title: string;
  text?: string;
  /** Sekunda sceny, w której podpis już zniknął (gdy zasłaniałby ważną część ekranu). */
  captionUntil?: number;
};

/** Ujęcie z aplikacji na cały kadr z podpisem kroku. */
export const AppScene: React.FC<AppSceneProps> = ({ step, title, text, captionUntil, ...clip }) => {
  const { fps } = useVideoConfig();
  const caption = <Caption step={step} title={title} text={text} />;
  return (
    <AbsoluteFill name={title}>
      <Clip {...clip} />
      {captionUntil === undefined ? (
        caption
      ) : (
        <Sequence durationInFrames={Math.round(captionUntil * fps)} layout="none">
          {caption}
        </Sequence>
      )}
    </AbsoluteFill>
  );
};
