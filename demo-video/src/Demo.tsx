import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import React from "react";
import markers from "../public/clips/markers.json";
import { outLength, segments, srcToOut, type Zoom } from "./components/Clip";
import { AppScene } from "./scenes/AppScene";
import { GraphicsScene } from "./scenes/GraphicsScene";
import { Intro } from "./scenes/Intro";
import { McpChat } from "./scenes/McpChat";
import { Outro } from "./scenes/Outro";
import { PublicScene } from "./scenes/PublicScene";
import { s } from "./theme";

// Przejście trwa 12 klatek i zjada tyle z obu sąsiednich scen.
export const TRANSITION = 12;

type Recording = { marks: Record<string, number>; navs?: number[] };
const REC = markers as unknown as Record<string, Recording>;

/** Sekunda nagrania: liczba wprost albo nazwa znacznika z `markers.json`. */
const at = (src: string, point: string | number) =>
  typeof point === "number" ? point : REC[src].marks[point];

/**
 * Fragment nagrania [from, to] w tempie `rate` poza kliknięciami nawigacji
 * (te grają w 1×). Zwraca propsy ujęcia i długość sceny w sekundach.
 */
function cut(src: string, from: string | number, to: string | number, rate: number) {
  const f = at(src, from);
  const t = at(src, to);
  const navs = (REC[src].navs ?? []).filter((n) => n >= f && n <= t);
  const segs = segments(f, t, rate, navs);
  return { clip: { src, from: f, to: t, rate, navs }, seconds: outLength(segs), segs };
}

/** Najazd kamery między dwoma znacznikami nagrania. */
const zoom = (src: string, a: string | number, b: string | number, scale: number, x: number, y: number): Zoom => ({
  at: at(src, a),
  to: at(src, b),
  scale,
  x,
  y,
});

type Scene = { id: string; seconds: number; el: React.ReactNode };

function app(
  id: string,
  src: string,
  range: [string | number, string | number],
  rate: number,
  caption: { step?: string; title: string; text?: string },
  zooms: Zoom[] = [],
): Scene {
  const { clip, seconds } = cut(src, range[0], range[1], rate);
  return { id, seconds, el: <AppScene {...clip} zooms={zooms} {...caption} /> };
}

// Strona publiczna: komputer o włos przyspieszony, telefon dopasowany do długości sceny.
// Oba ujęcia grają jednym tempem (bez zwolnień przy nawigacji), bo 1,12× to prawie 1×.
const desktopFrom = at("publiczna", "start");
const desktopSeconds = (at("publiczna", "koniec") - desktopFrom) / 1.12;
const phoneFrom = at("telefon", "start");
const phoneRate = (at("telefon", "koniec") - phoneFrom) / desktopSeconds;

// Grafiki: plik wjeżdża 1,3 s po kliknięciu „Pobierz PNG” i zostaje 3,1 s.
const graphics = cut("grafiki", "start", "koniec", 1.4);
const revealAt = srcToOut(graphics.segs, at("grafiki", "pobierz")) + 1.3;

export const SCENES: Scene[] = [
  { id: "intro", seconds: 5, el: <Intro /> },
  app("panel", "logowanie", ["start", "koniec"], 1.25, {
    step: "01",
    title: "Panel organizatora",
    text: "Logowanie na konto administratora i wszystkie turnieje w jednym miejscu.",
  }),
  app("nowy", "nowy-turniej", ["start", "koniec"], 1.3, {
    step: "02",
    title: "Nowy turniej",
    text: "Nazwa, sport i format: liga, puchar albo grupy z fazą pucharową.",
  }),
  app("druzyny", "druzyny", ["start", "sklad"], 2, {
    step: "03",
    title: "Drużyny",
    text: "Cztery drużyny w kilkanaście sekund - herby z inicjałami powstają same.",
  }),
  app(
    "zawodnicy",
    "druzyny",
    ["sklad", "koniec"],
    3.5,
    {
      step: "04",
      title: "Zawodnicy",
      text: "Skład z numerami i pozycjami - z niego liczy się klasyfikacja strzelców.",
    },
    [zoom("druzyny", at("druzyny", "sklad") + 2.5, "koniec", 1.25, 0.5, 0.35)],
  ),
  app(
    "terminarz",
    "terminarz",
    ["start", "koniec"],
    2,
    {
      step: "05",
      title: "Mecze i wyniki",
      text: "Terminarz każdy z każdym, daty jednym oknem, wynik meczu - tabela liczy się sama.",
    },
    [zoom("terminarz", at("terminarz", "wynik") + 0.4, at("terminarz", "tabela") - 0.3, 1.4, 0.5, 0.3)],
  ),
  app(
    "ustawienia",
    "ustawienia",
    ["start", "koniec"],
    1.4,
    {
      step: "06",
      title: "Edycja turnieju",
      text: "Długość meczu, kolor wiodący strony i publikacja jednym przyciskiem.",
    },
    [zoom("ustawienia", "kolor", at("ustawienia", "publikacja") - 0.2, 1.55, 0.72, 0.32)],
  ),
  {
    id: "publiczna",
    seconds: desktopSeconds,
    el: (
      <PublicScene
        desktopFrom={desktopFrom}
        desktopRate={1.12}
        phoneFrom={phoneFrom}
        phoneRate={phoneRate}
        step="07"
        title="Strona dla kibiców"
        text="Przegląd, tabela i terminarz w kolorze turnieju - także na telefonie."
      />
    ),
  },
  {
    id: "grafiki",
    seconds: revealAt + 3.1,
    el: (
      <GraphicsScene
        {...graphics.clip}
        revealAt={revealAt}
        step="08"
        title="Grafiki do social mediów"
        text="Zapowiedź, wynik, tabela albo klasyfikacja - w formacie posta lub relacji."
      />
    ),
  },
  app(
    "mecz",
    "mecz",
    ["start", "koniec"],
    2,
    {
      step: "09",
      title: "Mecz na żywo",
      text: "Start meczu, gole i kartki z minutą. Wynik liczy się sam, a zegar odmierza połowy.",
    },
    [zoom("mecz", at("mecz", "rozpocznij") - 0.8, "koniec", 1.15, 0.5, 0.5)],
  ),
  app("mecz-kibic", "mecz-kibic", ["start", "koniec"], 1, {
    title: "Kibic widzi to od razu",
    text: "Wynik, przerwa i relacja minuta po minucie na stronie meczu.",
  }),
  {
    id: "mcp",
    seconds: 16.5,
    el: (
      <McpChat
        step="10"
        title="Agent AI przez MCP"
        text="Organizator pisze zwykłym językiem, a agent zakłada cały turniej."
      />
    ),
  },
  app("mcp-panel", "mcp-panel", ["start", "koniec"], 1.15, {
    title: "Od razu w panelu",
    text: "8 szkół, 2 grupy, 12 meczów na dwóch boiskach - bez jednego kliknięcia.",
  }),
  { id: "outro", seconds: 8, el: <Outro /> },
];

export const DEMO_DURATION =
  SCENES.reduce((sum, scene) => sum + s(scene.seconds), 0) - (SCENES.length - 1) * TRANSITION;

export const Demo: React.FC = () => (
  <TransitionSeries>
    {SCENES.flatMap((scene, i) => {
      const items = [
        <TransitionSeries.Sequence key={scene.id} name={scene.id} durationInFrames={s(scene.seconds)}>
          {scene.el}
        </TransitionSeries.Sequence>,
      ];
      if (i < SCENES.length - 1) {
        // Plansze (MCP, outro) wjeżdżają slajdem, ujęcia z aplikacji przenikają się.
        const next = SCENES[i + 1].id;
        const presentation = ["mcp", "outro"].includes(next) ? slide({ direction: "from-right" }) : fade();
        items.push(
          <TransitionSeries.Transition
            key={`${scene.id}-t`}
            presentation={presentation}
            timing={linearTiming({ durationInFrames: TRANSITION })}
          />,
        );
      }
      return items;
    })}
  </TransitionSeries>
);
