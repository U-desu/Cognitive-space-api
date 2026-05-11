import { useState } from 'react'
import { useSpaceState } from '../store/SpaceContext'
import { Users, Swords, TrendingUp, Target, HelpCircle } from 'lucide-react'

export default function MetricsHUD() {
  const { state } = useSpaceState()
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null)

  const space = state.space
  const traj = state.trajectory
  const metrics = traj?.cognitive_metrics as Record<string, number> | undefined

  if (!space) return null

  // Stance distribution
  const stanceCount = { pro: 0, con: 0, neutral: 0 }
  space.agents.forEach((a) => {
    if (a.stance in stanceCount) stanceCount[a.stance]++
  })

  // Fallback mock values for coverage and depth if not computed yet
  const coverage = metrics?.coverage_area ?? 0.18
  const depth = metrics?.depth_score ?? 0.12

  const items = [
    {
      label: '探索视角',
      value: `${space.agents.length} 个`,
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-50',
      tooltip: '围绕你的问题召唤了多少个不同角色的专家视角',
    },
    {
      label: '立场分布',
      value: `✅${stanceCount.pro} ❌${stanceCount.con} ⚖️${stanceCount.neutral}`,
      icon: Swords,
      color: 'text-rose-400',
      bg: 'bg-rose-50',
      tooltip: '支持派、反对派、中立派各有几人，帮你一眼看清阵营格局',
    },
  ]

  return (
    <div className="px-4 py-1.5 border-b border-indigo-100 bg-white/80 backdrop-blur relative">
      <div className="flex items-center gap-3 overflow-x-auto">
        {items.map((item, idx) => (
          <div
            key={item.label}
            className={`relative flex items-center gap-2 px-3 py-1 rounded-xl border border-indigo-50 shadow-sm ${item.bg} cursor-help hover:border-indigo-200 transition-colors`}
            onMouseEnter={() => setTooltipIdx(idx)}
            onMouseLeave={() => setTooltipIdx(null)}
          >
            <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
            <div>
              <div className="flex items-center gap-1">
                <div className="text-[9px] text-gray-400 font-bold">{item.label}</div>
                <HelpCircle className="w-3 h-3 text-indigo-300" />
              </div>
              <div className="text-xs font-bold text-gray-700">{item.value}</div>
            </div>

            {/* Tooltip */}
            {tooltipIdx === idx && (
              <div className="absolute top-full left-0 mt-2 z-[60] px-3 py-2 rounded-xl bg-gray-800 text-white text-xs max-w-[220px] shadow-xl animate-in fade-in slide-in-from-top-1 duration-200">
                {item.tooltip}
                <div className="absolute -top-1 left-6 w-2 h-2 bg-gray-800 rotate-45" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
