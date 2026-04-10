import { useState, useEffect } from 'react'
import {
  Loader2,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  Globe,
  ExternalLink,
} from 'lucide-react'
import {
  getErpnextUrl,
  setErpnextUrl,
  getAppId,
  setAppId,
  getAppSecret,
  setAppSecret,
  checkErpnextConnection,
  maskSecret,
} from '../../lib/scmclaw/erpnext'

export default function ErpnextSettings() {
  const [erpnextUrl, setUrl] = useState('')
  const [appId, setAppIdVal] = useState('')
  const [appSecret, setAppSecretVal] = useState('')
  const [savedAppId, setSavedAppId] = useState('')
  const [savedAppSecret, setSavedAppSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const load = () => {
    setLoading(true)
    setUrl(getErpnextUrl())
    setAppIdVal(getAppId())
    setAppSecretVal(getAppSecret())
    setSavedAppId(getAppId())
    setSavedAppSecret(getAppSecret())
    setConnected(null)
    setMessage('')
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const flash = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const handleSave = () => {
    setSaving(true)
    setMessage('')
    setErpnextUrl(erpnextUrl.trim())
    setAppId(appId.trim())
    setAppSecret(appSecret)
    setSavedAppId(appId.trim())
    setSavedAppSecret(appSecret)
    flash('设置已保存')
    setSaving(false)
  }

  const handleCheck = async () => {
    // 先保存当前值
    setErpnextUrl(erpnextUrl.trim())
    setAppId(appId.trim())
    setAppSecret(appSecret)

    setChecking(true)
    setConnected(null)
    setMessage('')
    const result = await checkErpnextConnection()
    setConnected(result.ok)
    setMessage(result.message)
    setChecking(false)
  }

  const handleClearCredentials = () => {
    setAppIdVal('')
    setAppSecretVal('')
    setConnected(null)
    setMessage('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-accent-blue" />
      </div>
    )
  }

  const hasChanges =
    erpnextUrl !== getErpnextUrl() ||
    appId !== savedAppId ||
    appSecret !== savedAppSecret

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">ERPNext 设置</h1>
          <p className="mt-1 text-sm text-dark-text-secondary">
            配置 ERPNext 连接信息和 API 凭证
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-dark-border px-3 py-1.5 text-xs text-dark-text-secondary hover:text-dark-text transition-colors"
        >
          <RefreshCw size={14} />
          刷新
        </button>
      </div>

      {message && (
        <div className={`mb-4 rounded-lg p-3 text-sm flex items-center gap-2 ${
          connected ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-red/10 text-accent-red'
        }`}>
          {connected ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {message}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 rounded-lg bg-accent-green/10 p-3 text-sm text-accent-green flex items-center gap-2">
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}

      <div className="space-y-6 max-w-2xl">

        {/* ERPNext 地址 */}
        <section className="rounded-xl border border-dark-border bg-dark-card overflow-hidden">
          <div className="px-5 py-3 border-b border-dark-border flex items-center gap-2">
            <Globe size={16} className="text-dark-text-secondary" />
            <h2 className="text-sm font-semibold text-dark-text">ERPNext 地址</h2>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-dark-text-secondary mb-1">
                服务地址
              </label>
              <input
                type="url"
                value={erpnextUrl}
                onChange={e => setUrl(e.target.value)}
                placeholder="http://localhost:8000"
                autoComplete="off"
                className="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-dark-text outline-none focus:border-accent-blue"
              />
              <p className="mt-1 text-[11px] text-dark-text-secondary">
                ERPNext 服务的 URL 地址，通常为 http://localhost:8000
              </p>
            </div>
            <a
              href={erpnextUrl || 'http://localhost:8000'}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-accent-blue hover:text-accent-blue/80 transition-colors"
            >
              <ExternalLink size={12} />
              在新标签页打开 ERPNext
            </a>
          </div>
        </section>

        {/* API 凭证 */}
        <section className="rounded-xl border border-dark-border bg-dark-card overflow-hidden">
          <div className="px-5 py-3 border-b border-dark-border flex items-center gap-2">
            <Shield size={16} className="text-dark-text-secondary" />
            <h2 className="text-sm font-semibold text-dark-text">API 凭证</h2>
          </div>
          <div className="px-5 py-4 space-y-4">
            <p className="text-xs text-dark-text-secondary">
              在 ERPNext 中获取：登录后进入「个人设置 → API Access」，生成 API Key 和 Secret。
            </p>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium text-dark-text-secondary mb-1">
                  App ID（API Key）
                </label>
                <input
                  type="text"
                  value={appId}
                  onChange={e => setAppIdVal(e.target.value)}
                  placeholder="请输入 ERPNext API Key"
                  autoComplete="off"
                  className="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-dark-text outline-none focus:border-accent-blue"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-dark-text-secondary mb-1">
                  App Secret（API Secret）
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={appSecret}
                    onChange={e => setAppSecretVal(e.target.value)}
                    placeholder="请输入 ERPNext API Secret"
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 pr-9 text-sm text-dark-text outline-none focus:border-accent-blue"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-dark-text-secondary hover:text-dark-text"
                  >
                    {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>

            {savedAppId && (
              <div className="rounded-lg bg-dark-bg p-3 border border-dark-border">
                <div className="text-xs text-dark-text-secondary mb-1">当前已保存的凭证</div>
                <div className="grid grid-cols-[100px_1fr] gap-y-1 text-xs font-mono">
                  <span className="text-dark-text-secondary">App ID</span>
                  <span className="text-dark-text">{savedAppId}</span>
                  <span className="text-dark-text-secondary">App Secret</span>
                  <span className="text-dark-text">{maskSecret(savedAppSecret) || '(空)'}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleCheck}
                disabled={checking || !appId || !appSecret}
                className="flex items-center gap-2 rounded-lg border border-dark-border px-4 py-2 text-sm text-dark-text hover:border-accent-blue hover:text-accent-blue transition-colors disabled:opacity-50"
              >
                {checking ? <Loader2 size={14} className="animate-spin" /> : null}
                {checking ? '测试中...' : '测试连接'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                保存设置
              </button>
              {savedAppId && (
                <button
                  onClick={handleClearCredentials}
                  className="rounded-lg border border-dark-border px-4 py-2 text-sm text-accent-red hover:border-accent-red hover:bg-accent-red/5 transition-colors"
                >
                  清除凭证
                </button>
              )}
            </div>

            {connected === true && (
              <div className="flex items-center gap-2 text-xs text-accent-green">
                <span className="inline-block w-2 h-2 rounded-full bg-accent-green" />
                已连接
              </div>
            )}
            {connected === false && (
              <div className="flex items-center gap-2 text-xs text-accent-red">
                <span className="inline-block w-2 h-2 rounded-full bg-accent-red" />
                未连接，请检查地址和凭证是否正确
              </div>
            )}
          </div>
        </section>

        {/* 安全提示 */}
        <section className="rounded-xl border border-dark-border bg-dark-card overflow-hidden">
          <div className="px-5 py-3 border-b border-dark-border flex items-center gap-2">
            <Shield size={16} className="text-dark-text-secondary" />
            <h2 className="text-sm font-semibold text-dark-text">安全说明</h2>
          </div>
          <div className="px-5 py-4">
            <ul className="space-y-1.5 text-xs text-dark-text-secondary">
              <li className="flex items-start gap-2">
                <span className="text-accent-yellow mt-0.5">&#9679;</span>
                App Secret 存储在浏览器 localStorage 中，仅推荐在内网环境使用
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-yellow mt-0.5">&#9679;</span>
                请勿在公共或共享电脑上保存 ERPNext 凭证
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent-yellow mt-0.5">&#9679;</span>
                ERPNext 地址在部署时通过 .env 配置，所有用户共享同一个 ERPNext 实例
              </li>
            </ul>
          </div>
        </section>

      </div>
    </div>
  )
}
