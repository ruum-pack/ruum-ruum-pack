import type { Meta, StoryObj } from "@storybook/react";
import { DatosSensiblesInfo, DatosSensiblesTooltip } from "./datos-sensibles";

const meta = {
  title: "Conductor/DatosSensibles",
  parameters: {
    layout: "padded",
    backgrounds: { default: "dark" },
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const InfoCompleta: Story = {
  render: () => (
    <div className="max-w-xl">
      <DatosSensiblesInfo tipo="curp" />
    </div>
  ),
};

export const InfoCompacta: Story = {
  render: () => (
    <div className="max-w-xl">
      <DatosSensiblesInfo tipo="contacto_emergencia" compacto />
    </div>
  ),
};

export const TooltipEnCampo: Story = {
  render: () => (
    <div className="max-w-xl rounded-2xl border border-border bg-surface p-5 text-text-primary">
      <label htmlFor="storybook-curp-protegida" className="flex items-center gap-2 font-body text-sm font-semibold text-text-primary">
        CURP
        <DatosSensiblesTooltip tipo="curp" />
      </label>
      <input
        id="storybook-curp-protegida"
        className="mt-2 w-full rounded-xl border border-border bg-surface-elevated px-3 py-3 text-base text-text-primary"
        placeholder="••••••••RRL09"
      />
    </div>
  ),
};
