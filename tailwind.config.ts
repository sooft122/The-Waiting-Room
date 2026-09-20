import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0c0d10",
        card: {
          from: "#16171c",
          to: "#101114",
        },
        border: {
          DEFAULT: "rgba(41, 41, 41, 0.42)",
          highlight: "rgba(64, 64, 64, 0.5)",
        },
        muted: "rgba(255, 255, 255, 0.6)",
        subtle: "#b8b8b8",
      },
      fontFamily: {
        satoshi: ["Satoshi", "var(--font-inter)", "sans-serif"],
        inter: ["var(--font-inter)", "sans-serif"],
        figtree: ["var(--font-figtree)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
