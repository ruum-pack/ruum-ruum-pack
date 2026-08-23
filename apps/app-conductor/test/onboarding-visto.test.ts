import { beforeEach, describe, expect, it, vi } from "vitest";

const preferencesStore = vi.hoisted(() => new Map<string, string>());

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: preferencesStore.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      preferencesStore.set(key, value);
    })
  }
}));

import { marcarOnboardingVisto, onboardingVisto } from "../src/lib/onboarding-visto";

describe("Onboarding Visto", () => {
  beforeEach(() => {
    preferencesStore.clear();
  });

  it("retorna false por defecto cuando no se ha visto el onboarding", async () => {
    const visto = await onboardingVisto();
    expect(visto).toBe(false);
  });

  it("retorna true tras marcar onboarding como visto", async () => {
    await marcarOnboardingVisto();
    const visto = await onboardingVisto();
    expect(visto).toBe(true);
  });
});
