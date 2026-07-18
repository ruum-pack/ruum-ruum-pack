const path = require('path');

module.exports = {
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-a11y',
    {
      name: '@storybook/addon-a11y',
      options: {
        // Configuración del addon de accesibilidad
        config: {
          rules: [
            { id: 'html-has-lang', enabled: true },
            { id: 'image-alt', enabled: true },
            { id: 'input-image-alt', enabled: true },
            { id: 'label', enabled: true },
            { id: 'link-in-text-block', enabled: true },
            { id: 'table-header-scope', enabled: true },
            { id: 'valid-lang', enabled: true },
          ],
        },
      },
    },
  ],
  framework: {
    name: '@storybook/nextjs',
    options: {
      nextConfigPath: path.resolve(__dirname, '../next.config.ts'),
    },
  },
  docs: {
    autodocs: true,
  },
  staticDirs: ['../public'],
};
