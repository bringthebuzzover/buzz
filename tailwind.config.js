const jiti = require("jiti")(__filename);
const { tailwindThemeExtend } = jiti("./src/theme/palette.ts");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: tailwindThemeExtend.colors,
      boxShadow: tailwindThemeExtend.boxShadow,
      dropShadow: tailwindThemeExtend.dropShadow,
      keyframes: {
        slideInLeft: {
          "0%": { transform: "translateX(-80px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(80px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        logoScroll: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        marqueeReverse: {
          "0%": { transform: "translateX(-50%)" },
          "100%": { transform: "translateX(0%)" },
        },
      },
      animation: {
        "slide-in-left":
          "slideInLeft 1.6s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "slide-in-right":
          "slideInRight 1.6s cubic-bezier(0.22, 1, 0.36, 1) 0.15s forwards",
        "logo-scroll": "logoScroll 25s linear infinite",
        marquee: "marquee 40s linear infinite",
        "marquee-reverse": "marqueeReverse 50s linear infinite",
      },
    },
  },
  plugins: [],
};
