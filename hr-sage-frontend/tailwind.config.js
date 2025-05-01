/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      keyframes: {
        pan: {
          "0%": { backgroundPosition: "top left" },
          "100%": { backgroundPosition: "bottom right" },
        },
        fade: {
          "0%, 40%": { opacity: "1" },
          "50%, 90%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "pan-slow": "pan 60s linear infinite",
        "fade-slow": "fade 120s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
