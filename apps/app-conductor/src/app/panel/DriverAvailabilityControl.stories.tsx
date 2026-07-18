import type { Meta, StoryObj } from "@storybook/react";
import { DriverAvailabilityControl } from "./DriverAvailabilityControl";

const meta = {
  title: "Conductor/DriverAvailabilityControl",
  component: DriverAvailabilityControl,
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: true }],
      },
    },
  },
  args: {
    saving: false,
    onChange: () => undefined,
  },
} satisfies Meta<typeof DriverAvailabilityControl>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Disponible: Story = {
  args: {
    value: "disponible",
  },
};

export const NoDisponible: Story = {
  args: {
    value: "no_disponible",
  },
};

export const Guardando: Story = {
  args: {
    value: "no_disponible",
    saving: true,
  },
};

export const EnViaje: Story = {
  args: {
    value: "en_viaje",
  },
};
