export type ThemeId = 'cyberpunk' | 'deepspace' | 'matrix' | 'zhihu'

export interface ThemeMeta {
  id: ThemeId
  name: string
  tagline: string
  icon: string
  accent: string
}

/** 统一品牌 Logo */
export const BRAND_LOGO = '/icon-blue/icon.png'

export const THEMES: ThemeMeta[] = [
  {
    id: 'zhihu',
    name: '知乎',
    tagline: '认真 · 专业 · 友善',
    icon: '/icon-blue/icon.png',
    accent: '#0084ff',
  },
  {
    id: 'cyberpunk',
    name: '霓虹迷城',
    tagline: '赛博朋克 · 霓虹数据流',
    icon: '/icon-blue/icon.png',
    accent: '#00f0ff',
  },
  {
    id: 'deepspace',
    name: '星际认知',
    tagline: '深空探索 · 星河图谱',
    icon: '/icon-blue/icon.png',
    accent: '#3b82f6',
  },
  {
    id: 'matrix',
    name: '神经织网',
    tagline: '认知矩阵 · 神经网络',
    icon: '/icon-blue/icon.png',
    accent: '#00ff88',
  },
]

export const DEFAULT_THEME: ThemeId = 'zhihu'

/** 获取主题特定的 CSS 变量映射（供 JS 中直接读取） */
export function getThemeVars(theme: ThemeId): Record<string, string> {
  switch (theme) {
    case 'zhihu':
      return {
        '--app-bg': '#f6f6f6',
        '--app-surface': '#ffffff',
        '--app-card': '#ffffff',
        '--app-card-hover': '#f6f6f6',
        '--app-border': '#ebebeb',
        '--app-border-accent': 'rgba(0, 132, 255, 0.25)',
        '--app-text': '#121212',
        '--app-text-secondary': '#8590a6',
        '--app-text-muted': '#c2c2c2',
        '--accent-primary': '#0084ff',
        '--accent-secondary': '#0066ff',
        '--accent-tertiary': '#00b4ff',
        '--success': '#00c853',
        '--warning': '#ff9800',
        '--danger': '#f44336',
      }
    case 'cyberpunk':
      return {
        '--app-bg': '#050508',
        '--app-surface': '#0a0a12',
        '--app-card': '#0f0f1a',
        '--app-card-hover': '#151528',
        '--app-border': '#1a1a2e',
        '--app-border-accent': 'rgba(0, 240, 255, 0.25)',
        '--app-text': '#e0e0e8',
        '--app-text-secondary': '#8b8b9a',
        '--app-text-muted': '#5a5a6e',
        '--accent-primary': '#00f0ff',
        '--accent-secondary': '#ff00a0',
        '--accent-tertiary': '#b026ff',
        '--success': '#00f0ff',
        '--warning': '#ff00a0',
        '--danger': '#ff2a6d',
      }
    case 'deepspace':
      return {
        '--app-bg': '#0a0f1e',
        '--app-surface': '#0f172a',
        '--app-card': '#1e293b',
        '--app-card-hover': '#27354f',
        '--app-border': '#334155',
        '--app-border-accent': 'rgba(59, 130, 246, 0.3)',
        '--app-text': '#e2e8f0',
        '--app-text-secondary': '#94a3b8',
        '--app-text-muted': '#64748b',
        '--accent-primary': '#3b82f6',
        '--accent-secondary': '#8b5cf6',
        '--accent-tertiary': '#06b6d4',
        '--success': '#22c55e',
        '--warning': '#f59e0b',
        '--danger': '#ef4444',
      }
    case 'matrix':
      return {
        '--app-bg': '#060f0a',
        '--app-surface': '#0a1a0f',
        '--app-card': '#0f1f14',
        '--app-card-hover': '#142a1c',
        '--app-border': '#1a2e1f',
        '--app-border-accent': 'rgba(0, 255, 136, 0.25)',
        '--app-text': '#e8f0e8',
        '--app-text-secondary': '#7a8a7a',
        '--app-text-muted': '#4a5a4a',
        '--accent-primary': '#00ff88',
        '--accent-secondary': '#f59e0b',
        '--accent-tertiary': '#00d4aa',
        '--success': '#00ff88',
        '--warning': '#f59e0b',
        '--danger': '#ff4444',
      }
  }
}
