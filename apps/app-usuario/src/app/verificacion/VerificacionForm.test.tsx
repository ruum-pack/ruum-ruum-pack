// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VerificacionForm } from "./VerificacionForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

describe("VerificacionForm", () => {
  it("en revisión muestra sólo la acción Didit y no duplica el formulario manual", () => {
    render(<VerificacionForm fotoPerfilInicial="https://cdn.example/foto.jpg" soloDidit />);

    expect(screen.getByRole("button", { name: /iniciar verificación con didit/i })).toBeInTheDocument();
    expect(screen.queryByText(/prefiero subir mis documentos manualmente/i)).not.toBeInTheDocument();
  });
});
