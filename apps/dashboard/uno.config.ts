import { defineConfig, presetUno, presetWebFonts } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
  ],
  theme: {
    colors: {
      base: '#050507',
      surface: '#0d0d12',
      elevated: '#141419',
      overlay: '#1a1a22',
      subtle: '#1f1f28',
      border: { DEFAULT: '#1e1e28', strong: '#2a2a38', focus: '#4f4faa' },
      primary: { DEFAULT: '#5b5ef4', hover: '#6b6ef9' },
      success: '#00d97e',
      warning: '#f5a623',
      danger: '#ff4757',
      info: '#00b4d8',
      txt: { primary: '#ededf0', secondary: '#8888a0', muted: '#55556a' },
    },
  },
  shortcuts: {
    'btn-primary': 'bg-primary text-white px-4 py-2 rounded-md font-medium transition-all duration-120 hover:bg-primary-hover hover:shadow-[var(--primary-glow)]',
    'btn-ghost': 'bg-transparent text-txt-secondary px-4 py-2 rounded-md font-medium transition-all duration-120 hover:bg-overlay hover:text-txt-primary',
    'btn-danger': 'bg-danger/10 text-danger px-4 py-2 rounded-md font-medium transition-all duration-120 hover:bg-danger/20',
  },
})
