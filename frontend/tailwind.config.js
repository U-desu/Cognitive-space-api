/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        space: {
          bg: 'var(--space-bg)',
          surface: 'var(--space-surface)',
          border: 'var(--space-border)',
          text: 'var(--space-text)',
          muted: 'var(--space-muted)',
          cyan: 'var(--space-cyan)',
          magenta: 'var(--space-magenta)',
          amber: 'var(--space-amber)',
          red: 'var(--space-red)',
          green: 'var(--space-green)',
        },
      },
      fontFamily: {
        mono: ['"SF Mono"', 'Monaco', 'monospace'],
      },
      animation: {
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        dash: 'dash 1.5s linear infinite',
      },
      keyframes: {
        dash: {
          '0%': { strokeDashoffset: '20' },
          '100%': { strokeDashoffset: '0' },
        },
      },
    },
  },
  plugins: [],
}
