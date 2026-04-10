/**
 * SCMClaw 自定义导航配置
 *
 * 本文件定义 scmclaw 相对于上游 MultiUserClaw 新增的侧边栏菜单项。
 *
 * 上游升级时的保护措施：
 *   - 本文件位于 frontend/src/lib/scmclaw/ 目录下，该目录在 upgrade_frontend.py 中会被跳过同步
 *   - 合并上游 App.tsx 和 Sidebar.tsx 时，只需保留以下两处改动即可恢复 scmclaw 菜单：
 *     1. App.tsx: import ErpnextSettings from './pages/scmclaw/ErpnextSettings'
 *     2. App.tsx: <Route path="erpnext" element={<ErpnextSettings />} />
 *     3. Sidebar.tsx: import { scmclawNavSections } from '../lib/scmclaw/nav-items'
 *     4. Sidebar.tsx: 在 navSections 后追加 ...scmclawNavSections
 */

import {
  Settings2,
} from 'lucide-react'

export interface NavItem {
  to: string
  icon: React.ComponentType<{ size?: number }>
  label: string
  badgeKey?: string
  external?: boolean  // true = 在新标签页打开
}

export interface NavSection {
  label: string
  items: NavItem[]
}

/**
 * SCMClaw 扩展的导航区块。
 * 追加到 Sidebar 的 navSections 之后。
 */
export const scmclawNavSections: NavSection[] = [
  {
    label: 'ERPNext',
    items: [
      { to: '/erpnext', icon: Settings2, label: '设置' },
    ],
  },
]
