import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Loader2 } from 'lucide-react'
import { login, register } from '../lib/api.ts'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    if (mode === 'register' && !email.trim()) return
    
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        await login(username.trim(), password)
      } else {
        await register(username.trim(), email.trim(), password)
      }
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-light-bg via-slate-50 to-blue-50">
      <div className="w-full max-w-md p-6">
        {/* Logo 和标题 */}
        <div className="mb-8 flex flex-col items-center gap-3 animate-fade-in">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-blue to-blue-600 shadow-lg shadow-blue-500/25">
            <Bot className="h-7 w-7 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-light-text">OpenClaw Lite</h1>
            <p className="text-sm text-light-text-secondary mt-1">智能助手平台</p>
          </div>
        </div>

        {/* 登录卡片 */}
        <div className="rounded-2xl bg-light-card border border-light-border p-6 shadow-xl shadow-slate-200/50 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-lg font-semibold text-light-text text-center mb-6">
            {mode === 'login' ? '欢迎回来' : '创建账号'}
          </h2>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg bg-accent-red/10 p-3 text-sm text-accent-red flex items-center gap-2">
              <span className="text-base">⚠️</span>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-light-text-secondary mb-1.5">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full rounded-lg border border-light-border bg-light-bg px-4 py-2.5 text-sm text-light-text outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all"
                placeholder="请输入用户名"
              />
            </div>

            {mode === 'register' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-medium text-light-text-secondary mb-1.5">邮箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-light-border bg-light-bg px-4 py-2.5 text-sm text-light-text outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all"
                  placeholder="请输入邮箱"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-light-text-secondary mb-1.5">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-light-border bg-light-bg px-4 py-2.5 text-sm text-light-text outline-none focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/20 transition-all"
                placeholder="请输入密码"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !username.trim() || !password || (mode === 'register' && !email.trim())}
              className="w-full rounded-lg bg-gradient-to-r from-accent-blue to-blue-600 py-2.5 text-sm font-medium text-white hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-blue-500/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === 'login' ? '登录中...' : '注册中...'}
                </>
              ) : (
                mode === 'login' ? '登录' : '注册'
              )}
            </button>
          </form>

          {/* Toggle */}
          <p className="mt-6 text-center text-sm text-light-text-secondary">
            {mode === 'login' ? (
              <>
                还没有账号？{' '}
                <button
                  type="button"
                  onClick={() => { setMode('register'); setError('') }}
                  className="font-medium text-accent-blue hover:text-blue-700 transition-colors"
                >
                  立即注册
                </button>
              </>
            ) : (
              <>
                已有账号？{' '}
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError('') }}
                  className="font-medium text-accent-blue hover:text-blue-700 transition-colors"
                >
                  立即登录
                </button>
              </>
            )}
          </p>
        </div>

        {/* 底部说明 */}
        <p className="mt-6 text-center text-xs text-light-text-secondary">
          登录即表示同意我们的服务条款
        </p>
      </div>
    </div>
  )
}