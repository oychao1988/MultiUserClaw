// SCMCLAW-MOD: 新增 ERPNext 设置页面 (2026-04-10)
// 上游无此文件，纯 SCMClaw 自有页面，不影响上游合并

import { useState, useEffect } from 'react'
import {
  ExternalLink,
  Save,
  Eye,
  EyeOff,
  CheckCircle,
} from 'lucide-react'

const STORAGE_KEY_API_KEY = 'erpnext_api_key'
const STORAGE_KEY_API_SECRET = 'erpnext_api_secret'

export default function ErpNextSettings() {
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    setApiKey(localStorage.getItem(STORAGE_KEY_API_KEY) || '')
    setApiSecret(localStorage.getItem(STORAGE_KEY_API_SECRET) || '')
  }, [])

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY_API_KEY, apiKey)
    localStorage.setItem(STORAGE_KEY_API_SECRET, apiSecret)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const erpnextUrl = `${window.location.protocol}//${window.location.hostname}:8081`

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-dark-text">ERPNext 设置</h1>

      {/* ERPNext 主页跳转 */}
      <div className="rounded-xl border border-dark-border bg-dark-card p-5">
        <h2 className="text-sm font-medium text-dark-text mb-3">ERPNext 主页</h2>
        <p className="text-xs text-dark-text-secondary mb-4">
          点击按钮在新标签页中打开 ERPNext 系统主页。
        </p>
        <a
          href={erpnextUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/90 transition-colors"
        >
          <ExternalLink size={16} />
          跳转到 ERPNext
        </a>
      </div>

      {/* API 凭证 */}
      <div className="rounded-xl border border-dark-border bg-dark-card p-5">
        <h2 className="text-sm font-medium text-dark-text mb-3">API 凭证</h2>
        <p className="text-xs text-dark-text-secondary mb-4">
          填写 ERPNext 用户的 API Key 和 API Secret，用于 SCMClaw 与 ERPNext 的数据集成。
          凭证保存在浏览器本地，不会上传到服务器。
        </p>

        <div className="space-y-4">
          {/* API Key */}
          <div>
            <label className="block text-xs text-dark-text-secondary mb-1">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-dark-text focus:border-accent-blue focus:outline-none"
              placeholder="例如: c5f2c8e9a1b3d4f5"
            />
          </div>

          {/* API Secret */}
          <div>
            <label className="block text-xs text-dark-text-secondary mb-1">API Secret</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={e => setApiSecret(e.target.value)}
                className="w-full rounded-lg border border-dark-border bg-dark-bg px-3 py-2 pr-9 text-sm text-dark-text focus:border-accent-blue focus:outline-none"
                placeholder="例如: a1b2c3d4e5f6g7h8i9j0"
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

          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/90 transition-colors"
            >
              <Save size={16} />
              保存
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1 text-xs text-green-400">
                <CheckCircle size={14} />
                已保存
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
