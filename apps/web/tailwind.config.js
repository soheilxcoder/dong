/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      fontFamily: { sans: ['Vazirmatn', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { DEFAULT: 'rgb(var(--c-brand) / <alpha-value>)', 2: 'rgb(var(--c-brand2) / <alpha-value>)' },
        pos: 'rgb(var(--c-pos) / <alpha-value>)',
        neg: 'rgb(var(--c-neg) / <alpha-value>)',
        neutral2: 'rgb(var(--c-neutral) / <alpha-value>)',
        amber2: 'rgb(var(--c-amber) / <alpha-value>)',
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: { DEFAULT: 'rgb(var(--c-surface) / <alpha-value>)', 2: 'rgb(var(--c-surface2) / <alpha-value>)' },
        ink: { DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)', 2: 'rgb(var(--c-ink2) / <alpha-value>)' },
        line: 'rgb(var(--c-line) / <alpha-value>)',
      },
      borderRadius: { card: '20px', btn: '16px' },
      boxShadow: {
        soft: '0 4px 24px -6px rgb(0 0 0 / 0.08), 0 1px 2px rgb(0 0 0 / 0.04)',
        softDark: '0 8px 32px -8px rgb(0 0 0 / 0.5)',
        glow: '0 0 0 1px rgb(var(--c-brand) / 0.25), 0 8px 30px -8px rgb(var(--c-brand) / 0.5)',
      },
      keyframes: {
        shake: { '0%,100%': { transform: 'translateX(0)' }, '20%,60%': { transform: 'translateX(-6px)' }, '40%,80%': { transform: 'translateX(6px)' } },
        pulseArrow: { '0%': { transform: 'translateX(0)', opacity: '0.4' }, '50%': { opacity: '1' }, '100%': { transform: 'translateX(-8px)', opacity: '0.4' } },
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
      },
      animation: { shake: 'shake 0.4s ease-in-out', pulseArrow: 'pulseArrow 1.4s ease-in-out infinite', shimmer: 'shimmer 1.6s linear infinite' },
    },
  },
  plugins: [],
};
