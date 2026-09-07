/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  verifyOtp: vi.fn(),
  resend: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams("email=ana%40ejemplo.com")
}));

vi.mock("../../../lib/supabase-browser", () => ({
  crearClienteNavegador: vi.fn(() => ({
    auth: { verifyOtp: mocks.verifyOtp, resend: mocks.resend }
  }))
}));

import PaginaConfirmaCorreo from "./page";

describe("pantalla de confirmación de correo", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.refresh.mockReset();
    mocks.verifyOtp.mockReset();
    mocks.resend.mockReset();
    mocks.verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
    mocks.resend.mockResolvedValue({ error: null });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("muestra el código y verifica la cuenta con el correo registrado", async () => {
    const user = userEvent.setup();
    render(<PaginaConfirmaCorreo />);

    expect(screen.getByRole("heading", { name: /confirma tu correo electrónico/i })).toBeInTheDocument();
    expect(screen.getByText("Código de verificación", { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/ana@ejemplo.com/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/código de verificación/i), "406156");
    await user.click(screen.getByRole("button", { name: /verificar mi cuenta/i }));

    await waitFor(() => expect(mocks.verifyOtp).toHaveBeenCalledWith({
      email: "ana@ejemplo.com",
      token: "406156",
      type: "email"
    }));
    expect(mocks.push).toHaveBeenCalledWith("/");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("muestra un error traducido cuando el código expiró", async () => {
    const user = userEvent.setup();
    mocks.verifyOtp.mockResolvedValue({ data: { session: null }, error: { code: "otp_expired" } });
    render(<PaginaConfirmaCorreo />);

    await user.type(screen.getByLabelText(/código de verificación/i), "406156");
    await user.click(screen.getByRole("button", { name: /verificar mi cuenta/i }));

    expect(await screen.findByText("El enlace o código expiró. Solicita uno nuevo.", { exact: true })).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
