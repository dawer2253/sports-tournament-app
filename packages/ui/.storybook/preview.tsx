import type { Preview } from '@storybook/react-vite'
import './preview.css'
import { BRAND_COLOR_SAMPLES, type BrandColorSample } from '../src/lib/brand-on-dark'
import { PUBLIC_ROOT, PublicRoot } from './public-root'
import { ThemeRoot, type Theme } from './theme-root'

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'todo' },
    options: {
      // Dwa korzenie: Panel (shadcn, jasny i ciemny) i Strona publiczna
      // (zawsze ciemna, własne klocki z `src/public/`, #289).
      storySort: {
        order: [
          'Panel',
          ['Wprowadzenie', 'Fundamenty', 'UI', ['Prymitywy', 'Dane', 'Układ'], 'Ekrany'],
          'Strona publiczna',
          ['Wprowadzenie', 'Fundamenty', 'Komponenty', 'Ekrany', 'Do przepisania'],
        ],
      },
    },
  },
  globalTypes: {
    theme: {
      description: 'Motyw (tylko Panel; strona publiczna jest zawsze ciemna)',
      toolbar: {
        title: 'Motyw',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Jasny', icon: 'sun' },
          { value: 'dark', title: 'Ciemny', icon: 'moon' },
        ],
        dynamicTitle: true,
      },
    },
    brandColor: {
      description: 'Kolor turnieju (tylko Strona publiczna)',
      toolbar: {
        title: 'Kolor turnieju',
        icon: 'paintbrush',
        items: Object.entries(BRAND_COLOR_SAMPLES).map(([value, sample]) => ({ value, title: sample.label })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light', brandColor: 'zielen' satisfies BrandColorSample },
  decorators: [
    (Story, context) => {
      if (context.title.startsWith(PUBLIC_ROOT)) {
        const sample: BrandColorSample = context.globals.brandColor ?? 'zielen'
        // `parameters.brandColor.disable`: story trzyma kolor z danych
        // („Brak turnieju” zostaje na domyślnej zieleni).
        const override = !context.parameters.brandColor?.disable
        return (
          <PublicRoot sample={sample} override={override}>
            <Story />
          </PublicRoot>
        )
      }
      const theme: Theme = context.globals.theme ?? 'light'
      // Wewnętrzny `div` zostaje mimo tła z `body`: na stronie Docs podgląd
      // story leży na białym tle Storybooka, więc bez niego jasny tekst
      // ciemnego motywu lądowałby na bieli.
      return (
        <ThemeRoot theme={theme}>
          <div className="bg-background text-foreground">
            <Story />
          </div>
        </ThemeRoot>
      )
    },
  ],
}

export default preview
