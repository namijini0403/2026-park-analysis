/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Night-city glass surfaces; semantic keys preserve all application markup.
        navy: {
          950: "#04182B",
          900: "#061C31",
          850: "#071F35",
          800: "#09263F",
          750: "#0D2E49",
          700: "#163A56",
          600: "#214D6C",
          500: "#416B88",
          400: "#739AB6",
          300: "#AACBE0",
        },
        // Cyan-teal controls echo the supplied illuminated night-city reference.
        forest: {
          950: "#032D35",
          900: "#03414B",
          850: "#06545C",
          800: "#086772",
          700: "#087F87",
          600: "#0D9C9D",
          500: "#20CDBD",
          400: "#47EFDC",
          300: "#8BF8E9",
          200: "#BAFFF3",
        },
        // Warm sand / parchment.
        sand: {
          50: "#FAF8F2",
          100: "#F2EEE3",
          200: "#E5DECB",
          300: "#D2C8AE",
        },
        // Status colors remain distinct on dark panels.
        signal: {
          warn: "#F59E0B",
          warnSoft: "#FDE68A",
          alert: "#F43F5E",
          alertSoft: "#FDA4AF",
          info: "#5DA8D4",
          infoSoft: "#93CFFD",
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
        soft: "0 12px 30px -18px rgba(0, 6, 18, 0.5)",
        card: "0 16px 36px -22px rgba(0,6,18,0.6), inset 0 1px 0 rgba(145,218,255,0.035)",
        cardLift: "0 18px 38px -24px rgba(0,6,18,0.7), 0 0 0 1px rgba(71,239,220,0.08)",
        glow: "0 0 0 1px rgba(71,239,220,0.26), 0 0 22px -10px rgba(71,239,220,0.6), inset 0 0 14px rgba(71,239,220,0.07)",
      },
      backgroundImage: {
        "navy-grad":
          "linear-gradient(180deg, #04182B 0%, #061D32 52%, #041629 100%)",
        "card-grad":
          "linear-gradient(145deg, rgba(9,39,64,0.96) 0%, rgba(7,31,53,0.97) 58%, rgba(5,24,43,0.98) 100%)",
        "card-grad-hover":
          "linear-gradient(145deg, #0D304B 0%, #0A2943 58%, #072238 100%)",
        "forest-grad":
          "linear-gradient(135deg, #087A84 0%, #078A8B 56%, #075865 100%)",
      },
    },
  },
  plugins: [],
};
