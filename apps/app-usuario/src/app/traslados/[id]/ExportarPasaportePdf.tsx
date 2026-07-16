"use client";

import { Button } from "@ruum/ui";

export function ExportarPasaportePdf() {
  return (
    <Button variant="secundario" onClick={() => window.print()}>
      Exportar PDF
    </Button>
  );
}
