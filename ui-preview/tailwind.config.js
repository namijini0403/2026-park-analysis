/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep navy - shared with the guide modal and cover screen.
        navy: {
          950: "#07111F",
          900: "#081421",
          850: "#0E1B2A",
          800: "#122437",
          750: "#183047",
          700: "#203B54",
          600: "#2B4D68",
          500: "#3B6381",
          400: "#5E829C",
          300: "#9FB7C8",
        },
        // Deep forest / emerald - restrained policy-dashboard accent.
        forest: {
          950: "#02140C",
          900: "#042016",
          850: "#063323",
          800: "#064E3B",
          700: "#047857",
          600: "#059669",
          500: "#10B981",
          400: "#34D399",
          300: "#6EE7B7",
          200: "#A7F3D0",
        },
        // Warm sand / parchment — for surfaces over dark navy
        sand: {
          50: "#FAF8F2",
          100: "#F2EEE3",
          200: "#E5DECB",
          300: "#D2C8AE",
        },
        // Subtle status colors that work on dark
        signal: {
          warn: "#E0A93B",
          warnSoft: "#FBE6A9",
          alert: "#D26A52",
          alertSoft: "#F4C7BC",
          info: "#5DA8D4",
          infoSoft: "#BFDFEE",
        },
      },
      fontFamily: {
        display: [
          '"Pretendard Variable"',
          "Pretendard",
          '"Noto Sans KR"',
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 18px 42px -28px rgba(0, 0, 0, 0.62)",
        card: "inset 0 1px 0 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.03), 0 30px 70px -42px rgba(0,0,0,0.92)",
        cardLift: "inset 0 1px 0 0 rgba(255,255,255,0.11), inset 0 0 0 1px rgba(16,185,129,0.10), 0 34px 78px -42px rgba(0,0,0,0.95), 0 14px 32px -24px rgba(16,185,129,0.20)",
        glow: "0 0 0 1px rgba(16, 185, 129, 0.26), 0 18px 46px -30px rgba(16, 185, 129, 0.55)",
      },
      backgroundImage: {
        "navy-grad":
          "linear-gradient(180deg, #07111F 0%, #081421 48%, #0E1B2A 100%)",
        "card-grad":
          "linear-gradient(165deg, rgba(6,48,35,0.88) 0%, rgba(4,32,22,0.95) 54%, rgba(7,17,31,0.98) 100%)",
        "card-grad-hover":
          "linear-gradient(165deg, rgba(6,78,59,0.78) 0%, rgba(6,48,35,0.95) 52%, rgba(7,17,31,0.98) 100%)",
        "forest-grad":
          "linear-gradient(135deg, #064E3B 0%, #047857 55%, #10B981 100%)",
      },
    },
  },
  plugins: [],
};
