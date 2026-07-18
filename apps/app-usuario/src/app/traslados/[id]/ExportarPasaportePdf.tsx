"use client";

import { Button } from "@ruum/ui";

export function ExportarPasaportePdf() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      Exportar PDF
    </Button>
  );
}
