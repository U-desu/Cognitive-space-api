import { useState, useRef, useEffect } from 'react'
import { Palette } from 'lucide-react'
import { useTheme } from './ThemeContext'
import { THEMES } from './themes'

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const current = THEMES.find((t) => t.id === theme)!

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all theme-switcher-trigger"
        title="切换主题"
      >
        <Palette className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{current.name}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border shadow-2xl overflow-hidden theme-switcher-dropdown z-[100]">
          <div className="p-2 space-y-1">
            <p className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider theme-switcher-label">
              选择认知风格
            </p>
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id)
                  setOpen(false)
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all theme-switcher-item ${
                  theme === t.id ? 'active' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{t.name}</p>
                  <p className="text-[10px] theme-switcher-item-desc truncate">{t.tagline}</p>
                </div>
                {theme === t.id && (
                  <div
                    className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: t.accent }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
