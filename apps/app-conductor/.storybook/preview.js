import '../src/app/globals.css';

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
  a11y: {
    // Configuración del addon de accesibilidad
    config: {
      rules: [
        { id: 'color-contrast', enabled: true },
        { id: 'image-alt', enabled: true },
        { id: 'label', enabled: true },
        { id: 'link-in-text-block', enabled: true },
        { id: 'table-header-scope', enabled: true },
      ],
    },
    // Opciones de visualización
    options: {
      runOnlyInFamily: false,
      showViolationsInSummary: true,
    },
  },
  nextjs: {
    appDirectory: true,
  },
};
