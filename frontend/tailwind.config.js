/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gain: {
          text:   '#0a7a42',
          border: '#10b981',
          bg:     '#f0fdf8',
        },
        loss: {
          text:   '#be1c1c',
          border: '#f43f5e',
          bg:     '#fff5f5',
        },
        card:  { border: '#e2e8f0' },
        sub:   { label: '#94a3b8', value: '#334155' },
        main:  '#0f172a',
        muted: '#64748b',
        accent: '#2563eb',
        navy:   '#2e4a8a',
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
}
