/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deep navy - shared with the guide modal and cover screen.
        navy: {
          950: "#050B14",
          900: "#081421",
          850: "#101B2D",
          800: "#152238",
          750: "#1B2B44",
          700: "#233650",
          600: "#304760",
          500: "#466177",
          400: "#6D8799",
          300: "#A8BBC9",
        },
        // Deep forest / emerald - restrained policy-dashboard accent.
        forest: {
          950: "#02140C",
          900: "#042016",
          850: "#063323",
          800: "#047857",
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
          warn: "#F59E0B",
          warnSoft: "#FBE6A9",
          alert: "#F43F5E",
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
          "linear-gradient(180deg, #050B14 0%, #081421 52%, #101B2D 100%)",
        "card-grad":
          "linear-gradient(165deg, rgba(21,34,56,0.96) 0%, rgba(16,27,45,0.98) 55%, rgba(8,20,33,0.98) 100%)",
        "card-grad-hover":
          "linear-gradient(165deg, rgba(27,43,68,0.98) 0%, rgba(21,34,56,0.98) 55%, rgba(8,20,33,0.98) 100%)",
        "forest-grad":
          "linear-gradient(135deg, #047857 0%, #059669 55%, #10B981 100%)",
      },
    },
  },
  plugins: [],
};
