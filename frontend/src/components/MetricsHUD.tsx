import { useSpaceState } from '../store/SpaceContext'
import { Brain, Target, TrendingUp, Zap } from 'lucide-react'

export default function MetricsHUD() {
  const { state } = useSpaceState()
  const traj = state.trajectory
  const metrics = traj?.cognitive_metrics as Record<string, number> | undefined
  const space = state.space

  if (!space) return null

  const items = [
    {
      label: 'Agent 数',
      value: space.agents.length,
      icon: Brain,
      color: 'text-space-cyan',
    },
    {
      label: '冲突边',
      value: state.edges.length,
      icon: Zap,
      color: 'text-space-magenta',
    },
    {
      label: '认知扩展',
      value: metrics?.coverage_area
        ? `${(metrics.coverage_area * 100).toFixed(0)}%`
        : '—',
      icon: TrendingUp,
      color: 'text-space-amber',
    },
    {
      label: '深度',
      value: metrics?.depth_score
        ? `${(metrics.depth_score * 100).toFixed(0)}%`
        : '—',
      icon: Target,
      color: 'text-space-cyan',
    },
  ]

  return (
    <div className="px-6 py-3 border-b border-space-border bg-space-surface/50 backdrop-blur">
      <div className="flex items-center gap-6 overflow-x-auto">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-space-bg border border-space-border"
          >
            <item.icon className={`w-4 h-4 ${item.color}`} />
            <div>
              <div className="text-xs text-space-muted">{item.label}</div>
              <div className="text-sm font-mono font-semibold text-space-text">
                {item.value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
