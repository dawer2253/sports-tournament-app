/**
 * Parametr story strony publicznej: bez nadpisania koloru turnieju
 * z przełącznika „Kolor turnieju” (dekorator w `.storybook/public-root.tsx`).
 * Dla stories z kilkoma próbkami naraz i dla „Brak turnieju”.
 */
export const ownBrand = { brandColor: { disable: true } } as const
