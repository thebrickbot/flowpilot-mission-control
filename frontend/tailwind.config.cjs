/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      screens: {
        // Standard breakpoints
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
        // Ultrawide breakpoints (49" / 5120×1440 territory)
        "3xl": "2048px",
        "4xl": "3440px",
        uw: "3840px",
      },
      fontFamily: {
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        display: ["var(--font-display)", "serif"],
      },
      colors: {
        // FlowPilot brand palette
        fp: {
          mountain: "#233136", // primary dark
          lime: "#CDF765",     // accent / CTA
          forest: "#2B4A44",   // secondary
          mint: "#C7DCCD",     // light accent
        },
      },
      maxWidth: {
        "8xl": "88rem",   // 1408px
        "9xl": "104rem",  // 1664px
        uw: "160rem",     // 2560px — ultrawide container cap
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
