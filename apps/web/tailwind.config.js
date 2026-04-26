/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f1',
          100: '#ffe1e2',
          500: '#DE272C',
          600: '#c91f24',
          700: '#a9161b',
          900: '#3b0608',
        },
      },
    },
  },
  plugins: [],
}
