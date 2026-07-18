import type { Meta, StoryObj } from "@storybook/react";
import { AlertCard, FinancialCard, OperationalCard } from "./Card";
import { DriverEarning } from "./DriverEarning";
import { FinancialAmount } from "./FinancialAmount";

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

function FinancialCardContent({
  title,
  amount,
  status,
  auxiliaryText
}: {
  title: string;
  amount?: number | null;
  status: React.ComponentProps<typeof FinancialAmount>["status"];
  auxiliaryText?: string;
}) {
  return (
    <FinancialCard>
      <p className="font-body text-sm font-semibold text-text-secondary">{title}</p>
      <FinancialAmount
        amount={amount}
        status={status}
        amountClassName="mt-2 text-2xl"
        auxiliaryText={auxiliaryText}
      />
    </FinancialCard>
  );
}

const meta = {
  title: "UI/Cards",
  parameters: {
    layout: "padded",
    a11y: {
      config: {
        rules: [{ id: "color-contrast", enabled: true }],
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const FinancialCardEstados: Story = {
  render: () => (
    <ThemeFrame>
      <div className="grid gap-3">
        <FinancialCardContent title="Ganancias" amount={null} status="sin_calcular" />
        <FinancialCardContent title="Ganancia estimada" amount={980} status="estimado" />
        <FinancialCardContent title="Ganancia confirmada" amount={1240} status="confirmado" />
        <FinancialCardContent title="Retención" amount={220} status="retenido" auxiliaryText="Retenida por validación operativa." />
        <FinancialCard padding="lg" className="border-border-strong">
          <p className="font-body text-sm font-semibold text-text-secondary">Depósito final</p>
          <FinancialAmount amount={1020} status="programado" amountClassName="mt-3 text-3xl" />
        </FinancialCard>
      </div>
    </ThemeFrame>
  ),
};

export const OperationalCardBasica: Story = {
  render: () => (
    <ThemeFrame>
      <OperationalCard>
        <p className="font-body text-sm font-semibold text-route-action">Acción pendiente</p>
        <h2 className="mt-1 font-display text-xl font-semibold text-text-primary">Dirígete al punto de recolección</h2>
        <p className="mt-2 font-body text-base leading-7 text-text-secondary">
          Confirma llegada solo cuando estés cerca del contacto.
        </p>
      </OperationalCard>
    </ThemeFrame>
  ),
};

export const AlertCardOperativa: Story = {
  render: () => (
    <ThemeFrame>
      <AlertCard>
        <p className="font-body text-sm font-semibold text-warning">Próximo requisito pendiente</p>
        <p className="mt-2 font-body text-sm leading-6 text-text-primary">
          Actualiza tu licencia para mantener acceso a oportunidades.
        </p>
      </AlertCard>
    </ThemeFrame>
  ),
};

export const DriverEarningEstados: Story = {
  render: () => (
    <ThemeFrame>
      <FinancialCard>
        <div className="grid gap-4">
          <DriverEarning amount={null} status="sin_calcular" amountClassName="text-2xl" />
          <DriverEarning amount={760} status="estimado" amountClassName="text-2xl" />
          <DriverEarning amount={980} status="confirmado" amountClassName="text-2xl" />
          <DriverEarning amount={180} status="retenido" amountClassName="text-2xl" />
        </div>
      </FinancialCard>
    </ThemeFrame>
  ),
};
