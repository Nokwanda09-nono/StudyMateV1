import { colors } from "./colors";

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
};

export const Colors = {
  light: {
    background: "#ffffff",
    text: "#111827",
    textSecondary: "#6b7280",
    tint: "#6366f1",
    tabIconDefault: "#9ca3af",
    tabIconSelected: "#6366f1",
    backgroundElement: "#f3f4f6",
    backgroundSelected: "#e0e7ff",
  },
  dark: {
    background: "#111827",
    text: "#ffffff",
    textSecondary: "#9ca3af",
    tint: "#8b5cf6",
    tabIconDefault: "#4b5563",
    tabIconSelected: "#8b5cf6",
    backgroundElement: "#1f2937",
    backgroundSelected: "#312e81",
  },
};

export const Fonts = {
  regular: "System",
  bold: "System",
  mono: "System", // Use System for now
};

export type ThemeColor = keyof typeof Colors.light;

export const BottomTabInset = 80;
export const MaxContentWidth = 600;

export const theme = {
  colors,
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  typography: {
    h1: {
      fontSize: 32,
      fontWeight: "bold" as const,
    },
    h2: {
      fontSize: 24,
      fontWeight: "bold" as const,
    },
    h3: {
      fontSize: 20,
      fontWeight: "600" as const,
    },
    body: {
      fontSize: 16,
      fontWeight: "400" as const,
    },
    caption: {
      fontSize: 14,
      fontWeight: "400" as const,
    },
    small: {
      fontSize: 12,
      fontWeight: "400" as const,
    },
  },
  shadows: {
    sm: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
  },
};
