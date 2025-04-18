/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#25D366',
          DEFAULT: '#128C7E',
          dark: '#075E54',
        },
        secondary: '#34B7F1',
        background: '#F5F5F5',
        card: '#FFFFFF',
        success: '#4CAF50',
        error: '#F44336',
        warning: '#FF9800',
      },
      boxShadow: {
        card: '0 4px 6px rgba(0, 0, 0, 0.1)',
      },
      borderRadius: {
        card: '8px',
      },
    },
  },
  plugins: [],
}
