import { useEffect, useState } from 'react'
import { X, Download, Trophy, Eye, MessageCircle, Users } from 'lucide-react'
import { api } from '../api'
import { useSpaceState } from '../store/SpaceContext'

interface Props {
  spaceId: string
  onClose: () => void
}

export default function ShareCard({ spaceId, onClose }: Props) {
  const { state } = useSpaceState()
  const [exportData, setExportData] = useState<Record<string, unknown> | null>(null)

  const space = state.space
  const traj = state.trajectory
  const edges = state.edges

  useEffect(() => {
    api
      .exportSpace(spaceId, { format: 'shareable_card' })
      .then((d) => {
        setExportData(d)
      })
      .catch(() => {
        // ignore
      })
  }, [spaceId])

  const metrics = traj?.cognitive_metrics as Record<string, number> | undefined
  const coverage = metrics?.coverage_area ?? 0
  const debateCount = edges.filter((e) => e.debate_recommended).length

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-indigo-50">
          <h3 className="text-base font-extrabold text-gray-700">🎉 我的认知探索报告</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-indigo-50 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-5">
          {/* Question */}
          <div>
            <p className="text-xs text-gray-400 font-bold mb-1">探索的问题</p>
            <p className="text-sm font-bold text-gray-800 leading-relaxed">
              {space?.query ?? '未知问题'}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-indigo-50 text-center">
              <Users className="w-5 h-5 text-indigo-400 mx-auto mb-1" />
              <p className="text-lg font-extrabold text-indigo-600">
                {space?.agents.length ?? 0}
              </p>
              <p className="text-[10px] text-indigo-400 font-bold">探索视角</p>
            </div>
            <div className="p-3 rounded-2xl bg-rose-50 text-center">
              <MessageCircle className="w-5 h-5 text-rose-400 mx-auto mb-1" />
              <p className="text-lg font-extrabold text-rose-600">{debateCount}</p>
              <p className="text-[10px] text-rose-400 font-bold">核心冲突</p>
            </div>
            <div className="p-3 rounded-2xl bg-amber-50 text-center">
              <Eye className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-lg font-extrabold text-amber-600">
                {Math.round(coverage * 100)}%
              </p>
              <p className="text-[10px] text-amber-400 font-bold">认知扩展</p>
            </div>
          </div>

          {/* Coverage Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-gray-600">认知扩展指数</span>
              </div>
              <span className="text-xs font-extrabold text-indigo-500">
                {Math.round(coverage * 100)}%
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-400 transition-all"
                style={{ width: `${Math.max(5, coverage * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              {coverage > 0.5
                ? '👏 你已经探索了非常多元的视角！'
                : coverage > 0.2
                ? '💪 继续探索更多观点，扩展你的认知边界'
                : '🚀 点击角色，开始你的认知探索之旅'}
            </p>
          </div>

          {/* Export Preview */}
          {exportData && (
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <p className="text-[10px] text-gray-400 font-bold mb-1">卡片预览</p>
              <p className="text-xs text-gray-600 font-medium">
                {(() => {
                  const preview = (exportData as any).card_preview
                  return preview?.summary ?? '已生成探索报告'
                })()}
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-indigo-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-indigo-100 text-gray-500 text-sm font-bold hover:bg-indigo-50 transition-colors"
          >
            关闭
          </button>
          <button
            onClick={() => {
              const text = `我在「决策罗盘」探索了"${space?.query}"，接触了${space?.agents.length}个不同视角，认知扩展指数${Math.round(coverage * 100)}%！`
              navigator.clipboard.writeText(text)
              alert('已复制到剪贴板！')
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-400 hover:bg-indigo-500 text-white text-sm font-bold transition-colors"
          >
            <Download className="w-4 h-4" />
            复制分享语
          </button>
        </div>
      </div>
    </div>
  )
}
