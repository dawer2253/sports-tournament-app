import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import React from "react";
import markers from "../public/clips/markers.json";
import { outLength, segments, srcToOut, type CameraKey, type Segment, type Zoom } from "./components/Clip";
import { AppScene } from "./scenes/AppScene";
import { GraphicsScene } from "./scenes/GraphicsScene";
import { Intro } from "./scenes/Intro";
import { McpDesktop } from "./scenes/McpDesktop";
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

// Rozmowa w aplikacji Claude (nagranie ekranu, sekundy nagrania). Wysłanie
// wiadomości i odpowiedzi agenta grają w 1×, czekanie na agenta jest
// przyspieszone tak jak wpisywanie w panelu.
const MCP_SEGS: Segment[] = [
  { s0: 2.6, s1: 4.6, rate: 1 }, // wklejenie i wysłanie polecenia
  { s0: 4.6, s1: 64, rate: 8 }, // agent pracuje, lista kroków się odhacza
  { s0: 64, s1: 65.5, rate: 1 }, // wszystkie kroki odhaczone, agent kończy
  // Cięcie 65,5–80,5 (ekran przeskakuje na dół odpowiedzi i wraca w górę)
  // jako przenikanie do początku odpowiedzi.
  { s0: 80.5, s1: 87, rate: 1, xfade: 0.8 }, // odpowiedź z terminarzem, czas na przeczytanie
  { s0: 87, s1: 91.6, rate: 4 }, // poprawka czeka w polu wiadomości
  { s0: 91.6, s1: 94.2, rate: 1 }, // wysłanie poprawki
  { s0: 94.2, s1: 111, rate: 6 }, // agent przelicza godziny
  { s0: 111, s1: 117.5, rate: 1 }, // odpowiedź z nowymi godzinami
];
const MCP_CAMERA: CameraKey[] = [
  { at: 2.6, scale: 1.5, x: 0.5, y: 1 }, // pole wiadomości na dole
  { at: 3.6, scale: 1.5, x: 0.5, y: 1 },
  // Polecenie i lista kroków u góry. y 0,2 zamiast 0 chowa nad kadrem pasek
  // z tytułem rozmowy, który przy zbliżeniu byłby ucięty z lewej.
  { at: 4.6, scale: 1.4, x: 0.5, y: 0.2 },
  // W czasie przenikania (od 80,5 przez 0,8 s) kamera odjeżdża do całej odpowiedzi.
  { at: 80.5, scale: 1.4, x: 0.5, y: 0.2 },
  { at: 81.3, scale: 1.2, x: 0.5, y: 0.5 }, // cała odpowiedź
  { at: 89, scale: 1.2, x: 0.5, y: 0.5 },
  { at: 91.6, scale: 1.2, x: 0.5, y: 0.75 }, // poprawka w polu wiadomości
  { at: 111, scale: 1.2, x: 0.5, y: 0.75 },
  { at: 112.2, scale: 1.2, x: 0.5, y: 0.4 }, // nowe godziny
];
const mcpSeconds = outLength(MCP_SEGS);

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
    title: "Kibic widzi to na bieżąco",
    text: "Wynik, przerwa i zdarzenia meczu na jego stronie - odświeżanej automatycznie co 15 sekund.",
  }),
  {
    id: "mcp",
    seconds: mcpSeconds,
    el: (
      <McpDesktop
        segs={MCP_SEGS}
        camera={MCP_CAMERA}
        caption={[srcToOut(MCP_SEGS, 4.2), srcToOut(MCP_SEGS, 64.8)]}
        step="10"
        title="Agent AI przez MCP"
        text="Organizator pisze zwykłym językiem w aplikacji Claude, a agent zakłada cały turniej i poprawia go na prośbę."
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
