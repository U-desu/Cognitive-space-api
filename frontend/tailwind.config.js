/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        space: {
          bg: '#f0f4ff',
          surface: '#ffffff',
          border: '#c7d2fe',
          text: '#374151',
          muted: '#6b7280',
          cyan: '#60a5fa',
          magenta: '#c084fc',
          amber: '#fbbf24',
          red: '#fb7185',
          green: '#4ade80',
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
