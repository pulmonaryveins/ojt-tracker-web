import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AccentColor = 'blurple' | 'pink' | 'red' | 'green' | 'yellow' | 'teal'
export type ThemeMode = 'dark' | 'light'

const ACCENT_COLORS: Record<AccentColor, { main: string; hover: string; light: string; border: string }> = {
  blurple: { main: '#5865f2', hover: '#4752c4', light: '#5865f220', border: '#5865f266' },
  pink:    { main: '#e91e8c', hover: '#c4186e', light: '#e91e8c20', border: '#e91e8c66' },
  red:     { main: '#ed4245', hover: '#c03537', light: '#ed424520', border: '#ed424566' },
  green:   { main: '#23a55a', hover: '#1a8046', light: '#23a55a20', border: '#23a55a66' },
  yellow:  { main: '#f0b232', hover: '#c48f20', light: '#f0b23220', border: '#f0b23266' },
  teal:    { main: '#1abc9c', hover: '#15967a', light: '#1abc9c20', border: '#1abc9c66' },
}

interface ThemeStore {
  mode: ThemeMode
  accent: AccentColor
  setMode: (mode: ThemeMode) => void
  setAccent: (accent: AccentColor) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      mode: 'dark',
      accent: 'blurple',
      setMode: (mode) => {
        set({ mode })
        applyTheme(mode, undefined)
      },
      setAccent: (accent) => {
        set({ accent })
        applyTheme(undefined, accent)
      },
    }),
    { name: 'ojt-theme' }
  )
)

export function applyTheme(mode?: ThemeMode, accent?: AccentColor) {
  const store = useThemeStore.getState()
  const m = mode ?? store.mode
  const a = accent ?? store.accent
  const root = document.documentElement

  if (m === 'light') {
    root.classList.add('light')
  } else {
    root.classList.remove('light')
  }

  const colors = ACCENT_COLORS[a]
  root.style.setProperty('--accent', colors.main)
  root.style.setProperty('--accent-hover', colors.hover)
  root.style.setProperty('--accent-light', colors.light)
  root.style.setProperty('--accent-border', colors.border)
}

export { ACCENT_COLORS }
