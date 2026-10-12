/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ide: {
          bg: '#0d1117',
          surface: '#161b22',
          border: '#30363d',
          accent: '#58a6ff',
          cyber: '#00ffcc',
          neon: '#bd93f9',
          danger: '#f85149',
          warning: '#d29922',
          success: '#3fb950',
          text: '#c9d1d9',
          muted: '#8b949e',
        },
      },
    },
  },
  plugins: [],
};
