import type { Config } from "tailwindcss";

/**
 * Tailwind CSS Configuration
 * 
 * Extended to use OVES Design System tokens.
 * See /src/styles/tokens.ts for the full token reference.
 */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ==================== COLORS ====================
      colors: {
        // CSS variable references
        background: "var(--bg-primary)",
        foreground: "var(--text-primary)",
        
        // Brand colors
        brand: {
          DEFAULT: "var(--color-brand)",
          light: "var(--color-brand-light)",
          dark: "var(--color-brand-dark)",
        },
        
        // Background colors
        bg: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary: "var(--bg-tertiary)",
          elevated: "var(--bg-elevated)",
          surface: "var(--bg-surface)",
        },
        
        // Text colors
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          inverse: "var(--text-inverse)",
        },
        
        // Border colors
        border: {
          DEFAULT: "var(--border-default)",
          subtle: "var(--border-subtle)",
          focus: "var(--border-focus)",
        },
        
        // Semantic colors
        success: {
          DEFAULT: "var(--color-success)",
          light: "var(--color-success-light)",
          soft: "var(--color-success-soft)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          light: "var(--color-warning-light)",
          soft: "var(--color-warning-soft)",
        },
        error: {
          DEFAULT: "var(--color-error)",
          light: "var(--color-error-light)",
          soft: "var(--color-error-soft)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          light: "var(--color-info-light)",
          soft: "var(--color-info-soft)",
        },
      },
      
      // ==================== TYPOGRAPHY ====================
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      
      fontSize: {
        "2xs": ["var(--font-2xs)", { lineHeight: "1.4" }],
        "xs": ["var(--font-xs)", { lineHeight: "1.5" }],
        "sm": ["var(--font-sm)", { lineHeight: "1.5" }],
        "base": ["var(--font-base)", { lineHeight: "1.5" }],
        "md": ["var(--font-md)", { lineHeight: "1.5" }],
        "lg": ["var(--font-lg)", { lineHeight: "1.4" }],
        "xl": ["var(--font-xl)", { lineHeight: "1.35" }],
        "2xl": ["var(--font-2xl)", { lineHeight: "1.3" }],
        "3xl": ["var(--font-3xl)", { lineHeight: "1.25" }],
        "4xl": ["var(--font-4xl)", { lineHeight: "1.2" }],
        "5xl": ["var(--font-5xl)", { lineHeight: "1.15" }],
      },
      
      fontWeight: {
        light: "var(--weight-light)",
        normal: "var(--weight-regular)",
        medium: "var(--weight-medium)",
        semibold: "var(--weight-semibold)",
        bold: "var(--weight-bold)",
      },
      
      lineHeight: {
        none: "var(--leading-none)",
        tight: "var(--leading-tight)",
        snug: "var(--leading-snug)",
        normal: "var(--leading-normal)",
        relaxed: "var(--leading-relaxed)",
      },
      
      // ==================== SPACING ====================
      spacing: {
        "0": "var(--space-0)",
        "0.5": "var(--space-0-5)",
        "1": "var(--space-1)",
        "1.5": "var(--space-1-5)",
        "2": "var(--space-2)",
        "2.5": "var(--space-2-5)",
        "3": "var(--space-3)",
        "3.5": "var(--space-3-5)",
        "4": "var(--space-4)",
        "5": "var(--space-5)",
        "6": "var(--space-6)",
        "7": "var(--space-7)",
        "8": "var(--space-8)",
        "9": "var(--space-9)",
        "10": "var(--space-10)",
        "12": "var(--space-12)",
        "16": "var(--space-16)",
        "20": "var(--space-20)",
      },
      
      // ==================== BORDER RADIUS ====================
      borderRadius: {
        none: "var(--radius-none)",
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
        full: "var(--radius-full)",
      },
      
      // ==================== SHADOWS ====================
      boxShadow: {
        none: "var(--shadow-none)",
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        card: "var(--shadow-card)",
        glow: "var(--shadow-glow)",
        "glow-success": "var(--shadow-glow-success)",
        "glow-error": "var(--shadow-glow-error)",
      },
      
      // ==================== TRANSITIONS ====================
      transitionDuration: {
        instant: "var(--duration-instant)",
        fast: "var(--duration-fast)",
        DEFAULT: "var(--duration-normal)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
        slower: "var(--duration-slower)",
      },
      
      transitionTimingFunction: {
        DEFAULT: "var(--ease-out)",
        linear: "var(--ease-linear)",
        in: "var(--ease-in)",
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
        spring: "var(--ease-spring)",
      },
      
      // ==================== Z-INDEX ====================
      zIndex: {
        base: "var(--z-base)",
        dropdown: "var(--z-dropdown)",
        sticky: "var(--z-sticky)",
        overlay: "var(--z-overlay)",
        modal: "var(--z-modal)",
        popover: "var(--z-popover)",
        toast: "var(--z-toast)",
        tooltip: "var(--z-tooltip)",
        max: "var(--z-max)",
      },
      
      // ==================== ANIMATIONS ====================
      animation: {
        "fade-in": "fade-in var(--duration-normal) var(--ease-out)",
        "fade-in-up": "fade-in-up var(--duration-normal) var(--ease-out)",
        "scale-in": "scale-in var(--duration-normal) var(--ease-spring)",
        "spin": "spin 1s linear infinite",
        "pulse": "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
