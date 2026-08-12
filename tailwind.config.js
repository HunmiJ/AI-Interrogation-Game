/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        display: ['Georgia', 'Noto Serif SC', 'serif'],
      },
      colors: {
        ink: '#090b0d',
        panel: '#111418',
        brass: '#c9a66b',
        danger: '#b6453a',
      },
    },
  },
  plugins: [],
}
