import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, MessageSquare } from 'lucide-react'
import { useSpaceState } from '../store/SpaceContext'
import { useTheme } from '../theme/ThemeContext'
import { api } from '../api'
import LoadingOverlay from './LoadingOverlay'
import type { Space } from '../api-types'

interface Props {
  isOpen: boolean
  onToggle: () => void
}

const NARROW_WIDTH = 56
const SIDEBAR_WIDTH = 280

export default function SpaceHistorySidebar({ isOpen, onToggle }: Props) {
  const { state, dispatch } = useSpaceState()
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [mainIconHover, setMainIconHover] = useState(false)
  const [navigating, setNavigating] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    api.getSpaceHistory()
      .then((items) => dispatch({ type: 'SET_HISTORY', payload: items }))
      .catch(() => {})
  }, [isOpen, dispatch])

  const handleDelete = async (e: React.MouseEvent, item: Space) => {
    e.stopPropagation()
    if (!confirm(`删除「${item.query}」的历史记录？`)) return
    setDeletingId(item.space_id)
    try {
      await api.deleteSpaceHistory(item.space_id)
      dispatch({ type: 'REMOVE_HISTORY_ITEM', payload: item.space_id })
    } catch {
      alert('删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  const handleClick = (item: Space) => {
    if (navigating) return
    setNavigating(true)
    dispatch({ type: 'SET_SPACE', payload: item })
    // 延迟 60ms 确保 LoadingOverlay 渲染后再导航，阻止重复点击
    setTimeout(() => {
      navigate(`/space/${item.space_id}`)
    }, 60)
  }

  const accentColors: Record<string, string> = {
    cyberpunk: '#00f0ff',
    deepspace: '#3b82f6',
    matrix: '#00ff88',
  }
  const accent = accentColors[theme]

  return (
    <>
      <LoadingOverlay open={navigating} message="正在进入认知空间..." />
      <aside
        className="fixed left-0 top-0 h-full z-40 flex flex-col border-r transition-all duration-300 ease-out overflow-hidden"
        style={{
          width: isOpen ? SIDEBAR_WIDTH : NARROW_WIDTH,
          backgroundColor: 'var(--space-surface)',
          borderColor: 'var(--space-border)',
        }}
      >
      {/* ═══ Top section: left icons + right labels ═══ */}
      <div className="flex shrink-0">
        {/* Left column (56px) — icons */}
        <div className="flex flex-col items-center shrink-0 pt-6 gap-6" style={{ width: NARROW_WIDTH }}>
          <button
            onClick={isOpen ? undefined : onToggle}
            onMouseEnter={() => setMainIconHover(true)}
            onMouseLeave={() => setMainIconHover(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 hover:bg-white/5"
            title={isOpen ? '' : '展开'}
            style={{ cursor: isOpen ? 'default' : 'pointer' }}
          >
            <img
              src={mainIconHover && !isOpen ? '/icon/icon_side.png' : '/icon/icon.png'}
              alt=""
              className="w-6 h-6 object-contain"
            />
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center">
            <img src="/icon/icon_idea.png" alt="" className="w-6 h-6 object-contain opacity-80" />
          </div>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center">
            <img src="/icon/icon_history.png" alt="" className="w-6 h-6 object-contain opacity-80" />
          </div>
        </div>

        {/* Right column — labels + close button, only when expanded */}
        <div
          className="flex-1 flex flex-col pt-6 gap-6 overflow-hidden"
          style={{ opacity: isOpen ? 1 : 0, transition: 'opacity 0.2s ease' }}
        >
          <div className="w-8 h-8 flex items-center justify-center self-end mr-3">
            <button
              onClick={onToggle}
              className="w-full h-full rounded-lg flex items-center justify-center transition-all hover:scale-105 hover:bg-white/5"
              title="收起"
            >
              <img src="/icon/icon_side.png" alt="" className="w-6 h-6 object-contain opacity-80" />
            </button>
          </div>
          <div className="h-8 flex items-center">
            <span className="text-sm text-white font-medium">新的问题空间</span>
          </div>
          <div className="h-8 flex items-center">
            <span className="text-sm text-white font-medium">历史问题空间</span>
          </div>
        </div>
      </div>

      {/* ═══ Divider (full width) ═══ */}
      <div
        className="shrink-0 border-t my-4 mx-3"
        style={{
          borderColor: accent + '15',
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* ═══ History list (full width, spans entire sidebar) ═══ */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar pt-2"
        style={{
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 0.2s ease',
        }}
      >
        {state.spacesHistory.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: accent }} />
            <p className="text-xs text-space-muted">还没有探索记录</p>
          </div>
        )}
        {state.spacesHistory.map((item) => (
          <div
            key={item.space_id}
            onClick={() => handleClick(item)}
            className="group relative p-3 rounded-xl border cursor-pointer transition-all hover:shadow-sm mb-3 mx-3"
            style={{
              backgroundColor: 'var(--space-bg)',
              borderColor: accent + '10',
            }}
          >
            <p className="text-sm font-medium text-space-text line-clamp-2 pr-6">
              {item.query}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-space-muted">
                {item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : ''}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: accent + '12', color: accent }}>
                {item.agents?.length ?? 0} 角色
              </span>
            </div>
            <button
              onClick={(e) => handleDelete(e, item)}
              disabled={deletingId === item.space_id}
              className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/10 text-red-400"
              title="删除"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      </aside>
    </>
  )
}
