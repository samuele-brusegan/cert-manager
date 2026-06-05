/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff",
          100: "#d9eaff",
          500: "#2f7ce5",
          600: "#1f63c4",
          700: "#1a4f9c",
        },
      },
    },
  },
  plugins: [],
};
