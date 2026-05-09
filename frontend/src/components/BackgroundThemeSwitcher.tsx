import { useState, useRef, useEffect } from 'react'
import { Palette, Check } from 'lucide-react'

export interface Theme {
  id: string
  name: string
  color: string
  style: 'light' | 'dark'
}

export const THEMES: Theme[] = [
  { id: 'lake', name: '科技湖蓝', color: '#d8ecef', style: 'light' },
  { id: 'soft', name: '柔和展示', color: '#d6e5f0', style: 'light' },
  { id: 'premium', name: '高级通用', color: '#f2ead3', style: 'light' },
  { id: 'minimal', name: '极简灰白', color: '#e5e5e5', style: 'light' },
  { id: 'starry', name: '深邃星空', color: '#0f172a', style: 'dark' },
  { id: 'nebula', name: '深空紫黑', color: '#1a1a2e', style: 'dark' },
]

const STORAGE_KEY = 'space-bg-theme'

export function getSavedTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const found = THEMES.find((t) => t.id === saved)
      if (found) return found
    }
  } catch {
    // ignore
  }
  return THEMES[0]
}

interface Props {
  currentTheme: Theme
  onThemeChange: (theme: Theme) => void
}

export default function BackgroundThemeSwitcher({ currentTheme, onThemeChange }: Props) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleSelect = (theme: Theme) => {
    onThemeChange(theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme.id)
    } catch {
      // ignore
    }
    setOpen(false)
  }

  const isDark = currentTheme.style === 'dark'

  return (
    <div ref={panelRef} className="absolute top-4 right-4 z-30">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center justify-center w-10 h-10 rounded-full border shadow-lg transition-all hover:scale-105 active:scale-95 ${
          isDark
            ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
            : 'bg-white/80 border-white/60 text-gray-700 hover:bg-white'
        }`}
        title="更换背景主题"
      >
        <Palette className="w-5 h-5" />
      </button>

      {/* Theme panel */}
      <div
        className={`absolute top-12 right-0 w-56 rounded-2xl border shadow-2xl overflow-hidden transition-all duration-200 origin-top-right ${
          open
            ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'
        } ${
          isDark
            ? 'bg-gray-900/90 border-white/10 backdrop-blur'
            : 'bg-white/90 border-white/60 backdrop-blur'
        }`}
      >
        <div className="px-4 py-3 border-b border-black/5">
          <span
            className={`text-xs font-bold ${
              isDark ? 'text-gray-300' : 'text-gray-500'
            }`}
          >
            选择背景主题
          </span>
        </div>
        <div className="p-2 grid grid-cols-2 gap-2">
          {THEMES.map((theme) => {
            const active = currentTheme.id === theme.id
            return (
              <button
                key={theme.id}
                onClick={() => handleSelect(theme)}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all ${
                  active
                    ? isDark
                      ? 'bg-white/15 ring-1 ring-white/30'
                      : 'bg-indigo-50 ring-1 ring-indigo-200'
                    : isDark
                    ? 'hover:bg-white/10'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                    active ? 'border-indigo-400' : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: theme.color }}
                >
                  {active && <Check className="w-3 h-3 text-white drop-shadow" strokeWidth={3} />}
                </span>
                <span
                  className={`text-xs font-medium truncate ${
                    isDark ? 'text-gray-200' : 'text-gray-700'
                  }`}
                >
                  {theme.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
