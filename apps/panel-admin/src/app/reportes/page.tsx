import type { Metadata } from "next";
import ReportesCliente from "./ReportesCliente";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PaginaReportesAdmin() {
  return <ReportesCliente />;
}
