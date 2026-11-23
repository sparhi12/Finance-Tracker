/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        simplifi: {
          blue: "#0d6efd",
          teal: "#00a88f",
          dark: "#0f172a",
          card: "#ffffff",
          muted: "#64748b",
          border: "#e2e8f0"
        }
      }
    },
  },
  plugins: [],
}
