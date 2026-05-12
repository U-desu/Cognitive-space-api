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
  '/avatars-blue/极客赌徒.png',
  '/avatars-blue/稳健派VP.png',
  '/avatars-blue/焦虑中干.png',
  '/avatars-blue/海归博士.png',
  '/avatars-blue/财务自由者.png',
  '/avatars-blue/外包老兵.png',
  '/avatars-blue/转型顾问.png',
  '/avatars-blue/赛道投资人.png',
  '/avatars-blue/体制内观察员.png',
  '/avatars-blue/佛系产品经理.png',
  '/avatars-blue/草根逆袭者.png',
  '/avatars-blue/大厂HRD.png',
  '/avatars-blue/全栈工程师.png',
  '/avatars-blue/护城河构建者.png',
  '/avatars-blue/趋势洞察者.png',
  '/avatars-blue/AI布道者.png',
  '/avatars-blue/技术写作者.png',
  '/avatars-blue/地缘政治分析师.png',
  '/avatars-blue/增长黑客.png',
  '/avatars-blue/商务拓展.png',
  '/avatars-blue/基础科学研究者.png',
  '/avatars-blue/全球化运营.png',
  '/avatars-blue/安全极客.png',
  '/avatars-blue/运维工程师.png',
  '/avatars-blue/技术天花板.png',
  '/avatars-blue/管理教父.png',
  '/avatars-blue/斜杠青年.png',
  '/avatars-blue/焦虑螺丝钉.png',
  '/avatars-blue/职场老油条.png',
  '/avatars-blue/创业预备役.png',
  '/avatars-blue/女性CTO.png',
  '/avatars-blue/海归高管.png',
  '/avatars-blue/技术布道者.png',
  '/avatars-blue/健康至上者.png',
  '/avatars-blue/天才少年.png',
  '/avatars-blue/跨界艺术家.png',
]
