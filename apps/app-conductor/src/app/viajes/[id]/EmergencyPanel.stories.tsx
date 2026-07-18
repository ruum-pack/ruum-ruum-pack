import type { Meta, StoryObj } from "@storybook/react";
import { EmergencyPanel } from "./EmergencyPanel";

const meta = {
  title: "Conductor/EmergencyPanel",
  component: EmergencyPanel,
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
    trasladoId: "00000000-0000-4000-8000-00000000e205",
  },
} satisfies Meta<typeof EmergencyPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Cerrado: Story = {};
