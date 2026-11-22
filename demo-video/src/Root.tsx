import React from "react";
import { Composition, Folder } from "remotion";
import { Demo, DEMO_DURATION, SCENES } from "./Demo";
import { FPS, s } from "./theme";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="DemoTurnieju"
      component={Demo}
      durationInFrames={DEMO_DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Folder name="Sceny">
      {SCENES.map((scene) => (
        <Composition
          key={scene.id}
          id={`scena-${scene.id}`}
          component={() => <>{scene.el}</>}
          durationInFrames={s(scene.seconds)}
          fps={FPS}
          width={1920}
          height={1080}
        />
      ))}
    </Folder>
  </>
);
