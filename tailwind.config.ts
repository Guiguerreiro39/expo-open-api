import nativewindPreset from "nativewind/preset";
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [nativewindPreset],
  theme: {
    extend: {
      colors: {
        // Surface & Canvas Hierarchy
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        surface: "hsl(var(--surface) / <alpha-value>)",
        "surface-dim": "hsl(var(--surface-dim) / <alpha-value>)",
        "surface-bright": "hsl(var(--surface-bright) / <alpha-value>)",
        "surface-container-lowest": "hsl(var(--surface-container-lowest) / <alpha-value>)",
        "surface-container-low": "hsl(var(--surface-container-low) / <alpha-value>)",
        "surface-container": "hsl(var(--surface-container) / <alpha-value>)",
        "surface-container-high": "hsl(var(--surface-container-high) / <alpha-value>)",
        "surface-container-highest": "hsl(var(--surface-container-highest) / <alpha-value>)",
        "on-surface": "hsl(var(--on-surface) / <alpha-value>)",
        "on-surface-variant": "hsl(var(--on-surface-variant) / <alpha-value>)",
        "inverse-surface": "hsl(var(--inverse-surface) / <alpha-value>)",
        "inverse-on-surface": "hsl(var(--inverse-on-surface) / <alpha-value>)",

        // Card, Popover, Muted & Accent Aliases
        card: "hsl(var(--card) / <alpha-value>)",
        "card-foreground": "hsl(var(--card-foreground) / <alpha-value>)",
        popover: "hsl(var(--popover) / <alpha-value>)",
        "popover-foreground": "hsl(var(--popover-foreground) / <alpha-value>)",
        muted: "hsl(var(--muted) / <alpha-value>)",
        "muted-foreground": "hsl(var(--muted-foreground) / <alpha-value>)",
        accent: "hsl(var(--accent) / <alpha-value>)",
        "accent-foreground": "hsl(var(--accent-foreground) / <alpha-value>)",

        // Borders, Outlines, Inputs & Focus Ring
        outline: "hsl(var(--outline) / <alpha-value>)",
        "outline-variant": "hsl(var(--outline-variant) / <alpha-value>)",
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",

        // Primary
        primary: "hsl(var(--primary) / <alpha-value>)",
        "primary-foreground": "hsl(var(--primary-foreground) / <alpha-value>)",
        "primary-container": "hsl(var(--primary-container) / <alpha-value>)",
        "on-primary-container": "hsl(var(--on-primary-container) / <alpha-value>)",
        "primary-fixed": "hsl(var(--primary-fixed) / <alpha-value>)",
        "primary-fixed-dim": "hsl(var(--primary-fixed-dim) / <alpha-value>)",

        // Secondary
        secondary: "hsl(var(--secondary) / <alpha-value>)",
        "secondary-foreground": "hsl(var(--secondary-foreground) / <alpha-value>)",
        "secondary-container": "hsl(var(--secondary-container) / <alpha-value>)",
        "on-secondary-container": "hsl(var(--on-secondary-container) / <alpha-value>)",

        // Tertiary
        tertiary: "hsl(var(--tertiary) / <alpha-value>)",
        "tertiary-foreground": "hsl(var(--tertiary-foreground) / <alpha-value>)",
        "tertiary-container": "hsl(var(--tertiary-container) / <alpha-value>)",
        "on-tertiary-container": "hsl(var(--on-tertiary-container) / <alpha-value>)",
        "tertiary-fixed": "hsl(var(--tertiary-fixed) / <alpha-value>)",

        // Semantic Status Pairs
        destructive: "hsl(var(--destructive) / <alpha-value>)",
        "destructive-foreground": "hsl(var(--destructive-foreground) / <alpha-value>)",
        "destructive-container": "hsl(var(--destructive-container) / <alpha-value>)",
        "on-destructive-container": "hsl(var(--on-destructive-container) / <alpha-value>)",

        success: "hsl(var(--success) / <alpha-value>)",
        "success-foreground": "hsl(var(--success-foreground) / <alpha-value>)",
        "success-container": "hsl(var(--success-container) / <alpha-value>)",
        "on-success-container": "hsl(var(--on-success-container) / <alpha-value>)",

        warning: "hsl(var(--warning) / <alpha-value>)",
        "warning-foreground": "hsl(var(--warning-foreground) / <alpha-value>)",
        "warning-container": "hsl(var(--warning-container) / <alpha-value>)",
        "on-warning-container": "hsl(var(--on-warning-container) / <alpha-value>)",

        info: "hsl(var(--info) / <alpha-value>)",
        "info-foreground": "hsl(var(--info-foreground) / <alpha-value>)",
        "info-container": "hsl(var(--info-container) / <alpha-value>)",
        "on-info-container": "hsl(var(--on-info-container) / <alpha-value>)",

        // Mode-invariant Overlay Scrim
        scrim: "hsl(var(--scrim) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["Quicksand-Regular", "Quicksand", "System"],
        "sans-medium": ["Quicksand-Medium", "Quicksand", "System"],
        "sans-semibold": ["Quicksand-SemiBold", "Quicksand", "System"],
        "sans-bold": ["Quicksand-Bold", "Quicksand", "System"],
        display: ["Quicksand-Bold", "Quicksand", "System"],
        mono: ["JetBrainsMono-Regular", "JetBrains Mono", "monospace"],
        "mono-bold": ["JetBrainsMono-Bold", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.96px", fontWeight: "700" }],
        "headline-xl": ["40px", { lineHeight: "48px", letterSpacing: "-0.8px", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "700" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "headline-sm": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "title-md": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "500" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-lg": ["14px", { lineHeight: "16px", letterSpacing: "0.7px", fontWeight: "700" }],
        "label-md": ["12px", { lineHeight: "16px", fontWeight: "600" }],
        "label-sm": ["12px", { lineHeight: "16px", letterSpacing: "0.6px", fontWeight: "700" }],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
        "3xl": "24px",
        "4xl": "32px",
        full: "9999px",
      },
      boxShadow: {
        tactile: "4px 4px 0px 0px rgba(29, 27, 25, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
