/**
 * Shared constants used across both 2D and 3D views.
 * Centralizing these prevents drift when colors or identifiers change.
 */

export const STANCE_COLORS: Record<string, string> = {
  pro: '#4ade80',
  con: '#fb7185',
  neutral: '#fbbf24',
}

export const STANCE_EMOJI: Record<string, string> = {
  pro: '✅',
  con: '❌',
  neutral: '⚖️',
}

/** Sentinel ID for the central question node */
export const USER_AGENT_ID = '__user__'

/** 36 avatar sprite paths served from /avatars/ via publicDir */
export const AVATAR_IMAGES = [
  '/avatars/极客赌徒.png',
  '/avatars/稳健派VP.png',
  '/avatars/焦虑中干.png',
  '/avatars/海归博士.png',
  '/avatars/财务自由者.png',
  '/avatars/外包老兵.png',
  '/avatars/转型顾问.png',
  '/avatars/赛道投资人.png',
  '/avatars/体制内观察员.png',
  '/avatars/佛系产品经理.png',
  '/avatars/草根逆袭者.png',
  '/avatars/大厂HRD.png',
  '/avatars/全栈工程师.png',
  '/avatars/护城河构建者.png',
  '/avatars/趋势洞察者.png',
  '/avatars/AI布道者.png',
  '/avatars/技术写作者.png',
  '/avatars/地缘政治分析师.png',
  '/avatars/增长黑客.png',
  '/avatars/商务拓展.png',
  '/avatars/基础科学研究者.png',
  '/avatars/全球化运营.png',
  '/avatars/安全极客.png',
  '/avatars/运维工程师.png',
  '/avatars/技术天花板.png',
  '/avatars/管理教父.png',
  '/avatars/斜杠青年.png',
  '/avatars/焦虑螺丝钉.png',
  '/avatars/职场老油条.png',
  '/avatars/创业预备役.png',
  '/avatars/女性CTO.png',
  '/avatars/海归高管.png',
  '/avatars/技术布道者.png',
  '/avatars/健康至上者.png',
  '/avatars/天才少年.png',
  '/avatars/跨界艺术家.png',
]
