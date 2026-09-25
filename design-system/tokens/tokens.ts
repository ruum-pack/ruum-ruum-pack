/**
 * Ruum Ruum — Design Tokens v1.0 para React Native / TypeScript
 * Fuente: design-system/tokens/tokens.json
 * Uso: import { tokens } from "./tokens"; StyleSheet.create({ btn: { height: tokens.size.buttonHeight } })
 */

export const tokens = {
  color: {
    navy: "#0A2342",
    teal: "#00D1D1",
    tealDeep: "#008B8B",
    blue: "#0066FF",
    action: "#0066FF",
    surface: "#E8EEF4",
    white: "#FFFFFF",
    muted: "#566889",
    borderInput: "#7A8DAE",
    border: "#E6F0FF",
    warning: "#F5B400",
    success: "#16805A",
    error: "#C23648",
    emergency: "#B3261E",
    neutralBg: "#EEF2F8",
    actionBg: "#E8F0FE",
    actionText: "#1461E0",
    warningBg: "#FFF4D6",
    warningText: "#7A4F00",
    successBg: "#E6F6EE",
    successText: "#0F6B48",
    errorBg: "#FDECEF",
    errorText: "#C23648",
  },
  gradient: {
    cta: ["#008B8B", "#0066FF"] as const,
    route: ["#00D1D1", "#0066FF"] as const,
  },
  font: {
    family: "Inter",
    fallback: ["Arial", "Calibri", "sans-serif"] as const,
    size: {
      display: 40,
      h1: 32,
      h2: 24,
      h3: 18,
      body: 16,
      small: 14,
      caption: 12,
      streetBody: 17,
    },
    weight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
    } as const,
  },
  space: { s4: 4, s8: 8, s12: 12, s16: 16, s20: 20, s24: 24, s32: 32, s40: 40, s48: 48 },
  radius: { sm: 8, md: 12, lg: 16, xl: 24, full: 999 },
  elevation: {
    e1: { shadowColor: "#0D2B5E", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
    e2: { shadowColor: "#0D2B5E", shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 8 } },
  },
  size: { touch: 44, touchStreet: 56, buttonHeight: 52, buttonHeightStreet: 56, inputHeight: 48 },
  motion: { micro: 150, transition: 250, easing: "ease-out" as const },
} as const;

export type Tokens = typeof tokens;
