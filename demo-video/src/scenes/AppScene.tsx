import React from "react";
import { AbsoluteFill } from "remotion";
import { Caption } from "../components/Caption";
import { Clip, type Zoom } from "../components/Clip";

export type AppSceneProps = {
  src: string;
  from: number;
  to: number;
  rate?: number;
  navs?: number[];
  zooms?: Zoom[];
  step?: string;
  title: string;
  text?: string;
};

/** Ujęcie z aplikacji na cały kadr z podpisem kroku. */
export const AppScene: React.FC<AppSceneProps> = ({ step, title, text, ...clip }) => (
  <AbsoluteFill name={title}>
    <Clip {...clip} />
    <Caption step={step} title={title} text={text} />
  </AbsoluteFill>
);
