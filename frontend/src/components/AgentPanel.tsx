import { useState, useEffect, useMemo } from 'react'
import {
  X,
  ArrowLeft,
  MessageSquare,
  Swords,
  Target,
  Lightbulb,
  CheckCircle2,
  User,
  Users,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { useSpaceState } from '../store/SpaceContext'
import { api } from '../api'
import type { Edge, Agent, Debate } from '../api-types'

type PanelPage = 'profile' | 'debate' | 'cluster'

const STANCE_EMOJI: Record<string, string> = {
  pro: '✅',
  con: '❌',
  neutral: '⚖️',
}

const STANCE_LABEL: Record<string, string> = {
  pro: '支持派',
  con: '反对派',
  neutral: '中立派',
}

const STANCE_BG: Record<string, string> = {
  pro: '#dcfce7',
  con: '#ffe4e6',
  neutral: '#fef3c7',
}

const STANCE_TEXT: Record<string, string> = {
  pro: '#166534',
  con: '#9f1239',
  neutral: '#92400e',
}

const MOCK_ZHIHU_QUESTIONS = [
  { title: '大厂程序员该不该辞职创业？', url: 'https://www.zhihu.com/question/mock001', views: '12.4万' },
  { title: 'AI创业窗口期还有多久？', url: 'https://www.zhihu.com/question/mock002', views: '8.7万' },
  { title: '30岁转管理还是继续技术深耕？', url: 'https://www.zhihu.com/question/mock003', views: '21.3万' },
  { title: '副业验证PMF再全职创业靠谱吗？', url: 'https://www.zhihu.com/question/mock004', views: '5.2万' },
]

const DOMAIN_LABEL: Record<string, string> = {
  startup: '创业', enterprise: '企业', investment: '投资', indie: '独立开发',
  tech: '技术', finance: '金融', research: '研究', product: '产品',
  engineering: '工程', data: '数据科学', media: '媒体', opensource: '开源',
  academia: '学术', consulting: '咨询', policy: '政策', crypto: '区块链',
  security: '安全', cloud: '云架构', devops: 'DevOps', design: '设计',
  growth: '增长', legal: '法务', hr: '人力资源', marketing: '市场',
  operations: '运营', supply: '供应链', edtech: '教育科技', healthtech: '健康科技',
  fintech: '金融科技', env: '环境', sociology: '社会学', psychology: '心理学',
  philosophy: '哲学', economics: '经济学', history: '历史', futurology: '未来学',
  scifi: '科幻', journalism: '新闻', gov: '政府',
}

const MOCK_ZHIHU_USERS: Record<string, Array<{ name: string; avatar: string; title: string; followers: string; url: string }>> = {
  startup: [
    { name: '张小龙的产品观', avatar: '🔥', title: '连续创业者，前腾讯产品总监', followers: '23.5万', url: 'https://www.zhihu.com/people/zhangxiaolong' },
    { name: '李想', avatar: '🚀', title: '理想汽车创始人', followers: '18.2万', url: 'https://www.zhihu.com/people/lixiang' },
    { name: '粥左罗', avatar: '💡', title: '新媒体专家，创业博主', followers: '31.6万', url: 'https://www.zhihu.com/people/zhouzuoluo' },
  ],
  enterprise: [
    { name: '脱不花', avatar: '🏢', title: '得到APP联合创始人，前湖畔大学产品负责人', followers: '42.3万', url: 'https://www.zhihu.com/people/tuobuhua' },
    { name: '梁宁', avatar: '📈', title: '产品战略专家，前联想、腾讯产品高管', followers: '38.7万', url: 'https://www.zhihu.com/people/liangning' },
    { name: '俞军', avatar: '🎯', title: '前百度产品副总裁，产品方法论奠基人', followers: '29.1万', url: 'https://www.zhihu.com/people/yujun' },
  ],
  investment: [
    { name: '朱啸虎', avatar: '💰', title: '金沙江创投合伙人，滴滴、饿了么早期投资人', followers: '35.6万', url: 'https://www.zhihu.com/people/zhuxiaohu' },
    { name: '张磊', avatar: '📊', title: '高瓴资本创始人，价值投资者', followers: '28.4万', url: 'https://www.zhihu.com/people/zhanglei' },
    { name: '沈南鹏', avatar: '🦈', title: '红杉中国创始人，投资界教父', followers: '31.2万', url: 'https://www.zhihu.com/people/shennanpeng' },
  ],
  data: [
    { name: '陈丹琦', avatar: '📉', title: '斯坦福博士，NLP领域青年科学家', followers: '15.8万', url: 'https://www.zhihu.com/people/chendanqi' },
    { name: '李沐', avatar: '🤖', title: 'AWS资深科学家，MXNet作者', followers: '22.3万', url: 'https://www.zhihu.com/people/limu' },
    { name: '王喆', avatar: '🔢', title: '推荐系统专家，《深度学习推荐系统》作者', followers: '18.7万', url: 'https://www.zhihu.com/people/wangzhe' },
  ],
  tech: [
    { name: '阮一峰', avatar: '💻', title: '技术博主，科技爱好者周刊主编', followers: '68.5万', url: 'https://www.zhihu.com/people/ruanyifeng' },
    { name: '尤雨溪', avatar: '⚡', title: 'Vue.js 作者，前端框架设计大师', followers: '45.2万', url: 'https://www.zhihu.com/people/youyuxi' },
    { name: '轮子哥', avatar: '🌀', title: '微软资深工程师，知乎技术大V', followers: '52.1万', url: 'https://www.zhihu.com/people/lunzi' },
  ],
  product: [
    { name: '苏杰', avatar: '📱', title: '《人人都是产品经理》作者', followers: '26.4万', url: 'https://www.zhihu.com/people/sujie' },
    { name: '刘飞', avatar: '✨', title: '前滴滴产品总监，产品思维布道者', followers: '19.8万', url: 'https://www.zhihu.com/people/liufei' },
    { name: '唐韧', avatar: '🎨', title: '产品总监，产品设计方法论专家', followers: '14.5万', url: 'https://www.zhihu.com/people/tangren' },
  ],
  engineering: [
    { name: '陈皓', avatar: '⚙️', title: '资深技术专家，左耳朵耗子', followers: '55.3万', url: 'https://www.zhihu.com/people/chenhao' },
    { name: '冯大辉', avatar: '🔧', title: '前丁香园CTO，技术创业观察者', followers: '33.7万', url: 'https://www.zhihu.com/people/fengdahui' },
    { name: '阿里多隆', avatar: '🏗️', title: '阿里创始工程师，淘宝早期架构师', followers: '21.6万', url: 'https://www.zhihu.com/people/duolong' },
  ],
  finance: [
    { name: '肖飒', avatar: '⚖️', title: '法学博士，金融科技法律专家', followers: '12.3万', url: 'https://www.zhihu.com/people/xiaosa' },
    { name: '香帅', avatar: '💎', title: '北大金融系教授，财富报告作者', followers: '27.9万', url: 'https://www.zhihu.com/people/xiangshuai' },
    { name: '管清友', avatar: '📉', title: '经济学家，如是金融研究院院长', followers: '24.1万', url: 'https://www.zhihu.com/people/guanqingyou' },
  ],
  academia: [
    { name: '李飞飞', avatar: '🧬', title: '斯坦福教授，AI领军人物', followers: '32.4万', url: 'https://www.zhihu.com/people/lifeifei' },
    { name: '吴恩达', avatar: '🎓', title: 'DeepLearning.AI创始人，斯坦福教授', followers: '41.8万', url: 'https://www.zhihu.com/people/wuenda' },
    { name: '周志华', avatar: '🔬', title: '南京大学计算机系主任，西瓜书作者', followers: '19.5万', url: 'https://www.zhihu.com/people/zhoushihua' },
  ],
  design: [
    { name: '马力', avatar: '🖌️', title: '知群CEO，产品设计教育专家', followers: '16.7万', url: 'https://www.zhihu.com/people/mali' },
    { name: '东海', avatar: '🎭', title: '前阿里设计总监，设计系统专家', followers: '11.2万', url: 'https://www.zhihu.com/people/donghai' },
    { name: 'Rigo', avatar: '🌈', title: '前百度设计总监，用户体验专家', followers: '9.8万', url: 'https://www.zhihu.com/people/rigo' },
  ],
}

interface Props {
  agentId: string | null
  onClose: () => void
}

export default function AgentPanel({ agentId, onClose }: Props) {
  const { state } = useSpaceState()
  const [page, setPage] = useState<PanelPage>('profile')
  const [debate, setDebate] = useState<Debate | null>(null)
  const [debateLoading, setDebateLoading] = useState(false)
  const [selectedEdgeForDebate, setSelectedEdgeForDebate] = useState<Edge | null>(null)

  const space = state.space
  const edges = state.edges
  const agents = space?.agents ?? []

  const USER_AGENT_ID = '__user__'

  const agent = useMemo(() => {
    if (agentId === USER_AGENT_ID) {
      return {
        agent_id: USER_AGENT_ID,
        name: '你',
        stance: 'neutral',
        persona: '正在做重要决策的你。你的问题驱动了整个认知空间的生成，所有角色都在围绕你的困惑提供不同视角的思考。',
        summary: space?.query ?? '你的决策问题',
      } as Agent
    }
    return agents.find((a) => a.agent_id === agentId) ?? null
  }, [agents, agentId, space])

  const relatedEdges = useMemo(() => {
    if (!agentId || agentId === USER_AGENT_ID) return []
    const list = edges.filter((e) => e.source === agentId || e.target === agentId)
    list.sort((a, b) => b.conflict_score - a.conflict_score)
    return list
  }, [edges, agentId])

  // Reset page when agent changes
  useEffect(() => {
    setPage('profile')
    setDebate(null)
    setDebateLoading(false)
  }, [agentId])

  function getOpponent(edge: Edge): Agent | null {
    const id = edge.source === agentId ? edge.target : edge.source
    return agents.find((a) => a.agent_id === id) ?? null
  }

  async function handleDebate(edge: Edge) {
    if (!space) return
    setSelectedEdgeForDebate(edge)
    setDebateLoading(true)
    setPage('debate')
    try {
      const d = await api.createDebate(space.space_id, {
        edge_id: edge.edge_id,
        format: 'structured',
        rounds: 2,
      })
      setDebate(d)
    } catch {
      const mockDebate: Debate = {
        debate_id: 'mock_debate',
        edge_id: edge.edge_id,
        participants: [edge.source, edge.target],
        transcript: [
          {
            round: 1,
            turns: [
              { agent: edge.source, type: 'argument', content: '我方认为当前是最佳时机，窗口期有限，应该果断行动。', evidence: [] },
              { agent: edge.target, type: 'rebuttal', content: '但风险过高，盲目入场失败率极高，应谨慎行事。', evidence: [] },
            ],
          },
          {
            round: 2,
            turns: [
              { agent: edge.source, type: 'argument', content: '我们可以先用副业验证PMF，降低试错成本，而不是直接all in。', evidence: [] },
              { agent: edge.target, type: 'rebuttal', content: '副业和全职创业的心态完全不同，无法真实验证市场需求。', evidence: [] },
            ],
          },
        ],
        synthesis: {
          core_conflict: '风险判断的时间尺度不同',
          resolution_suggestion: '先用副业验证PMF，降低试错成本',
          agreement_points: ['趋势是不可逆的', '需要准备而非冲动'],
          divergence_points: ['最佳入场时机', '可接受的风险水平'],
        },
        visualization: {},
      }
      setDebate(mockDebate)
    } finally {
      setDebateLoading(false)
    }
  }

  if (!agentId || !agent) return null

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-indigo-100 shadow-2xl z-50 flex flex-col">
      <div className="relative flex-1 overflow-hidden">
        {/* Profile */}
        <div className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-out ${page === 'profile' ? 'translate-x-0' : 'translate-x-full'}`}>
          <ProfileContent agent={agent} relatedEdges={relatedEdges} getOpponent={getOpponent} onDebate={handleDebate} onClose={onClose} />
        </div>
        {/* Debate */}
        <div className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-out ${page === 'debate' ? 'translate-x-0' : page === 'profile' ? 'translate-x-full' : '-translate-x-full'}`}>
          <DebateContent debate={debate} loading={debateLoading} agents={agents} selectedEdge={selectedEdgeForDebate} onBack={() => setPage('profile')} onCluster={() => setPage('cluster')} />
        </div>
        {/* Cluster */}
        <div className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-out ${page === 'cluster' ? 'translate-x-0' : 'translate-x-full'}`}>
          <ClusterContent agentDomain={agent.domain} agentStance={agent.stance} onBack={() => setPage('debate')} />
        </div>
      </div>
    </div>
  )
}

/* ─────────────── Profile Page ─────────────── */
function ProfileContent({
  agent,
  relatedEdges,
  getOpponent,
  onDebate,
  onClose,
}: {
  agent: Agent
  relatedEdges: Edge[]
  getOpponent: (edge: Edge) => Agent | null
  onDebate: (edge: Edge) => void
  onClose: () => void
}) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-indigo-50">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-extrabold text-gray-700">角色详情</h3>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-indigo-50 transition-colors">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scroll-bounce pb-8">
        <div className="p-5 border-b border-indigo-50">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-2xl shrink-0">
              {agent.stance === 'pro' ? '✅' : agent.stance === 'con' ? '❌' : '⚖️'}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-800">{agent.name}</h2>
              <span className="inline-block text-xs font-bold px-2.5 py-0.5 rounded-full mt-1" style={{ backgroundColor: STANCE_BG[agent.stance] || '#f3f4f6', color: STANCE_TEXT[agent.stance] || '#374151' }}>
                {STANCE_EMOJI[agent.stance]} {STANCE_LABEL[agent.stance]}
              </span>
            </div>
          </div>
          <div className="mb-3">
            <p className="text-xs text-gray-400 font-bold mb-1">人设</p>
            <p className="text-sm text-gray-600 leading-relaxed">{agent.persona}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold mb-1">核心观点</p>
            <p className="text-sm text-gray-700 leading-relaxed font-medium bg-indigo-50 rounded-xl p-3">{agent.summary}</p>
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Swords className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-extrabold text-gray-700">冲突排行榜</h3>
            <span className="text-xs text-gray-400 ml-auto">与该角色分歧最大的对手</span>
          </div>

          {relatedEdges.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              {agent.agent_id === '__user__' ? '所有角色都在为你的决策提供不同视角' : '暂无冲突数据'}
            </p>
          )}

          <div className="space-y-3">
            {relatedEdges.map((edge) => {
              const opponent = getOpponent(edge)
              if (!opponent) return null
              return (
                <div key={edge.edge_id} className="p-4 rounded-2xl border border-indigo-50 bg-gray-50/50 hover:bg-white hover:shadow-sm hover:border-indigo-100 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{opponent.stance === 'pro' ? '✅' : opponent.stance === 'con' ? '❌' : '⚖️'}</span>
                      <span className="text-sm font-bold text-gray-700">{opponent.name}</span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${edge.conflict_type === 'fundamental' ? 'bg-rose-100 text-rose-600' : edge.conflict_type === 'partial' ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                      冲突 {(edge.conflict_score * 100).toFixed(0)}%
                    </span>
                  </div>
                  {edge.divergence_axes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {edge.divergence_axes.map((axis, idx) => (
                        <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 font-bold">{axis.axis}</span>
                      ))}
                    </div>
                  )}
                  <button onClick={() => onDebate(edge)} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-400 hover:bg-indigo-500 text-white text-xs font-bold transition-all">
                    <MessageSquare className="w-3.5 h-3.5" />
                    观看他们辩论
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

/* ─────────────── Debate Page ─────────────── */
function DebateContent({
  debate,
  loading,
  agents,
  selectedEdge,
  onBack,
  onCluster,
}: {
  debate: Debate | null
  loading: boolean
  agents: Agent[]
  selectedEdge: Edge | null
  onBack: () => void
  onCluster: () => void
}) {
  const [visibleTurns, setVisibleTurns] = useState(0)
  const [showSynthesis, setShowSynthesis] = useState(false)

  useEffect(() => {
    if (!debate || loading) {
      setVisibleTurns(0)
      setShowSynthesis(false)
      return
    }
    const totalTurns = debate.transcript.reduce((s, r) => s + r.turns.length, 0)
    let current = 0
    const interval = setInterval(() => {
      if (current < totalTurns) {
        setVisibleTurns((prev) => prev + 1)
        current++
      } else {
        clearInterval(interval)
        setTimeout(() => setShowSynthesis(true), 600)
      }
    }, 900)
    return () => clearInterval(interval)
  }, [debate, loading])

  const participants = selectedEdge
    ? [agents.find((a) => a.agent_id === selectedEdge.source), agents.find((a) => a.agent_id === selectedEdge.target)].filter(Boolean) as Agent[]
    : agents.slice(0, 2)

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-indigo-50">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-indigo-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-extrabold text-gray-700">💬 结构化辩论</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-5 scroll-bounce">
        {!loading && debate && (
          <div className="pb-3 border-b border-indigo-50">
            <p className="text-[10px] text-gray-400 font-bold mb-2">参与辩论的角色</p>
            <div className="flex items-center gap-3">
              {participants.map((p) => {
                const color = p.stance === 'pro' ? '#4ade80' : p.stance === 'con' ? '#fb7185' : '#fbbf24'
                return (
                  <button key={p.agent_id} onClick={onCluster} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: color + '30' }}>
                      {p.stance === 'pro' ? '✅' : p.stance === 'con' ? '❌' : '⚖️'}
                    </div>
                    <span className="text-xs font-bold text-gray-600">{p.name}</span>
                  </button>
                )
              })}
              <div className="ml-auto text-[10px] text-gray-300">点击查看聚类 →</div>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <p className="text-sm text-gray-400 font-bold">正在生成结构化辩论...</p>
          </div>
        )}

        {!loading && debate && (
          <>
            {debate.transcript.map((round, ri) => {
              let turnStart = 0
              for (let i = 0; i < ri; i++) turnStart += debate.transcript[i].turns.length
              const roundVisible = visibleTurns > turnStart
              if (!roundVisible) return null

              return (
                <div key={ri} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Round {round.round}</span>
                    <div className="flex-1 h-px bg-indigo-50" />
                  </div>
                  {round.turns.map((turn, ti) => {
                    const globalIdx = turnStart + ti
                    if (globalIdx >= visibleTurns) return null
                    const speaker = agents.find((a) => a.agent_id === turn.agent)
                    const isPro = speaker?.stance === 'pro'
                    return (
                      <div key={ti} className={`p-3 rounded-xl border-2 ${isPro ? 'border-green-100 bg-green-50' : 'border-rose-100 bg-rose-50'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPro ? 'bg-green-200 text-green-700' : 'bg-rose-200 text-rose-700'}`}>
                            {speaker?.name ?? turn.agent}
                          </span>
                          <span className="text-[10px] text-gray-400 capitalize">{turn.type}</span>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed">{turn.content}</p>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {showSynthesis && debate.synthesis && (
              <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-extrabold text-gray-700">核心冲突</span>
                </div>
                <p className="text-xs text-gray-700 bg-white rounded-xl p-3 border border-indigo-50">{debate.synthesis.core_conflict}</p>

                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-extrabold text-gray-700">给你的建议</span>
                </div>
                <p className="text-xs text-indigo-600 font-bold bg-indigo-50 rounded-xl p-3 border border-indigo-100">{debate.synthesis.resolution_suggestion}</p>

                {debate.synthesis.agreement_points.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold text-gray-400 mb-1.5">双方共识</div>
                    <div className="flex flex-wrap gap-1.5">
                      {debate.synthesis.agreement_points.map((pt, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-green-100 text-green-600 border border-green-200 font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          {pt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

    </>
  )
}

/* ─────────────── Cluster Page ─────────────── */
function ClusterContent({ agentDomain, agentStance, onBack }: { agentDomain?: string; agentStance: string; onBack: () => void }) {
  const domainKey = agentDomain && MOCK_ZHIHU_USERS[agentDomain] ? agentDomain : 'startup'
  const users = MOCK_ZHIHU_USERS[domainKey]
  const domainLabel = DOMAIN_LABEL[agentDomain ?? ''] ?? (agentDomain || '未知领域')
  const color = agentStance === 'pro' ? '#4ade80' : agentStance === 'con' ? '#fb7185' : '#fbbf24'

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-4 border-b border-indigo-50">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-indigo-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base font-extrabold text-gray-700">角色聚类</h3>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 pb-8 space-y-6 scroll-bounce">
        <div>
          <p className="text-xs text-gray-400 font-bold mb-3">参考知乎问题</p>
          <div className="space-y-2">
            {MOCK_ZHIHU_QUESTIONS.map((q, i) => (
              <a key={i} href={q.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50/50 border border-indigo-50 hover:bg-white hover:shadow-sm hover:border-indigo-100 transition-all">
                <ExternalLink className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-700 truncate">{q.title}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{q.views} 浏览 · 知乎</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 font-bold mb-3">{domainLabel} · 知乎上的对应用户</p>
          <div className="space-y-3">
            {users.map((user, idx) => (
              <a key={idx} href={user.url} target="_blank" rel="noreferrer" className="flex items-start gap-3 p-3 rounded-xl bg-white border border-indigo-50 hover:bg-indigo-50/30 hover:border-indigo-100 transition-all">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: color + '20' }}>
                  {user.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-gray-800">{user.name}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: color + '20', color }}>
                      {domainLabel}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{user.title}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{user.followers} 关注者</p>
                </div>
                <ExternalLink className="w-4 h-4 text-gray-300 shrink-0 mt-2" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
