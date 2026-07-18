import type { Meta, StoryObj } from "@storybook/react";
import { NextOperationalAction } from "./NextOperationalAction";

function ThemeFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div data-theme="light" className="rounded-2xl bg-[var(--ruum-canvas)] p-5 text-text-primary">
        <p className="mb-3 font-body text-sm font-semibold text-text-secondary">Light</p>
        {children}
      </div>
      <div data-theme="dark" className="rounded-2xl bg-[var(--ruum-canvas)] p-5 text-text-primary">
        <p className="mb-3 font-body text-sm font-semibold text-text-secondary">Dark</p>
        {children}
      </div>
    </div>
  );
}

const meta = {
  title: "UI/NextOperationalAction",
  component: NextOperationalAction,
  parameters: {
    layout: "padded",
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: true }],
      },
    },
  },
} satisfies Meta<typeof NextOperationalAction>;

export default meta;

type Story = StoryObj<typeof meta>;

const baseArgs = {
  title: "Dirígete al punto de entrega",
  instruction: "Abre navegación y confirma llegada cuando estés frente al contacto de recepción.",
  context: "Destino: Santa Fe, Vasco de Quiroga 3800",
  eta: "Aproximadamente a 8 km de ti",
  primaryCta: { label: "Abrir navegación", href: "https://maps.google.com", external: true },
  secondaryCta: { label: "Confirmar llegada" },
  nextStep: "Registra el estado final del vehículo.",
  stageLabel: "Paso 5 de 7",
};

export const Normal: Story = {
  args: baseArgs,
  render: () => (
    <ThemeFrame>
      <NextOperationalAction {...baseArgs} />
    </ThemeFrame>
  ),
};

export const Loading: Story = {
  args: baseArgs,
  render: () => (
    <ThemeFrame>
      <NextOperationalAction {...baseArgs} loading primaryCta={{ label: "Confirmando llegada" }} />
    </ThemeFrame>
  ),
};

export const Error: Story = {
  args: baseArgs,
  render: () => (
    <ThemeFrame>
      <NextOperationalAction
        {...baseArgs}
        error="No pudimos confirmar la llegada. Revisa tu conexión e intenta nuevamente."
      />
    </ThemeFrame>
  ),
};

export const AccionBloqueada: Story = {
  args: baseArgs,
  render: () => (
    <ThemeFrame>
      <NextOperationalAction
        {...baseArgs}
        title="Espera indicaciones de Torre de Control"
        instruction="La incidencia actual impide continuar el traslado hasta recibir autorización."
        primaryCta={{ label: "Acción bloqueada", disabled: true }}
        secondaryCta={{ label: "Contactar soporte" }}
        nextStep="Torre de Control definirá el siguiente movimiento."
      />
    </ThemeFrame>
  ),
};

export const Incidencia: Story = {
  args: baseArgs,
  render: () => (
    <ThemeFrame>
      <NextOperationalAction
        {...baseArgs}
        title="Incidencia reportada"
        instruction="Mantente en el punto actual mientras operación revisa la situación."
        context="Reporte: no localizo el vehículo."
        primaryCta={{ label: "Ver indicaciones" }}
        secondaryCta={{ label: "Contactar soporte", variant: "secondary" }}
      />
    </ThemeFrame>
  ),
};

export const FueraDeGeocerca: Story = {
  args: baseArgs,
  render: () => (
    <ThemeFrame>
      <NextOperationalAction
        {...baseArgs}
        error="Estás a más de 500 m del punto de entrega. Confirma solo si el GPS no refleja tu ubicación real."
        primaryCta={{ label: "Confirmar de todos modos", variant: "danger" }}
        secondaryCta={{ label: "Abrir navegación" }}
      />
    </ThemeFrame>
  ),
};
