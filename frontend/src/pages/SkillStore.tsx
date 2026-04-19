import { useState, useEffect, useRef, useMemo } from 'react'
import { listSkills, searchSkills, installSkill, toggleSkill, deleteSkill, scanGitSkills, installGitSkills, uploadSkillZip, downloadSkillUrl, getAccessToken, getRecommendedSkills, installRecommendedSkill } from '../lib/api'
import type { Skill, SkillSearchResult, GitScanResult, RecommendedCategory } from '../lib/api'
import { Zap, Loader2, Search, Download, ExternalLink, Check, GitBranch, Upload, Trash2, ChevronLeft, ChevronRight, Tag, Filter, ArrowUpDown, X, ChevronDown, ChevronUp } from 'lucide-react'

type SourceFilter = 'all' | 'builtin' | 'local' | 'git' | 'marketplace'
type SortKey = 'name' | 'installedAt' | 'source'
type SortDir = 'asc' | 'desc'

interface UploadItem {
  id: string
  name: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress?: number
  error?: string
  skill?: Skill
}

export default function SkillStore() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  // Search state
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<SkillSearchResult[]>([])
  const [searched, setSearched] = useState(false)

  // Install state
  const [installing, setInstalling] = useState<string | null>(null)
  const [installed, setInstalled] = useState<Set<string>>(new Set())
  const [installError, setInstallError] = useState('')

  // Toggle state
  const [toggling, setToggling] = useState<string | null>(null)

  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null)

  // Batch upload state
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([])

  // Recommended skills state
  const [recCategories, setRecCategories] = useState<RecommendedCategory[]>([])
  const [recLoading, setRecLoading] = useState(true)
  const [recActiveTab, setRecActiveTab] = useState<string | null>(null)
  const [recInstalling, setRecInstalling] = useState<string | null>(null)
  const [recInstalled, setRecInstalled] = useState<Set<string>>(new Set())
  const scrollRef = useRef<HTMLDivElement>(null)

  // Git repo state
  const [gitUrl, setGitUrl] = useState('')
  const [gitScanning, setGitScanning] = useState(false)
  const [gitScanResult, setGitScanResult] = useState<GitScanResult | null>(null)
  const [gitSelected, setGitSelected] = useState<Set<string>>(new Set())
  const [gitInstalling, setGitInstalling] = useState(false)
  const [gitError, setGitError] = useState('')
  const [gitInstalled, setGitInstalled] = useState<Set<string>>(new Set())

  // Installed skills filter/sort
  const [installedSearch, setInstalledSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filterOpen, setFilterOpen] = useState(false)

  // Skill version switching
  const [versionMenuOpen, setVersionMenuOpen] = useState<string | null>(null)

  const refreshSkills = () => {
    listSkills().then(setSkills).catch(() => setSkills([]))
  }

  useEffect(() => {
    listSkills()
      .then(setSkills)
      .catch(() => setSkills([]))
      .finally(() => setLoading(false))

    getRecommendedSkills()
      .then(data => {
        setRecCategories(data.categories || [])
        if (data.categories?.length > 0) {
          setRecActiveTab(data.categories[0].id)
        }
      })
      .catch(() => setRecCategories([]))
      .finally(() => setRecLoading(false))
  }, [])

  // Batch upload handler
  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    e.target.value = ''

    const items: UploadItem[] = files.map((file, i) => ({
      id: `${Date.now()}-${i}`,
      name: file.name.replace(/\.zip$/i, ''),
      status: 'pending',
    }))

    setUploadQueue(prev => [...prev, ...items])

    for (const item of items) {
      const file = files.find(f => f.name.replace(/\.zip$/i, '') === item.name)
      if (file) await uploadSingle(item.id, file)
    }
  }

  const uploadSingle = async (id: string, file: File) => {
    setUploadQueue(prev =>
      prev.map(it => it.id === id ? { ...it, status: 'uploading', progress: 0 } : it)
    )

    try {
      const progressInterval = setInterval(() => {
        setUploadQueue(prev =>
          prev.map(it =>
            it.id === id && it.status === 'uploading'
              ? { ...it, progress: Math.min((it.progress || 0) + Math.random() * 30, 90) }
              : it
          )
        )
      }, 300)

      const skill = await uploadSkillZip(file)
      clearInterval(progressInterval)

      setUploadQueue(prev =>
        prev.map(it =>
          it.id === id ? { ...it, status: 'success', progress: 100, skill } : it
        )
      )
      refreshSkills()

      setTimeout(() => {
        setUploadQueue(prev => prev.filter(it => !(it.status === 'success' && it.id === id)))
      }, 5000)
    } catch (err: any) {
      setUploadQueue(prev =>
        prev.map(it =>
          it.id === id ? { ...it, status: 'error', error: err?.message || '上传失败' } : it
        )
      )
    }
  }

  const dismissUploadItem = (id: string) => {
    setUploadQueue(prev => prev.filter(it => it.id !== id))
  }

  const handleRecInstall = async (category: string, skillName: string) => {
    if (recInstalling) return
    setRecInstalling(skillName)
    setInstallError('')
    try {
      await installRecommendedSkill(category, skillName)
      setRecInstalled(prev => new Set(prev).add(skillName))
      refreshSkills()
    } catch (err: any) {
      setInstallError(err?.message || '安装失败')
    } finally {
      setRecInstalling(null)
    }
  }

  const scrollCategory = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = 300
    scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim() || searching) return
    setSearching(true)
    setSearched(true)
    setInstallError('')
    try {
      const data = await searchSkills(query.trim(), 10)
      setResults(data.results || [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleInstall = async (slug: string) => {
    if (installing) return
    setInstalling(slug)
    setInstallError('')
    try {
      await installSkill(slug)
      setInstalled(prev => new Set(prev).add(slug))
      refreshSkills()
    } catch (err: any) {
      setInstallError(err?.message || '安装失败')
    } finally {
      setInstalling(null)
    }
  }

  const handleToggle = async (skill: Skill) => {
    if (toggling) return
    const newEnabled = skill.disabled !== false
    setToggling(skill.name)
    try {
      await toggleSkill(skill.name, newEnabled)
      setSkills(prev =>
        prev.map(s =>
          s.name === skill.name ? { ...s, disabled: !newEnabled } : s
        )
      )
    } catch {
      refreshSkills()
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async (skill: Skill) => {
    if (deleting) return
    if (!window.confirm(`确定要删除技能「${skill.name}」吗？`)) return
    setDeleting(skill.name)
    setInstallError('')
    try {
      await deleteSkill(skill.name)
      setSkills(prev => prev.filter(s => s.name !== skill.name))
    } catch (err: any) {
      setInstallError(err?.message || `删除技能「${skill.name}」失败`)
    } finally {
      setDeleting(null)
    }
  }

  const handleDownload = async (name: string) => {
    const url = downloadSkillUrl(name)
    const token = getAccessToken()
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${name}.zip`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      setInstallError(`下载技能「${name}」失败`)
    }
  }

  const handleGitScan = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!gitUrl.trim() || gitScanning) return
    setGitScanning(true)
    setGitError('')
    setGitScanResult(null)
    setGitSelected(new Set())
    setGitInstalled(new Set())
    try {
      const result = await scanGitSkills(gitUrl.trim())
      setGitScanResult(result)
      setGitSelected(new Set(result.skills.map(s => s.name)))
    } catch (err: any) {
      setGitError(err?.message || '克隆仓库失败')
    } finally {
      setGitScanning(false)
    }
  }

  const toggleGitSkillSelect = (name: string) => {
    setGitSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleGitInstall = async () => {
    if (!gitScanResult || gitSelected.size === 0 || gitInstalling) return
    setGitInstalling(true)
    setGitError('')
    try {
      const result = await installGitSkills(gitScanResult.cacheKey, Array.from(gitSelected))
      if (result.installed.length > 0) {
        setGitInstalled(new Set(result.installed))
        refreshSkills()
      }
      if (result.errors.length > 0) {
        setGitError(result.errors.join('; '))
      }
    } catch (err: any) {
      setGitError(err?.message || '安装失败')
    } finally {
      setGitInstalling(false)
    }
  }

  // Filtered and sorted installed skills
  const filteredSkills = useMemo(() => {
    let filtered = [...skills]

    if (sourceFilter !== 'all') {
      filtered = filtered.filter(s => s.source === sourceFilter)
    }

    if (installedSearch.trim()) {
      const q = installedSearch.toLowerCase()
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q)
      )
    }

    filtered.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortKey === 'source') {
        cmp = (a.source || '').localeCompare(b.source || '')
      } else if (sortKey === 'installedAt') {
        cmp = (a.installedAt || '').localeCompare(b.installedAt || '')
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return filtered
  }, [skills, sourceFilter, installedSearch, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  const sourceLabels: Record<SourceFilter, string> = {
    all: '全部来源',
    builtin: '内置',
    local: '本地',
    git: 'Git',
    marketplace: '市场',
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-text">技能商店</h1>
          <p className="mt-1 text-sm text-dark-text-secondary">
            搜索并安装来自 <a href="https://skills.sh/" target="_blank" rel="noreferrer" className="text-accent-blue hover:underline">skills.sh</a> 的 AI 技能扩展
          </p>
        </div>
        <label className={`flex items-center gap-2 rounded-lg border border-dark-border px-4 py-2 text-sm text-dark-text-secondary hover:text-dark-text hover:border-accent-blue transition-colors cursor-pointer ${uploadQueue.some(u => u.status === 'uploading') ? 'opacity-50 pointer-events-none' : ''}`}>
          <Upload size={16} />
          批量上传 (.zip)
          <input
            type="file"
            accept=".zip"
            multiple
            onChange={handleBatchUpload}
            className="hidden"
            disabled={uploadQueue.some(u => u.status === 'uploading')}
          />
        </label>
      </div>

      {/* Batch upload queue */}
      {uploadQueue.length > 0 && (
        <div className="mb-4 space-y-2">
          {uploadQueue.map(item => (
            <div key={item.id} className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
              item.status === 'success' ? 'border-accent-green/30 bg-accent-green/5' :
              item.status === 'error' ? 'border-accent-red/30 bg-accent-red/5' :
              item.status === 'uploading' ? 'border-accent-blue/30 bg-accent-blue/5' :
              'border-dark-border bg-dark-card'
            }`}>
              {item.status === 'uploading' && (
                <Loader2 size={14} className="animate-spin shrink-0 text-accent-blue" />
              )}
              {item.status === 'success' && (
                <Check size={14} className="shrink-0 text-accent-green" />
              )}
              {item.status === 'error' && (
                <X size={14} className="shrink-0 text-accent-red" />
              )}
              {item.status === 'pending' && (
                <div className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-dark-border" />
              )}
              <div className="flex-1 min-w-0">
                <span className="text-dark-text font-medium truncate block">{item.name}</span>
                {item.status === 'uploading' && item.progress !== undefined && (
                  <div className="mt-1.5 h-1 w-full rounded-full bg-dark-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent-blue transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === 'error' && (
                  <span className="text-xs text-accent-red">{item.error}</span>
                )}
                {item.status === 'success' && (
                  <span className="text-xs text-accent-green">上传成功</span>
                )}
              </div>
              <button
                onClick={() => dismissUploadItem(item.id)}
                className="shrink-0 text-dark-text-secondary hover:text-dark-text"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search bar */}
      <form onSubmit={handleSearch} className="mb-6 flex gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-dark-border bg-dark-card px-4 py-2.5">
          <Search size={16} className="text-dark-text-secondary" />
          <input
            type="text"
            placeholder="搜索技能，例如：web scraping, react, testing..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-dark-text outline-none placeholder:text-dark-text-secondary"
          />
        </div>
        <button
          type="submit"
          disabled={searching || !query.trim()}
          className="flex items-center gap-2 rounded-lg bg-accent-blue px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-blue/90 disabled:opacity-50 transition-colors"
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          搜索
        </button>
      </form>

      {/* Recommended skills by category */}
      {recLoading ? (
        <div className="mb-6 flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-accent-blue" />
          <span className="ml-2 text-sm text-dark-text-secondary">加载推荐技能...</span>
        </div>
      ) : recCategories.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-base font-semibold text-dark-text flex items-center gap-2">
            <Tag size={16} className="text-accent-purple" />
            推荐技能
          </h2>

          <div className="relative mb-4">
            <button
              onClick={() => scrollCategory('left')}
              className="absolute left-0 top-0 z-10 flex h-full items-center bg-gradient-to-r from-dark-bg to-transparent pl-1 pr-3"
            >
              <ChevronLeft size={16} className="text-dark-text-secondary hover:text-dark-text" />
            </button>
            <div ref={scrollRef} className="flex gap-2 overflow-x-auto scrollbar-hide px-6">
              {recCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setRecActiveTab(cat.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-colors ${
                    recActiveTab === cat.id
                      ? 'bg-accent-blue text-white'
                      : 'bg-dark-card border border-dark-border text-dark-text-secondary hover:text-dark-text hover:border-accent-blue/30'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                  <span className="text-xs opacity-70">({cat.skills.length})</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => scrollCategory('right')}
              className="absolute right-0 top-0 z-10 flex h-full items-center bg-gradient-to-l from-dark-bg to-transparent pr-1 pl-3"
            >
              <ChevronRight size={16} className="text-dark-text-secondary hover:text-dark-text" />
            </button>
          </div>

          {recCategories.filter(c => c.id === recActiveTab).map(cat => (
            <p key={cat.id} className="mb-3 text-xs text-dark-text-secondary">{cat.description}</p>
          ))}

          {recCategories.filter(c => c.id === recActiveTab).map(cat => (
            <div key={cat.id} className="grid grid-cols-3 gap-3">
              {cat.skills.map(skill => {
                const isAlreadyInstalled = skills.some(s => s.name === skill.name)
                const justInstalled = recInstalled.has(skill.name)
                const isDone = isAlreadyInstalled || justInstalled
                const isInstalling = recInstalling === skill.name
                return (
                  <div
                    key={skill.name}
                    className={`rounded-xl border p-4 transition-colors ${
                      isDone
                        ? 'border-accent-green/30 bg-accent-green/5'
                        : 'border-dark-border bg-dark-card hover:border-accent-blue/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="text-sm font-semibold text-dark-text truncate flex-1">{skill.name}</h3>
                      <button
                        onClick={() => handleRecInstall(skill.category, skill.name)}
                        disabled={isDone || isInstalling}
                        className={`ml-2 flex shrink-0 items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                          isDone
                            ? 'bg-accent-green/10 text-accent-green'
                            : 'bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 disabled:opacity-50'
                        }`}
                      >
                        {isInstalling ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : isDone ? (
                          <><Check size={12} /> 已安装</>
                        ) : (
                          <><Download size={12} /> 安装</>
                        )}
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-dark-text-secondary leading-relaxed line-clamp-2">{skill.description}</p>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Git repo import */}
      <div className="mb-6 rounded-xl border border-dark-border bg-dark-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-dark-text">
          <GitBranch size={16} className="text-accent-purple" />
          从 Git 仓库导入技能
        </h2>
        <form onSubmit={handleGitScan} className="flex gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-dark-border bg-dark-bg px-4 py-2.5">
            <GitBranch size={14} className="text-dark-text-secondary" />
            <input
              type="text"
              placeholder="输入 Git 仓库地址，如 https://github.com/user/repo.git 或 git@github.com:user/repo.git"
              value={gitUrl}
              onChange={e => setGitUrl(e.target.value)}
              className="flex-1 bg-transparent text-sm text-dark-text outline-none placeholder:text-dark-text-secondary"
            />
          </div>
          <button
            type="submit"
            disabled={gitScanning || !gitUrl.trim()}
            className="flex items-center gap-2 rounded-lg bg-accent-purple px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-purple/90 disabled:opacity-50 transition-colors"
          >
            {gitScanning ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            扫描
          </button>
        </form>

        {gitError && (
          <div className="mt-3 rounded-lg bg-accent-red/10 p-3 text-sm text-accent-red">
            {gitError}
          </div>
        )}

        {gitScanResult && (
          <div className="mt-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-dark-text-secondary">
                仓库 <span className="font-medium text-dark-text">{gitScanResult.repoName}</span> 中发现 {gitScanResult.skills.length} 个技能
              </span>
              {gitScanResult.skills.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (gitSelected.size === gitScanResult.skills.length) {
                        setGitSelected(new Set())
                      } else {
                        setGitSelected(new Set(gitScanResult.skills.map(s => s.name)))
                      }
                    }}
                    className="text-xs text-accent-blue hover:underline"
                  >
                    {gitSelected.size === gitScanResult.skills.length ? '取消全选' : '全选'}
                  </button>
                  <button
                    onClick={handleGitInstall}
                    disabled={gitInstalling || gitSelected.size === 0}
                    className="flex items-center gap-1.5 rounded-lg bg-accent-green px-4 py-1.5 text-xs font-medium text-white hover:bg-accent-green/90 disabled:opacity-50 transition-colors"
                  >
                    {gitInstalling ? (
                      <><Loader2 size={13} className="animate-spin" /> 安装中...</>
                    ) : (
                      <><Download size={13} /> 安装选中 ({gitSelected.size})</>
                    )}
                  </button>
                </div>
              )}
            </div>

            {gitScanResult.skills.length === 0 ? (
              <div className="rounded-lg border border-dark-border bg-dark-bg p-4 text-center text-sm text-dark-text-secondary">
                该仓库中未找到技能（需要包含 SKILL.md 文件的目录）
              </div>
            ) : (
              <div className="space-y-1.5">
                {gitScanResult.skills.map(skill => {
                  const isSelected = gitSelected.has(skill.name)
                  const isDone = gitInstalled.has(skill.name)
                  return (
                    <div
                      key={skill.name}
                      onClick={() => !isDone && toggleGitSkillSelect(skill.name)}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                        isDone
                          ? 'border-accent-green/30 bg-accent-green/5'
                          : isSelected
                            ? 'border-accent-purple/40 bg-accent-purple/5'
                            : 'border-dark-border bg-dark-bg hover:border-dark-border/80'
                      }`}
                    >
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                        isDone
                          ? 'border-accent-green bg-accent-green text-white'
                          : isSelected
                            ? 'border-accent-purple bg-accent-purple text-white'
                            : 'border-dark-border'
                      }`}>
                        {(isSelected || isDone) && <Check size={12} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-dark-text">{skill.name}</span>
                          <span className="text-xs text-dark-text-secondary">{skill.relativePath}</span>
                        </div>
                        {skill.description && (
                          <p className="mt-0.5 text-xs text-dark-text-secondary truncate">{skill.description}</p>
                        )}
                      </div>
                      {isDone && (
                        <span className="shrink-0 text-xs font-medium text-accent-green">已安装</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {installError && (
        <div className="mb-4 rounded-lg bg-accent-red/10 p-3 text-sm text-accent-red">
          {installError}
        </div>
      )}

      {/* Search results */}
      {searched && (
        <div className="mb-8">
          <h2 className="mb-3 text-base font-semibold text-dark-text">
            搜索结果
            {results.length > 0 && <span className="ml-2 text-sm font-normal text-dark-text-secondary">({results.length} 个技能)</span>}
          </h2>
          {searching ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-accent-blue" />
              <span className="ml-3 text-sm text-dark-text-secondary">正在搜索...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-xl border border-dark-border bg-dark-card p-8 text-center text-sm text-dark-text-secondary">
              未找到相关技能，请尝试其他关键词
            </div>
          ) : (
            <div className="space-y-2">
              {results.map(r => {
                const isInstalled = installed.has(r.slug)
                const isInstalling = installing === r.slug
                return (
                  <div key={r.slug} className="flex items-center justify-between rounded-xl border border-dark-border bg-dark-card px-5 py-3.5 hover:border-accent-blue/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-dark-text truncate">{r.slug}</span>
                        <span className="shrink-0 rounded bg-dark-bg px-2 py-0.5 text-xs text-dark-text-secondary">{r.installs}</span>
                      </div>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 flex items-center gap-1 text-xs text-accent-blue/70 hover:text-accent-blue truncate"
                      >
                        <ExternalLink size={11} />
                        {r.url}
                      </a>
                    </div>
                    <button
                      onClick={() => handleInstall(r.slug)}
                      disabled={isInstalling || isInstalled}
                      className={`ml-4 flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
                        isInstalled
                          ? 'bg-accent-green/10 text-accent-green'
                          : 'bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20 disabled:opacity-50'
                      }`}
                    >
                      {isInstalling ? (
                        <><Loader2 size={13} className="animate-spin" /> 安装中...</>
                      ) : isInstalled ? (
                        <><Check size={13} /> 已安装</>
                      ) : (
                        <><Download size={13} /> 安装</>
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Installed skills */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-dark-text">
            已安装技能
            {skills.length > 0 && (
              <span className="ml-2 text-sm font-normal text-dark-text-secondary">
                ({filteredSkills.length}/{skills.length})
              </span>
            )}
          </h2>

          {/* Filter/sort controls */}
          <div className="flex items-center gap-2">
            {/* Search within installed */}
            <div className="flex items-center gap-1.5 rounded-lg border border-dark-border bg-dark-card px-3 py-1.5">
              <Search size={13} className="text-dark-text-secondary shrink-0" />
              <input
                type="text"
                placeholder="搜索已安装..."
                value={installedSearch}
                onChange={e => setInstalledSearch(e.target.value)}
                className="w-36 bg-transparent text-xs text-dark-text outline-none placeholder:text-dark-text-secondary"
              />
              {installedSearch && (
                <button onClick={() => setInstalledSearch('')} className="text-dark-text-secondary hover:text-dark-text">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Source filter dropdown */}
            <div className="relative">
              <button
                onClick={() => setFilterOpen(f => !f)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                  sourceFilter !== 'all'
                    ? 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue'
                    : 'border-dark-border bg-dark-card text-dark-text-secondary hover:text-dark-text hover:border-dark-border/80'
                }`}
              >
                <Filter size={12} />
                {sourceLabels[sourceFilter]}
                {sourceFilter !== 'all' && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setSourceFilter('all') }}
                    className="ml-0.5 hover:text-dark-text"
                  >
                    ×
                  </button>
                )}
              </button>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 rounded-lg border border-dark-border bg-dark-card shadow-xl py-1 min-w-[120px]">
                    {(['all', 'builtin', 'local', 'git', 'marketplace'] as SourceFilter[]).map(src => (
                      <button
                        key={src}
                        onClick={() => { setSourceFilter(src); setFilterOpen(false) }}
                        className={`w-full px-3 py-1.5 text-xs text-left hover:bg-dark-bg transition-colors ${
                          sourceFilter === src ? 'text-accent-blue font-medium' : 'text-dark-text-secondary'
                        }`}
                      >
                        {sourceLabels[src]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Sort by name */}
            <button
              onClick={() => toggleSort('name')}
              className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                sortKey === 'name'
                  ? 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue'
                  : 'border-dark-border bg-dark-card text-dark-text-secondary hover:text-dark-text'
              }`}
              title="按名称排序"
            >
              <ArrowUpDown size={12} />
              名称
              {sortKey === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>

            {/* Sort by time */}
            <button
              onClick={() => toggleSort('installedAt')}
              className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                sortKey === 'installedAt'
                  ? 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue'
                  : 'border-dark-border bg-dark-card text-dark-text-secondary hover:text-dark-text'
              }`}
              title="按安装时间排序"
            >
              <ArrowUpDown size={12} />
              时间
              {sortKey === 'installedAt' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-accent-blue" />
          </div>
        ) : skills.length === 0 ? (
          <div className="rounded-xl border border-dark-border bg-dark-card p-8 text-center text-sm text-dark-text-secondary">
            暂无已安装技能，使用上方搜索栏查找并安装
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="rounded-xl border border-dark-border bg-dark-card p-8 text-center text-sm text-dark-text-secondary">
            没有匹配的技能，试试调整筛选条件
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filteredSkills.map(skill => {
              const isDisabled = skill.disabled === true
              const isToggling = toggling === skill.name
              const hasVersions = (skill.versions?.length || 0) > 1
              const isVersionMenuOpen = versionMenuOpen === skill.name

              return (
                <div
                  key={skill.name}
                  className={`rounded-xl border bg-dark-card p-5 transition-colors ${
                    isDisabled
                      ? 'border-dark-border/50 opacity-60'
                      : 'border-dark-border hover:border-accent-blue/30'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-yellow/10">
                      <Zap size={20} className={isDisabled ? 'text-dark-text-secondary' : 'text-accent-yellow'} />
                    </div>
                    {/* Toggle switch */}
                    <button
                      onClick={() => handleToggle(skill)}
                      disabled={isToggling}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                        isDisabled ? 'bg-dark-border' : 'bg-accent-green'
                      } ${isToggling ? 'opacity-50' : 'cursor-pointer'}`}
                      title={isDisabled ? '点击启用' : '点击禁用'}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                          isDisabled ? 'translate-x-0.5' : 'translate-x-[18px]'
                        }`}
                      />
                    </button>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-dark-text">{skill.name}</h3>
                  <p className="mt-1 text-xs text-dark-text-secondary leading-relaxed line-clamp-2">{skill.description}</p>

                  {/* Metadata row */}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {skill.source && (
                      <span className="text-xs text-dark-text-secondary bg-dark-bg px-1.5 py-0.5 rounded">
                        {skill.source}
                      </span>
                    )}
                    {skill.version && (
                      <span className="text-xs text-dark-text-secondary bg-dark-bg px-1.5 py-0.5 rounded">
                        v{skill.version}
                      </span>
                    )}
                    {formatDate(skill.installedAt) && (
                      <span className="text-xs text-dark-text-secondary">
                        安装于 {formatDate(skill.installedAt)}
                      </span>
                    )}
                    {isDisabled && (
                      <span className="text-xs text-accent-yellow">已禁用</span>
                    )}
                  </div>

                  {/* Version switching */}
                  {hasVersions && (
                    <div className="mt-3 relative">
                      <button
                        onClick={() => setVersionMenuOpen(isVersionMenuOpen ? null : skill.name)}
                        className="flex items-center gap-1 text-xs text-accent-blue hover:underline"
                      >
                        <ChevronDown size={12} />
                        {skill.versions?.find(v => v.isActive)?.version || '版本'}
                        {skill.versions && skill.versions.length > 1 && ` (${skill.versions.length})`}
                      </button>
                      {isVersionMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setVersionMenuOpen(null)} />
                          <div className="absolute left-0 top-full mt-1 z-20 rounded-lg border border-dark-border bg-dark-card shadow-xl py-1 min-w-[140px]">
                            {skill.versions?.map(v => (
                              <div
                                key={v.version}
                                className={`flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
                                  v.isActive
                                                            ? 'text-accent-blue font-medium'
                                                            : 'text-dark-text-secondary hover:bg-dark-bg hover:text-dark-text'
                                }`}
                              >
                                <span>v{v.version}</span>
                                <span className="text-dark-text-secondary">
                                  {formatDate(v.installedAt) || ''}
                                  {v.isActive && <Check size={10} className="inline ml-1 text-accent-green" />}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Action row */}
                  <div className="mt-3 flex items-center justify-between">
                    <div />
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDownload(skill.name)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-dark-text-secondary hover:text-accent-blue hover:bg-accent-blue/10 transition-colors"
                        title={`下载 ${skill.name}.zip`}
                      >
                        <Download size={12} />
                        下载
                      </button>
                      {skill.source !== 'builtin' && (
                        <button
                          onClick={() => handleDelete(skill)}
                          disabled={deleting === skill.name}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-dark-text-secondary hover:text-accent-red hover:bg-accent-red/10 transition-colors disabled:opacity-50"
                          title={`删除 ${skill.name}`}
                        >
                          {deleting === skill.name ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          删除
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
