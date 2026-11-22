import { loadFont as loadBarlow } from "@remotion/google-fonts/BarlowCondensed";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";

// Te same kroje co w aplikacji: Inter w treści, Barlow Condensed w nagłówkach.
export const { fontFamily: headingFont } = loadBarlow("normal", {
  weights: ["600", "700", "800"],
  subsets: ["latin", "latin-ext"],
});
export const { fontFamily: bodyFont } = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
});

export const FPS = 30;

export const colors = {
  // „Murawa” - domyślny kolor wiodący aplikacji (BRAND_PALETTES[0]).
  brand: "#1F7A45",
  brandDark: "#0E3B22",
  ink: "#0B1410",
  paper: "#F6F8F7",
  muted: "#9FB3A8",
  bordo: "#9B1C31",
  granat: "#1D4E89",
};

/** Sekundy na klatki kompozycji. */
export const s = (seconds: number) => Math.round(seconds * FPS);

const NBSP = " ";
// Jednoliterowe słowo po początku tekstu, spacji, nawiasie albo cudzysłowie.
// Dwa przebiegi, bo sąsiednie spójniki („i w”) dzielą spację między dopasowania.
const SHORT_WORD = /(^|[\s(„])([aiouwzAIOUWZ]) /g;

/**
 * Typografia podpisów: jednoliterowe spójniki i przyimki (a, i, o, u, w, z)
 * wiążą się twardą spacją z następnym słowem, żeby nie zostawały na końcu
 * linii, a myślnik - z poprzednim, żeby nie otwierał nowej.
 */
export const typo = (text: string) =>
  text
    .replace(SHORT_WORD, `$1$2${NBSP}`)
    .replace(SHORT_WORD, `$1$2${NBSP}`)
    .replace(/ - /g, `${NBSP}- `);
