import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@ruum/ui';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    a11y: {
      // Configuración específica de accesibilidad para este componente
      config: {
        rules: [
          { id: 'button-name', enabled: true },
          { id: 'color-contrast', enabled: true },
          { id: 'click-events-have-key-events', enabled: true },
        ],
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'quiet', 'danger', 'emergency'],
    },
    onClick: { action: 'clicked' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    children: 'Primary Button',
    variant: 'primary',
    disabled: false,
  },
  parameters: {
    a11y: {
      // Verificar específicamente el nombre del botón
      manual: true,
    },
  },
};

export const Secondary: Story = {
  args: {
    children: 'Secondary Button',
    variant: 'secondary',
  },
};

export const Quiet: Story = {
  args: {
    children: 'Quiet Button',
    variant: 'quiet',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled Button',
    disabled: true,
  },
  parameters: {
    a11y: {
      // Botón deshabilitado debe tener aria-disabled
      config: {
        rules: [
          { id: 'button-name', enabled: true },
          { id: 'aria-allowed-attr', enabled: true },
        ],
      },
    },
  },
};
