import { useTheme } from '../theme/ThemeContext'
import { ArrowRight, RotateCcw, Sparkles, X } from 'lucide-react'
import type { Space } from '../api-types'

interface Props {
  isOpen: boolean
  existingSpace: Space | null
  similarity: number
  onReuse: () => void
  onCreateNew: () => void
  onClose: () => void
}

export default function DedupModal({ isOpen, existingSpace, similarity, onReuse, onCreateNew, onClose }: Props) {
  const { theme } = useTheme()

  if (!isOpen || !existingSpace) return null

  const accentColors: Record<string, string> = {
    cyberpunk: '#00f0ff',
    deepspace: '#3b82f6',
    matrix: '#00ff88',
  }
  const accent = accentColors[theme]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl border shadow-2xl p-6 animate-in fade-in zoom-in duration-200"
        style={{
          backgroundColor: 'var(--space-bg)',
          borderColor: accent + '25',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/5 text-space-muted transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: accent + '15' }}
          >
            <Sparkles className="w-5 h-5" style={{ color: accent }} />
          </div>
          <div>
            <h3 className="text-base font-bold text-space-text">发现相似问题</h3>
            <p className="text-xs text-space-muted">
              相似度 {Math.round(similarity * 100)}% · 已为你保存过该空间
            </p>
          </div>
        </div>

        {/* Existing space card */}
        <div
          className="rounded-xl border p-4 mb-6"
          style={{
            backgroundColor: 'var(--space-surface)',
            borderColor: accent + '15',
          }}
        >
          <p className="text-sm font-medium text-space-text mb-2 line-clamp-2">
            {existingSpace.query}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-space-muted">
            <span>ID: {existingSpace.space_id}</span>
            <span>·</span>
            <span>{existingSpace.agents.length} 个角色</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onReuse}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white font-bold text-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)` }}
          >
            <RotateCcw className="w-4 h-4" />
            查看已有空间
          </button>
          <button
            onClick={onCreateNew}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm border transition-all hover:bg-white/5"
            style={{ borderColor: accent + '25', color: accent }}
          >
            <ArrowRight className="w-4 h-4" />
            仍然创建新的
          </button>
        </div>
      </div>
    </div>
  )
}
