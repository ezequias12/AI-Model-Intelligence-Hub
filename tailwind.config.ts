import type { Config } from "tailwindcss";

/**
 * Design system.
 *
 * The scale, radii, elevation and motion tokens are declared once here so a
 * component cannot invent its own step. Radii are role-based on purpose:
 * an overlay, a control and a chip are different objects and must not share a
 * single radius value, which is the most common generated-UI tell.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: {
          DEFAULT: "hsl(var(--border))",
          strong: "hsl(var(--border-strong))",
        },
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        surface: {
          DEFAULT: "hsl(var(--surface))",
          raised: "hsl(var(--surface-raised))",
          sunken: "hsl(var(--surface-sunken))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          muted: "hsl(var(--primary-muted))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
          muted: "hsl(var(--destructive-muted))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          muted: "hsl(var(--success-muted))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          muted: "hsl(var(--warning-muted))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          muted: "hsl(var(--info-muted))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
          6: "hsl(var(--chart-6))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },

      borderRadius: {
        /* Roles, not decoration. */
        chip: "0.375rem",
        control: "0.5rem",
        panel: "0.75rem",
        overlay: "0.875rem",
      },

      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },

      /**
       * Type scale with obvious steps. 11px is reserved for dense table meta;
       * everything a person reads for comprehension starts at 12px.
       */
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0" }],
        xs: ["0.75rem", { lineHeight: "1.1rem" }],
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],
        base: ["0.875rem", { lineHeight: "1.375rem" }],
        md: ["1rem", { lineHeight: "1.55rem" }],
        lg: ["1.125rem", { lineHeight: "1.6rem", letterSpacing: "-0.012em" }],
        xl: ["1.375rem", { lineHeight: "1.7rem", letterSpacing: "-0.018em" }],
        "2xl": ["1.75rem", { lineHeight: "1.9rem", letterSpacing: "-0.022em" }],
        "3xl": ["2.25rem", { lineHeight: "2.3rem", letterSpacing: "-0.028em" }],
      },

      /**
       * Elevation. A hairline border is the structural device in both themes.
       * The light theme adds a barely-there card shadow that resolves to `none`
       * in dark, where the hairline alone separates surfaces. Overlays are the
       * only objects that float in either theme.
       */
      boxShadow: {
        card: "var(--shadow-card)",
        overlay:
          "0 1px 0 0 hsl(var(--border) / 0.6), 0 16px 40px -12px hsl(var(--shadow-color) / 0.34), 0 4px 12px -6px hsl(var(--shadow-color) / 0.2)",
        tooltip: "0 8px 20px -8px hsl(var(--shadow-color) / 0.38)",
      },

      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },

      transitionTimingFunction: {
        /* Exponential ease-out. No bounce, no elastic. */
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-soft": "cubic-bezier(0.22, 1, 0.36, 1)",
      },

      keyframes: {
        "overlay-in": {
          from: { opacity: "0", transform: "translateY(-4px) scale(0.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "sheet-in": {
          from: { transform: "translateX(12px)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        /* The one authored moment: the dashboard leader row arrives in sequence. */
        "leader-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },

      animation: {
        "overlay-in": "overlay-in 180ms cubic-bezier(0.16, 1, 0.3, 1)",
        "sheet-in": "sheet-in 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        "leader-in": "leader-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both",
        "fade-in": "fade-in 140ms cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
