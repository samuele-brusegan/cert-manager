/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          300: "#93c5fd",
          400: "#6aa6f0",
          500: "#2f7ce5",
          600: "#1f63c4",
          700: "#1a4f9c",
          900: "#172e5c",
        },
      },
    },
  },
  plugins: [],
};
