/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        kahootRed: "#E21B3C",
        kahootBlue: "#1368CE",
        kahootYellow: "#D89E00",
        kahootGreen: "#26890C",
        ink: "#0e0f13",
        card: "#1a1d26",
        line: "#2a2e3a",
        muted: "#a7a9b3",
      },
    },
  },
  plugins: [],
};
