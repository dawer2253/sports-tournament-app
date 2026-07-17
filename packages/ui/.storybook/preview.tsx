import type { Preview } from '@storybook/react-vite'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'todo' },
    options: {
      storySort: { order: ['Wprowadzenie', 'Fundamenty', 'UI', 'Ekrany'] },
    },
  },
  globalTypes: {
    theme: {
      description: 'Motyw',
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
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme ?? 'light'
      return (
        <div className={theme === 'dark' ? 'dark' : ''}>
          <div className="bg-background text-foreground">
            <Story />
          </div>
        </div>
      )
    },
  ],
}

export default preview
