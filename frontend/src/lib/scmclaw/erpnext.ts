/**
 * SCMClaw ERPNext 前端 API 模块
 *
 * ERPNext URL 默认值通过 Vite 构建时环境变量 VITE_ERPNEXT_URL 注入（来自 .env），
 * 用户可在设置页面中覆盖并保存到 localStorage。
 * App ID/Secret 存储在浏览器 localStorage 中。
 * 前端直接向 ERPNext 发送请求，后端不参与凭证传递。
 *
 * 安全提示：App Secret 存在浏览器 localStorage 中，建议用户仅在内网环境使用。
 */

const STORAGE_KEYS = {
  erpnextUrl: 'scmclaw_erpnext_url',
  appId: 'scmclaw_erpnext_app_id',
  appSecret: 'scmclaw_erpnext_app_secret',
} as const

// VITE_ERPNEXT_URL 在构建时注入，可通过 .env 配置
// 默认值与 docker-compose.erpnext.yml 中 ${ERPNEXT_PORT:-8000} 保持一致
const DEFAULT_ERPNEXT_URL = import.meta.env.VITE_ERPNEXT_URL || 'http://localhost:8000'

export function getDefaultErpnextUrl(): string {
  return DEFAULT_ERPNEXT_URL
}

export function getErpnextUrl(): string {
  const stored = localStorage.getItem(STORAGE_KEYS.erpnextUrl)
  if (stored) return stored
  return getDefaultErpnextUrl()
}

export function setErpnextUrl(url: string): void {
  localStorage.setItem(STORAGE_KEYS.erpnextUrl, url)
}

export function getAppId(): string {
  return localStorage.getItem(STORAGE_KEYS.appId) || ''
}

export function setAppId(value: string): void {
  localStorage.setItem(STORAGE_KEYS.appId, value)
}

export function getAppSecret(): string {
  return localStorage.getItem(STORAGE_KEYS.appSecret) || ''
}

export function setAppSecret(value: string): void {
  localStorage.setItem(STORAGE_KEYS.appSecret, value)
}

export function clearErpnextCredentials(): void {
  localStorage.removeItem(STORAGE_KEYS.appId)
  localStorage.removeItem(STORAGE_KEYS.appSecret)
}

export function maskSecret(secret: string): string {
  if (!secret) return ''
  return secret.slice(0, 4) + '****'
}

/** 检测 localStorage 中是否已配置 ERPNext 凭证 */
export function hasCredentials(): boolean {
  return Boolean(getAppId() && getAppSecret())
}

/** 测试 ERPNext 连接（直接调用 ERPNext REST API） */
export async function checkErpnextConnection(): Promise<{
  ok: boolean
  message: string
}> {
  const url = getErpnextUrl()
  const appId = getAppId()
  const secret = getAppSecret()

  if (!appId || !secret) {
    return { ok: false, message: '未配置 App ID 或 App Secret' }
  }

  try {
    const resp = await fetch(`${url}/api/resource/User`, {
      headers: {
        Authorization: `token ${appId}:${secret}`,
        'Content-Type': 'application/json',
      },
    })
    if (resp.ok) {
      return { ok: true, message: '连接成功' }
    }
    const body = await resp.json().catch(() => ({}))
    return { ok: false, message: body.exception || `HTTP ${resp.status}` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: `连接失败: ${msg}` }
  }
}
