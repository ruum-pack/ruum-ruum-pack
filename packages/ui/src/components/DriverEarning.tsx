import { FinancialAmount, type FinancialAmountProps } from "./FinancialAmount";

export type DriverEarningProps = FinancialAmountProps;

export function DriverEarning(props: DriverEarningProps) {
  return <FinancialAmount pendingText="Ganancia por confirmar" {...props} />;
}
