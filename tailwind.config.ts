import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // "ink" = parchment/text scale (lights)
        ink: {
          950: "#f1eadb",
          900: "#e8dfcb",
          800: "#d6cdb9",
          700: "#b5ab97",
          600: "#9a9079",
          500: "#7c7462",
          400: "#605a4c",
          300: "#48443a",
        },
        // "paper" = cypress surface scale (darks)
        paper: {
          50: "#5a6d63",
          100: "#42524a",
          200: "#34413b",
          300: "#2b352f",
          400: "#212923",
        },
        // accent — terracotta
        clay: {
          300: "#e09c72",
          400: "#cd8150",
          500: "#b8693d",
          600: "#95512c",
          700: "#6b3b1f",
        },
        // profit — lifted sage
        sage: {
          400: "#b0d7ba",
          500: "#8ec09a",
          600: "#6ea478",
        },
        // loss — dusty rose (reads as negative without fighting terracotta)
        rust: {
          400: "#dc9388",
          500: "#c9786a",
          600: "#a05848",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-serif", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
