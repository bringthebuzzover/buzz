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
      fontFamily: {
        // Switzer 400 / 500 (Fontshare). 600 and 700 are pinned to the 500
        // file in index.css so existing font-semibold / font-bold don't
        // faux-bold past the pen's weight cap.
        sans: [
          "Switzer",
          "ui-sans-serif",
          "system-ui",
          "Segoe UI",
          "sans-serif",
        ],
      },
      fontSize: {
        buzzMicro: ["0.75rem", { lineHeight: "1rem" }],
        // Pen type scale. Desktop sizes; mobile steps live on TEXT.*.
        buzzDisplay: ["115px", { lineHeight: "0.9", letterSpacing: "-0.045em" }],
        buzzTitle: ["64px", { lineHeight: "0.95", letterSpacing: "-0.04em" }],
        buzzStatement: ["54px", { lineHeight: "1.0", letterSpacing: "-0.03em" }],
        buzzH2: ["44px", { lineHeight: "1.05", letterSpacing: "-0.04em" }],
        buzzH3: ["20px", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        buzzBody: ["16px", { lineHeight: "1.5" }],
        buzzSmall: ["14px", { lineHeight: "1.45" }],
        // Tracking lives on kickers, not on this size — labels in fields are sentence case.
        buzzLabel: ["12px", { lineHeight: "1.35" }],
      },
      borderRadius: {
        // Pen: check 5, control 8, field 10, card/media 8, board/modal 16, phone 32.
        buzzCheck: "5px",
        buzzControl: "8px",
        buzzField: "10px",
        buzzMedia: "8px",
        buzzCard: "8px",
        buzzBoard: "16px",
        buzzModal: "16px",
        buzzPhone: "32px",
      },
      zIndex: {
        buzzDrawer: "55",
        buzzBanner: "100",
        buzzModal: "120",
      },
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
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "15%": { transform: "translateX(-8px)" },
          "30%": { transform: "translateX(8px)" },
          "45%": { transform: "translateX(-6px)" },
          "60%": { transform: "translateX(6px)" },
          "75%": { transform: "translateX(-3px)" },
          "90%": { transform: "translateX(3px)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        // Pulse motion. Modal keyframes include the centering translate so
        // fill-mode doesn't knock the dialog off center. See theme/motion.ts.
        buzzRise: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        buzzFade: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        buzzFloat: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        buzzModal: {
          "0%": {
            opacity: "0",
            transform: "translate(-50%, calc(-50% + 12px))",
          },
          "100%": { opacity: "1", transform: "translate(-50%, -50%)" },
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
        shake: "shake 0.45s ease-in-out",
        "fade-in": "fadeIn 0.38s ease-out forwards",
        "buzz-rise": "buzzRise 600ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "buzz-fade": "buzzFade 220ms ease-out both",
        "buzz-float": "buzzFloat 3.2s ease-in-out infinite",
        "buzz-modal": "buzzModal 220ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};
