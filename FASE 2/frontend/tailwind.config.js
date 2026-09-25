import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        ink: '#22343A',
        brand: {
          DEFAULT: '#35858E',
          dark: '#276169',
        },
        sage: '#7DA78C',
        lime: '#C2D099',
        crema: '#E6EEC9',
        linea: '#cfd4d8',
        ok: '#2e7d32',
        alerta: '#ef6c00',
        falla: '#c62828',
      },
    },
  },
  plugins: [],
}
