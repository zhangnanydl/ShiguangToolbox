import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  AppWindow, Box, BriefcaseBusiness, ChevronDown, CircleAlert, Clock3, Code2,
  Database, Download, Edit3, File, Folder, FolderOpen, Gamepad2, Globe2,
  GripVertical, Grid2X2, Heart, Keyboard, List, Minus, MonitorCog,
  MoreHorizontal, Palette, Play, Plus, Power, RefreshCw, Search, Settings,
  ShieldCheck, Sparkles, Star, Terminal, Trash2, Upload, UploadCloud, Wrench, X,
} from 'lucide-react'
import { api } from './bridge'

const iconMap = {
  box: Box, terminal: Terminal, shield: ShieldCheck, palette: Palette, settings: Settings,
  code: Code2, globe: Globe2, wrench: Wrench, game: Gamepad2, sparkles: Sparkles,
  database: Database, briefcase: BriefcaseBusiness, folder: Folder,
}
const categoryIcons = [
  ['box', '通用'], ['folder', '文件'], ['terminal', '终端'], ['code', '开发'],
  ['shield', '安全'], ['globe', '网络'], ['wrench', '工具'], ['palette', '设计'],
  ['database', '数据'], ['briefcase', '办公'], ['game', '游戏'], ['sparkles', '其他'],
]
const typeColors = ['#168cff', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4']
const toolIconPresets = [
  ['terminal', '终端', Terminal, '#2563eb'],
  ['folder', '文件夹', Folder, '#f59e0b'],
  ['browser', '网络', Globe2, '#0ea5e9'],
  ['code', '开发', Code2, '#7c3aed'],
  ['security', '安全', ShieldCheck, '#f97316'],
  ['office', '办公', BriefcaseBusiness, '#ef4444'],
  ['media', '影音', Play, '#ec4899'],
  ['system', '系统', MonitorCog, '#64748b'],
  ['utility', '工具', Wrench, '#14b8a6'],
]
const toolIconPresetMap = Object.fromEntries(toolIconPresets.map(([id, label, Icon, color]) => [id, { label, Icon, color }]))

function shortcutFromEvent(event) {
  if (event.key === 'Backspace' || event.key === 'Delete' || event.key === 'Escape') return ''
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return null
  const modifiers = []
  if (event.ctrlKey) modifiers.push('Ctrl')
  if (event.altKey) modifiers.push('Alt')
  if (event.shiftKey) modifiers.push('Shift')
  if (!modifiers.length) return null
  let key = event.key.length === 1 ? event.key.toUpperCase() : event.key
  if (key === ' ') key = 'Space'
  if (/^Arrow/.test(key)) key = key.replace('Arrow', '')
  return [...modifiers, key].join('+')
}

function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark"><BriefcaseBusiness size={23} /></span>
      <span>拾光工具箱</span>
    </div>
  )
}

function ShortcutKeys({ value }) {
  const parts = String(value || 'Alt+X').split('+').filter(Boolean)
  return <div className="key-combo">{parts.map((part, index) => <span key={`${part}-${index}`}>{index ? <i>+</i> : null}<kbd>{part}</kbd></span>)}</div>
}

function NavItem({ active, icon: Icon, label, count, onClick }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} title={label} onClick={onClick}>
      <Icon size={20} strokeWidth={1.9} />
      <span>{label}</span>
      {count ? <small>{count}</small> : null}
    </button>
  )
}

function Sidebar({ categories, invalidCount, launcherShortcut, selection, setSelection, onAddCategory, onEditCategory, onReorderCategory, onSettings }) {
  return (
    <aside className="sidebar">
      <Logo />
      <nav className="primary-nav" aria-label="主要导航">
        <NavItem active={selection === 'all'} icon={Grid2X2} label="全部工具" onClick={() => setSelection('all')} />
        <NavItem active={selection === 'favorites'} icon={Heart} label="常用" onClick={() => setSelection('favorites')} />
        <NavItem active={selection === 'recent'} icon={Clock3} label="最近使用" onClick={() => setSelection('recent')} />
        <NavItem active={selection === 'invalid'} icon={CircleAlert} label="失效工具" count={invalidCount} onClick={() => setSelection('invalid')} />
      </nav>
      <div className="sidebar-divider" />
      <div className="category-head"><span>分类</span><button title="新建分类" onClick={onAddCategory}><Plus size={17} /></button></div>
      <nav className="category-list" aria-label="工具分类">
        {categories.map((category) => {
          const Icon = iconMap[category.icon] || Box
          return <div className="category-item" key={category.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-toolbox-category', category.id) }} onDragOver={(event) => { if (event.dataTransfer.types.includes('application/x-toolbox-category')) event.preventDefault() }} onDrop={(event) => { const sourceId = event.dataTransfer.getData('application/x-toolbox-category'); if (sourceId) { event.preventDefault(); onReorderCategory(sourceId, category.id) } }}><NavItem active={selection === category.id} icon={Icon} label={category.name} onClick={() => setSelection(category.id)} /><button className="category-config" draggable="false" title={`管理分类「${category.name}」`} aria-label={`管理分类「${category.name}」`} onClick={() => onEditCategory(category)}><MoreHorizontal size={16} /></button></div>
        })}
        <NavItem active={selection === 'uncategorized'} icon={Folder} label="未分类" onClick={() => setSelection('uncategorized')} />
      </nav>
      <div className="sidebar-spacer" />
      <button className="settings-link" onClick={onSettings}><Settings size={18} /><span>设置</span></button>
      <div className="shortcut-hint"><span>快速唤起</span><ShortcutKeys value={launcherShortcut} /></div>
    </aside>
  )
}

function WindowControls() {
  return (
    <div className="window-controls">
      <button aria-label="最小化" onClick={() => api.minimize()}><Minus size={18} /></button>
      <button className="close" aria-label="隐藏窗口" onClick={() => api.hide()}><X size={19} /></button>
    </div>
  )
}

function AddToolsControl({ adding, onPick }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const closeOutside = (event) => { if (!ref.current?.contains(event.target)) setOpen(false) }
    const closeWithEscape = (event) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', closeOutside)
    window.addEventListener('keydown', closeWithEscape)
    return () => { window.removeEventListener('pointerdown', closeOutside); window.removeEventListener('keydown', closeWithEscape) }
  }, [open])
  const pick = (mode) => { setOpen(false); onPick(mode) }
  return (
    <div className="add-control" ref={ref}>
      <button className={`add-launcher-button ${open ? 'open' : ''}`} title="添加工具" disabled={adding} aria-label="添加工具" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}><span className="add-button-icon">{adding ? <span className="button-spinner" /> : <Plus size={17} />}</span><span>{adding ? '选择中' : '添加'}</span><ChevronDown className="add-button-chevron" size={14} /></button>
      {open ? <div className="add-menu" role="menu" aria-label="添加工具方式"><button role="menuitem" onClick={() => pick('files')}><File size={17} /><span><b>程序、快捷方式或文件</b><small>支持批量选择 EXE、LNK 和普通文件</small></span></button><button role="menuitem" onClick={() => pick('folder')}><FolderOpen size={17} /><span><b>文件夹</b><small>选择一个常用目录加入工具箱</small></span></button></div> : null}
    </div>
  )
}

function AppIcon({ tool, small = false }) {
  const [imageFailed, setImageFailed] = useState(false)
  useEffect(() => setImageFailed(false), [tool.icon])
  const preset = toolIconPresetMap[tool.iconPreset]
  if (preset) {
    const Icon = preset.Icon
    return <span className={`preset-tool-icon ${small ? 'small' : ''}`} style={{ '--icon-color': preset.color }} title={`${preset.label}预设图标`}><Icon size={small ? 20 : 23} strokeWidth={2} /></span>
  }
  if (tool.icon && !imageFailed) return <img className={`app-icon ${small ? 'small' : ''}`} src={tool.icon} alt="" draggable="false" onError={() => setImageFailed(true)} />
  const extension = String(tool.type || '').toUpperCase()
  const isFolder = tool.type === 'folder'
  const label = isFolder ? '' : (extension.length <= 4 ? extension : tool.name.trim().slice(0, 1).toUpperCase()) || 'APP'
  const color = typeColors[(tool.name.length + extension.length) % typeColors.length]
  return <span className={`fallback-icon ${small ? 'small' : ''}`} style={{ '--icon-color': color }}>{isFolder ? <Folder size={small ? 20 : 23} /> : <><File size={small ? 20 : 23} /><em>{label}</em></>}</span>
}

function ToolMenu({ tool, onEdit, onDelete, onReveal, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const close = (event) => { if (!ref.current?.contains(event.target)) onClose() }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [onClose])
  return (
    <div className="tool-menu" ref={ref} role="menu">
      <button onClick={() => { onEdit(tool); onClose() }}><Edit3 size={15} />编辑工具</button>
      <button onClick={() => { onReveal(tool.path); onClose() }}><FolderOpen size={15} />打开所在位置</button>
      <div />
      <button className="danger" onClick={() => { onDelete(tool.id); onClose() }}><Trash2 size={15} />移除工具</button>
    </div>
  )
}

const ToolCard = memo(function ToolCard({ tool, categoryName, invalid = false, canReorder = false, onReorder, onLaunch, onFavorite, onEdit, onDelete, onReveal, compact = false }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const handleKeyDown = (event) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onLaunch(tool) }
  }
  if (compact) {
    return (
      <button className="favorite-card" onClick={() => onLaunch(tool)}>
        <AppIcon tool={tool} small />
        <span><b>{tool.name}</b><small>{categoryName}</small></span>
        <Star size={17} fill="#168cff" color="#168cff" />
      </button>
    )
  }
  return (
    <article className={`tool-card ${invalid ? 'invalid' : ''} ${canReorder ? 'reorderable' : ''}`} tabIndex={0} draggable={canReorder} onDragStart={(event) => { if (!canReorder) return; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-toolbox-tool', tool.id) }} onDragOver={(event) => { if (canReorder && event.dataTransfer.types.includes('application/x-toolbox-tool')) event.preventDefault() }} onDrop={(event) => { const sourceId = event.dataTransfer.getData('application/x-toolbox-tool'); if (canReorder && sourceId) { event.preventDefault(); event.stopPropagation(); onReorder(sourceId, tool.id) } }} onDoubleClick={() => onLaunch(tool)} onKeyDown={handleKeyDown}>
      {canReorder ? <span className="drag-handle" title="拖动排序"><GripVertical size={15} /></span> : null}
      <div className="tool-card-actions" onDoubleClick={(event) => event.stopPropagation()}>
        <button className={`star-button ${tool.favorite ? 'selected' : ''}`} aria-label={tool.favorite ? '取消收藏' : '收藏'} onClick={() => onFavorite(tool.id)}>
          <Star size={17} fill={tool.favorite ? 'currentColor' : 'none'} />
        </button>
        <button className="more-button" aria-label="更多操作" onClick={() => setMenuOpen((open) => !open)}><MoreHorizontal size={18} /></button>
        {menuOpen ? <ToolMenu tool={tool} onEdit={onEdit} onDelete={onDelete} onReveal={onReveal} onClose={() => setMenuOpen(false)} /> : null}
      </div>
      <AppIcon tool={tool} />
      <div className="tool-meta"><strong title={tool.name}>{tool.name}</strong><span>{categoryName}</span></div>
      <span className={`launch-label ${invalid ? 'path-invalid' : ''}`}>{invalid ? '路径已失效 · 请在菜单中重新定位' : tool.shortcut ? `${tool.shortcut} · 双击启动` : '双击启动'}</span>
    </article>
  )
})

const ToolGrid = memo(function ToolGrid({ tools, view, categoryMap, invalidIds, canReorder, onReorder, onLaunch, onFavorite, onEdit, onDelete, onReveal }) {
  return (
    <div className={`tool-grid ${view === 'list' ? 'list-view' : ''}`}>
      {tools.map((tool) => <ToolCard key={tool.id} tool={tool} categoryName={categoryMap.get(tool.categoryId) || '未分类'} invalid={invalidIds.has(tool.id)} canReorder={canReorder} onReorder={onReorder} onLaunch={onLaunch} onFavorite={onFavorite} onEdit={onEdit} onDelete={onDelete} onReveal={onReveal} />)}
    </div>
  )
})

function Modal({ title, children, onClose, footer }) {
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button aria-label="关闭" onClick={onClose}><X size={19} /></button></header>
        <div className="modal-body">{children}</div>
        {footer ? <footer>{footer}</footer> : null}
      </section>
    </div>
  )
}

function EditToolModal({ tool, tools, categories, launcherShortcut, onRefreshIcon, onSave, onClose }) {
  const [draft, setDraft] = useState(tool)
  const [name, setName] = useState(tool.name)
  const [categoryId, setCategoryId] = useState(tool.categoryId || 'uncategorized')
  const [shortcut, setShortcut] = useState(tool.shortcut || '')
  const [relocating, setRelocating] = useState(false)
  const [refreshingIcon, setRefreshingIcon] = useState(false)
  const shortcutTaken = shortcut && (shortcut.toLowerCase() === String(launcherShortcut || 'Alt+X').toLowerCase() || tools.some((item) => item.id !== tool.id && String(item.shortcut || '').toLowerCase() === shortcut.toLowerCase()))
  const relocate = async () => {
    setRelocating(true)
    try {
      const [replacement] = (await api.pickTools()).filter(Boolean)
      if (replacement) setDraft((current) => ({ ...current, path: replacement.path, type: replacement.type, icon: replacement.icon, iconResolvedFromTarget: replacement.iconResolvedFromTarget, resolvedTarget: replacement.resolvedTarget }))
    } finally {
      setRelocating(false)
    }
  }
  const refreshIcon = async () => {
    setRefreshingIcon(true)
    try {
      const iconInfo = await onRefreshIcon(draft.path)
      if (iconInfo) setDraft((current) => ({ ...current, ...iconInfo, iconPreset: '' }))
    } finally {
      setRefreshingIcon(false)
    }
  }
  return (
    <Modal title="编辑工具" onClose={onClose} footer={<><button className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={!name.trim() || shortcutTaken} onClick={() => onSave({ ...draft, name: name.trim(), categoryId, shortcut })}>保存更改</button></>}>
      <label className="field"><span>名称</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="field"><span>分类</span><div className="select-wrap"><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="uncategorized">未分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><ChevronDown size={16} /></div></label>
      <label className="field shortcut-field"><span>工具快捷键</span><div><Keyboard size={17} /><input readOnly value={shortcut} placeholder="点击后按组合键，例如 Ctrl+Alt+W" onKeyDown={(event) => { event.preventDefault(); event.stopPropagation(); const next = shortcutFromEvent(event); if (next !== null) setShortcut(next) }} />{shortcut ? <button type="button" aria-label="清除快捷键" onClick={() => setShortcut('')}><X size={15} /></button> : null}</div><small className={shortcutTaken ? 'field-error' : ''}>{shortcutTaken ? '该快捷键已被占用，请更换' : '至少包含 Ctrl、Alt 或 Shift；Delete 可清除'}</small></label>
      <fieldset className="tool-icon-picker"><legend>工具图标</legend><div className="tool-icon-options"><button type="button" className={!draft.iconPreset ? 'selected' : ''} title="使用自动读取的原始图标" onClick={() => setDraft((current) => ({ ...current, iconPreset: '' }))}><AppIcon tool={{ ...draft, iconPreset: '' }} small /><span>自动</span></button>{toolIconPresets.map(([value, label, Icon, color]) => <button key={value} type="button" className={draft.iconPreset === value ? 'selected' : ''} title={`${label}图标`} onClick={() => setDraft((current) => ({ ...current, iconPreset: value }))}><span className="preset-tool-icon small" style={{ '--icon-color': color }}><Icon size={20} /></span><span>{label}</span></button>)}</div><button className="refresh-icon-button" type="button" disabled={refreshingIcon} onClick={refreshIcon}><RefreshCw size={14} className={refreshingIcon ? 'spinning' : ''} />{refreshingIcon ? '正在读取' : '重新读取原始图标'}</button></fieldset>
      <div className="path-preview"><AppIcon tool={draft} small /><span title={draft.path}>{draft.path}</span><button type="button" disabled={relocating} onClick={relocate}><RefreshCw size={14} />{relocating ? '选择中' : '重新定位'}</button></div>
    </Modal>
  )
}

function AddCategoryModal({ onSave, onClose }) {
  const [name, setName] = useState('')
  const submit = () => { if (name.trim()) onSave(name.trim()) }
  return (
    <Modal title="新建分类" onClose={onClose} footer={<><button className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={!name.trim()} onClick={submit}>创建分类</button></>}>
      <label className="field"><span>分类名称</span><input autoFocus placeholder="例如：办公软件" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submit() }} /></label>
    </Modal>
  )
}

function EditCategoryModal({ category, onSave, onDelete, onClose }) {
  const [name, setName] = useState(category.name)
  const [icon, setIcon] = useState(category.icon || 'box')
  const [deleteArmed, setDeleteArmed] = useState(false)
  const submit = () => { if (name.trim()) onSave({ ...category, name: name.trim(), icon }) }
  return (
    <Modal title="管理分类" onClose={onClose} footer={<><button className={`delete-category ${deleteArmed ? 'armed' : ''}`} onClick={() => { if (deleteArmed) onDelete(category); else setDeleteArmed(true) }}><Trash2 size={15} />{deleteArmed ? '再次点击确认删除' : '删除分类'}</button><button className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={!name.trim()} onClick={submit}>保存</button></>}>
      <label className="field"><span>分类名称</span><input autoFocus value={name} onChange={(event) => { setName(event.target.value); setDeleteArmed(false) }} onKeyDown={(event) => { if (event.key === 'Enter') submit() }} /></label>
      <fieldset className="icon-picker"><legend>分类图标</legend><div>{categoryIcons.map(([value, label]) => { const Icon = iconMap[value]; return <button key={value} type="button" className={icon === value ? 'selected' : ''} title={label} aria-label={label} onClick={() => { setIcon(value); setDeleteArmed(false) }}><Icon size={20} /></button> })}</div></fieldset>
      <p className="delete-note">删除分类后，其中的工具会自动移入“未分类”，不会删除工具或文件。</p>
    </Modal>
  )
}

function SettingsModal({ autoLaunch, hideAfterLaunch, launcherShortcut, tools, invalidCount, onAutoLaunch, onHideAfterLaunch, onLauncherShortcut, onRefreshIcons, onExport, onImport, onCheckPaths, onClose }) {
  const [importArmed, setImportArmed] = useState(false)
  const [shortcutDraft, setShortcutDraft] = useState(launcherShortcut || 'Alt+X')
  const [pendingSwitch, setPendingSwitch] = useState('')
  const [refreshingIcons, setRefreshingIcons] = useState(false)
  const shortcutTaken = tools.some((tool) => String(tool.shortcut || '').toLowerCase() === shortcutDraft.toLowerCase())
  const toggleAutoLaunch = async () => {
    if (pendingSwitch) return
    setPendingSwitch('autoLaunch')
    try { await onAutoLaunch(!autoLaunch) } finally { setPendingSwitch('') }
  }
  const refreshAllIcons = async () => {
    if (refreshingIcons) return
    setRefreshingIcons(true)
    try { await onRefreshIcons() } finally { setRefreshingIcons(false) }
  }
  return (
    <Modal title="设置" onClose={onClose} footer={<button className="primary" onClick={onClose}>完成</button>}>
      <div className="setting-row"><span><b>开机自动启动</b><small>登录 Windows 后在后台运行，随时使用 {launcherShortcut} 唤起</small></span><button className={`switch ${autoLaunch ? 'on' : ''} ${pendingSwitch === 'autoLaunch' ? 'pending' : ''}`} role="switch" aria-label="开机自动启动" aria-checked={autoLaunch} disabled={Boolean(pendingSwitch)} onClick={toggleAutoLaunch}><i /></button></div>
      <div className="setting-row"><span><b>启动后自动隐藏</b><small>打开工具后将工具箱收起到系统托盘</small></span><button className={`switch ${hideAfterLaunch ? 'on' : ''}`} role="switch" aria-label="启动后自动隐藏" aria-checked={hideAfterLaunch} onClick={() => onHideAfterLaunch(!hideAfterLaunch)}><i /></button></div>
      <div className="setting-row launcher-shortcut-row"><span><b>全局唤起快捷键</b><small className={shortcutTaken ? 'field-error' : ''}>{shortcutTaken ? '该组合键已分配给某个工具' : '点击输入框后直接按新的组合键'}</small></span><div className="launcher-shortcut-editor"><Keyboard size={16} /><input aria-label="全局唤起快捷键" readOnly value={shortcutDraft} onKeyDown={(event) => { event.preventDefault(); event.stopPropagation(); const next = shortcutFromEvent(event); if (next) setShortcutDraft(next) }} /><button disabled={shortcutTaken || shortcutDraft === launcherShortcut} onClick={() => onLauncherShortcut(shortcutDraft)}>应用</button></div></div>
      <div className="setting-row"><span><b>失效路径检测</b><small>{invalidCount ? `发现 ${invalidCount} 个失效工具` : '当前没有发现失效工具'}</small></span><button className="setting-action" onClick={onCheckPaths}><RefreshCw size={15} />立即扫描</button></div>
      <div className="setting-row"><span><b>刷新工具图标</b><small>重新读取全部程序和快捷方式的原始图标</small></span><button className="setting-action" disabled={refreshingIcons} onClick={refreshAllIcons}><RefreshCw size={15} className={refreshingIcons ? 'spinning' : ''} />{refreshingIcons ? '读取中' : '全部刷新'}</button></div>
      <div className="setting-row backup-row"><span><b>数据备份</b><small>导出或恢复全部分类、工具和设置</small></span><div><button className="setting-action" onClick={onExport}><Download size={15} />导出</button><button className={`setting-action ${importArmed ? 'warning' : ''}`} onClick={() => { if (importArmed) onImport(); else setImportArmed(true) }}><Upload size={15} />{importArmed ? '确认恢复' : '恢复'}</button></div></div>
      <button className="quit-button" onClick={() => api.quit()}><Power size={16} />完全退出应用</button>
    </Modal>
  )
}

function EmptyState({ filtered, onAdd }) {
  return (
    <div className="empty-state">
      <span><AppWindow size={34} /></span>
      <h3>{filtered ? '没有匹配的工具' : '这里还没有工具'}</h3>
      <p>{filtered ? '换个关键词试试，或清空搜索内容。' : '拖入应用、快捷方式或文件，建立你的快速启动空间。'}</p>
      {!filtered ? <button className="secondary-add" onClick={onAdd}><Plus size={17} />添加第一个工具</button> : null}
    </div>
  )
}

export default function App() {
  const [state, setState] = useState(null)
  const [selection, setSelection] = useState('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState('grid')
  const [sort, setSort] = useState('default')
  const [dragging, setDragging] = useState(false)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const [autoLaunch, setAutoLaunch] = useState(false)
  const [adding, setAdding] = useState(false)
  const [invalidIds, setInvalidIds] = useState(() => new Set())
  const searchRef = useRef(null)
  const addingRef = useRef(false)
  const launchingRef = useRef(new Set())
  const shortcutFailureRef = useRef('')
  const dragDepthRef = useRef(0)
  const saveRevisionRef = useRef(0)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  useEffect(() => {
    Promise.all([api.loadState(), api.getAutoLaunch(), api.checkPaths()]).then(([loaded, startsAtLogin, invalid]) => {
      setState(loaded)
      setAutoLaunch(startsAtLogin)
      setInvalidIds(new Set(invalid))
    })
    const stopFocusListener = api.onFocusSearch(() => setTimeout(() => searchRef.current?.focus(), 50))
    const stopStateListener = api.onStateChanged((updated) => setState(updated))
    return () => { stopFocusListener(); stopStateListener() }
  }, [])

  useEffect(() => {
    if (!state) return undefined
    const revision = ++saveRevisionRef.current
    const timer = setTimeout(() => {
      api.saveState(state).then((result) => {
        if (revision !== saveRevisionRef.current) return
        const signature = (result?.shortcutFailures || []).join(',')
        if (signature && signature !== shortcutFailureRef.current) setToast('部分快捷键与系统或其他软件冲突，未能注册')
        shortcutFailureRef.current = signature
        if (result?.launcherShortcut && result.launcherShortcut !== state.settings?.launcherShortcut) {
          setState((current) => ({ ...current, settings: { ...current.settings, launcherShortcut: result.launcherShortcut } }))
          if (result.launcherShortcutFailed) setToast(`快捷键被占用，已恢复为 ${result.launcherShortcut}`)
        }
      }).catch(() => {})
    }, 140)
    return () => clearTimeout(timer)
  }, [state])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2300)
    return () => clearTimeout(timer)
  }, [toast])

  const categoryMap = useMemo(() => new Map([
    ['uncategorized', '未分类'],
    ...(state?.categories || []).map((category) => [category.id, category.name]),
  ]), [state?.categories])
  const categoryIconMap = useMemo(() => new Map([
    ['uncategorized', 'folder'],
    ...(state?.categories || []).map((category) => [category.id, category.icon || 'box']),
  ]), [state?.categories])

  const visibleTools = useMemo(() => {
    if (!state) return []
    let tools = state.tools
    if (selection === 'favorites') tools = tools.filter((tool) => tool.favorite)
    else if (selection === 'recent') tools = tools.filter((tool) => tool.lastOpenedAt)
    else if (selection === 'invalid') tools = tools.filter((tool) => invalidIds.has(tool.id))
    else if (selection !== 'all') tools = tools.filter((tool) => tool.categoryId === selection)
    if (deferredQuery) tools = tools.filter((tool) => `${tool.name} ${tool.path} ${categoryMap.get(tool.categoryId) || ''}`.toLowerCase().includes(deferredQuery))
    if (sort === 'name') tools = tools.toSorted((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    else if (sort === 'frequent') tools = tools.toSorted((a, b) => (b.openCount || 0) - (a.openCount || 0))
    else if (sort === 'recent' || selection === 'recent') tools = tools.toSorted((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0))
    else if (sort === 'added') tools = tools.toSorted((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    return tools
  }, [categoryMap, deferredQuery, invalidIds, selection, sort, state])

  const favorites = useMemo(() => state?.tools.filter((tool) => tool.favorite).slice(0, 4) || [], [state?.tools])
  const toolGroups = useMemo(() => {
    if (selection !== 'all') return []
    const buckets = new Map()
    for (const tool of visibleTools) {
      const categoryId = categoryMap.has(tool.categoryId) ? tool.categoryId : 'uncategorized'
      if (!buckets.has(categoryId)) buckets.set(categoryId, [])
      buckets.get(categoryId).push(tool)
    }
    const categoryOrder = [...(state?.categories || []).map((category) => category.id), 'uncategorized']
    return categoryOrder.flatMap((categoryId) => {
      const tools = buckets.get(categoryId)
      return tools?.length ? [{ id: categoryId, name: categoryMap.get(categoryId) || '未分类', icon: categoryIconMap.get(categoryId) || 'box', tools }] : []
    })
  }, [categoryIconMap, categoryMap, selection, state?.categories, visibleTools])
  const title = selection === 'all' ? '全部工具' : selection === 'favorites' ? '常用工具' : selection === 'recent' ? '最近使用' : selection === 'invalid' ? '失效工具' : categoryMap.get(selection) || '工具'
  const canReorderTools = sort === 'default' && !deferredQuery && !['favorites', 'recent', 'invalid'].includes(selection)

  const addInspectedTools = useCallback((items) => {
    const valid = items.filter(Boolean)
    if (!valid.length) return
    setState((current) => {
      const existing = new Set(current.tools.map((tool) => tool.path.toLowerCase()))
      const categoryId = selection !== 'all' && !['favorites', 'recent', 'invalid'].includes(selection) ? selection : 'uncategorized'
      const fresh = valid.filter((tool) => !existing.has(tool.path.toLowerCase())).map((tool) => ({ ...tool, categoryId }))
      setToast(fresh.length ? `已添加 ${fresh.length} 个工具` : '这些工具已经添加过了')
      return { ...current, tools: [...current.tools, ...fresh] }
    })
  }, [selection])

  const chooseTools = useCallback(async (mode = 'files') => {
    if (addingRef.current) return
    addingRef.current = true
    setAdding(true)
    try {
      addInspectedTools(await api.pickTools(mode))
    } catch {
      setToast('无法打开文件选择窗口，请稍后重试')
    } finally {
      addingRef.current = false
      setAdding(false)
    }
  }, [addInspectedTools])

  const handleDrop = useCallback(async (event) => {
    event.preventDefault()
    dragDepthRef.current = 0
    setDragging(false)
    const paths = [...event.dataTransfer.files].map((file) => api.getFilePath(file)).filter(Boolean)
    if (!paths.length) return
    try {
      addInspectedTools(await api.inspectPaths(paths))
    } catch {
      setToast('读取拖入项目失败，请检查文件是否可访问')
    }
  }, [addInspectedTools])

  const refreshToolIcon = useCallback(async (toolPath) => {
    try {
      const iconInfo = await api.refreshIcon(toolPath)
      if (!iconInfo?.icon) setToast('未读取到原始图标，可以选择一个预设图标')
      else setToast('已重新读取原始图标')
      return iconInfo
    } catch {
      setToast('图标读取失败，可以选择一个预设图标')
      return null
    }
  }, [])

  const refreshAllIcons = useCallback(async () => {
    try {
      const refreshed = await api.refreshIcons(state?.tools || [])
      setState((current) => ({ ...current, tools: current.tools.map((tool) => {
        const iconInfo = refreshed?.[tool.id]
        return iconInfo?.icon ? { ...tool, ...iconInfo } : tool
      }) }))
      const count = Object.values(refreshed || {}).filter((item) => item?.icon).length
      setToast(`已刷新 ${count} 个工具图标`)
    } catch {
      setToast('批量刷新图标失败，请稍后重试')
    }
  }, [state?.tools])

  const launch = useCallback(async (tool) => {
    if (launchingRef.current.has(tool.id)) return
    launchingRef.current.add(tool.id)
    try {
      const result = await api.launchTool(tool)
      if (!result.ok) { setToast(result.error || '无法打开该工具，请检查文件路径'); return }
      if (!result.updatedByMain) setState((current) => ({ ...current, tools: current.tools.map((item) => item.id === tool.id ? { ...item, lastOpenedAt: Date.now(), openCount: (item.openCount || 0) + 1 } : item) }))
      setToast(`已启动 ${tool.name}`)
    } catch {
      setToast('启动失败，请检查工具路径或访问权限')
    } finally {
      launchingRef.current.delete(tool.id)
    }
  }, [])

  const toggleFavorite = useCallback((id) => {
    setState((current) => ({ ...current, tools: current.tools.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item) }))
  }, [])
  const editTool = useCallback((tool) => setModal({ type: 'edit', tool }), [])
  const deleteTool = useCallback((id) => {
    setState((current) => ({ ...current, tools: current.tools.filter((item) => item.id !== id) }))
    setInvalidIds((current) => { const next = new Set(current); next.delete(id); return next })
    setToast('已从工具箱移除')
  }, [])
  const reorderTools = useCallback((sourceId, targetId) => {
    if (sourceId === targetId) return
    setState((current) => {
      const tools = [...current.tools]
      const from = tools.findIndex((tool) => tool.id === sourceId)
      const to = tools.findIndex((tool) => tool.id === targetId)
      if (from < 0 || to < 0) return current
      const [moved] = tools.splice(from, 1)
      tools.splice(to, 0, moved)
      return { ...current, tools }
    })
  }, [])
  const reorderCategories = useCallback((sourceId, targetId) => {
    if (sourceId === targetId) return
    setState((current) => {
      const categories = [...current.categories]
      const from = categories.findIndex((category) => category.id === sourceId)
      const to = categories.findIndex((category) => category.id === targetId)
      if (from < 0 || to < 0) return current
      const [moved] = categories.splice(from, 1)
      categories.splice(to, 0, moved)
      return { ...current, categories }
    })
  }, [])
  const refreshInvalidPaths = useCallback(async (announce = true) => {
    const invalid = await api.checkPaths()
    setInvalidIds(new Set(invalid))
    if (announce) setToast(invalid.length ? `发现 ${invalid.length} 个失效工具` : '所有工具路径均有效')
    return invalid
  }, [])
  const saveCategory = useCallback((updated) => {
    setState((current) => ({ ...current, categories: current.categories.map((category) => category.id === updated.id ? updated : category) }))
    setModal(null)
    setToast('分类已更新')
  }, [])
  const deleteCategory = useCallback((category) => {
    setState((current) => ({
      ...current,
      categories: current.categories.filter((item) => item.id !== category.id),
      tools: current.tools.map((tool) => tool.categoryId === category.id ? { ...tool, categoryId: 'uncategorized' } : tool),
    }))
    setSelection((current) => current === category.id ? 'uncategorized' : current)
    setModal(null)
    setToast(`已删除分类「${category.name}」，工具已移入未分类`)
  }, [])

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  if (!state) return <div className="loading"><span /><p>正在整理你的工具箱…</p></div>

  return (
    <main className="app-shell" onDragEnter={(event) => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); dragDepthRef.current += 1; setDragging(true) } }} onDragLeave={(event) => { if (event.dataTransfer.types.includes('Files')) { dragDepthRef.current = Math.max(0, dragDepthRef.current - 1); if (!dragDepthRef.current) setDragging(false) } }} onDragOver={(event) => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }} onDrop={(event) => { if (event.dataTransfer.types.includes('Files')) handleDrop(event) }}>
      <Sidebar categories={state.categories} invalidCount={invalidIds.size} launcherShortcut={state.settings?.launcherShortcut || 'Alt+X'} selection={selection} setSelection={setSelection} onAddCategory={() => setModal({ type: 'category' })} onEditCategory={(category) => setModal({ type: 'edit-category', category })} onReorderCategory={reorderCategories} onSettings={() => setModal({ type: 'settings' })} />
      <section className="workspace">
        <header className="topbar">
          <h1>{title}</h1>
          <label className="search-box"><Search size={20} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && visibleTools[0]) { event.preventDefault(); launch(visibleTools[0]) } else if (event.key === 'Escape') { setQuery('') } }} placeholder="搜索工具，回车启动首项…" /><kbd>Ctrl K</kbd>{query ? <button aria-label="清空搜索" onClick={() => setQuery('')}><X size={16} /></button> : null}</label>
          <AddToolsControl adding={adding} onPick={chooseTools} />
          <WindowControls />
        </header>
        <div className="content-scroll">
          {selection === 'all' && !deferredQuery && favorites.length ? <section className="favorites-section"><h2>常用工具</h2><div className="favorite-row">{favorites.map((tool) => <ToolCard key={tool.id} compact tool={tool} categoryName={categoryMap.get(tool.categoryId)} onLaunch={launch} />)}</div></section> : null}
          <section className="tools-section">
            <div className="section-heading"><div><h2>{selection === 'all' ? '全部工具' : title}</h2><span>{visibleTools.length} 个工具</span></div><div className="section-actions"><label className="sort-select"><span>排序</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="default">默认</option><option value="added">最新添加</option><option value="name">名称</option><option value="frequent">最常使用</option><option value="recent">最近使用</option></select><ChevronDown size={14} /></label><div className="view-toggle"><button className={view === 'grid' ? 'active' : ''} aria-label="网格视图" onClick={() => setView('grid')}><Grid2X2 size={18} /></button><button className={view === 'list' ? 'active' : ''} aria-label="列表视图" onClick={() => setView('list')}><List size={19} /></button></div></div></div>
            {visibleTools.length ? selection === 'all' ? <div className="categorized-tools">{toolGroups.map((group) => { const GroupIcon = iconMap[group.icon] || Box; return <section className="category-tool-group" key={group.id}><header className="category-group-heading"><span><GroupIcon size={16} /><b>{group.name}</b></span><small>{group.tools.length} 个</small></header><ToolGrid tools={group.tools} view={view} categoryMap={categoryMap} invalidIds={invalidIds} canReorder={canReorderTools} onReorder={reorderTools} onLaunch={launch} onFavorite={toggleFavorite} onEdit={editTool} onDelete={deleteTool} onReveal={api.revealTool} /></section> })}</div> : <ToolGrid tools={visibleTools} view={view} categoryMap={categoryMap} invalidIds={invalidIds} canReorder={canReorderTools} onReorder={reorderTools} onLaunch={launch} onFavorite={toggleFavorite} onEdit={editTool} onDelete={deleteTool} onReveal={api.revealTool} /> : <EmptyState filtered={Boolean(deferredQuery)} onAdd={() => chooseTools('files')} />}
          </section>
          <button className="drop-zone" onClick={() => chooseTools('files')}><UploadCloud size={28} /><span><b>拖入 EXE、快捷方式、文件或文件夹</b><small>支持批量拖拽添加，点击可选择程序或文件</small></span></button>
        </div>
      </section>
      {dragging ? <div className="drop-overlay"><div><UploadCloud size={44} /><h2>松开即可添加</h2><p>工具将保存到「{selection !== 'all' && !['favorites', 'recent', 'invalid'].includes(selection) ? categoryMap.get(selection) : '未分类'}」</p></div></div> : null}
      {modal?.type === 'category' ? <AddCategoryModal onClose={() => setModal(null)} onSave={(name) => { const id = `category-${Date.now()}`; setState((current) => ({ ...current, categories: [...current.categories, { id, name, icon: 'box' }] })); setSelection(id); setModal(null); setToast(`已创建分类「${name}」`) }} /> : null}
      {modal?.type === 'edit-category' ? <EditCategoryModal category={modal.category} onClose={() => setModal(null)} onSave={saveCategory} onDelete={deleteCategory} /> : null}
      {modal?.type === 'edit' ? <EditToolModal tool={modal.tool} tools={state.tools} categories={state.categories} launcherShortcut={state.settings?.launcherShortcut || 'Alt+X'} onRefreshIcon={refreshToolIcon} onClose={() => setModal(null)} onSave={(updated) => { setState((current) => ({ ...current, tools: current.tools.map((tool) => tool.id === updated.id ? updated : tool) })); if (updated.path !== modal.tool.path) setInvalidIds((current) => { const next = new Set(current); next.delete(updated.id); return next }); setModal(null); setToast('工具信息已更新') }} /> : null}
      {modal?.type === 'settings' ? <SettingsModal autoLaunch={autoLaunch} hideAfterLaunch={Boolean(state.settings?.hideAfterLaunch)} launcherShortcut={state.settings?.launcherShortcut || 'Alt+X'} tools={state.tools} invalidCount={invalidIds.size} onClose={() => setModal(null)} onAutoLaunch={async (enabled) => { const actual = await api.setAutoLaunch(enabled); setAutoLaunch(actual); setState((current) => ({ ...current, settings: { ...current.settings, autoLaunch: actual } })); setToast(actual ? '已开启开机自动启动' : '已关闭开机自动启动') }} onHideAfterLaunch={(enabled) => { setState((current) => ({ ...current, settings: { ...current.settings, hideAfterLaunch: enabled } })); setToast(enabled ? '启动工具后将自动隐藏' : '已关闭启动后自动隐藏') }} onLauncherShortcut={(shortcut) => { setState((current) => ({ ...current, settings: { ...current.settings, launcherShortcut: shortcut } })); setToast(`正在应用全局快捷键 ${shortcut}`) }} onCheckPaths={() => refreshInvalidPaths(true)} onRefreshIcons={refreshAllIcons} onExport={async () => { const result = await api.exportBackup(); if (result.ok) setToast('备份已导出') }} onImport={async () => { const result = await api.importBackup(); if (result.ok) { setState(result.state); setModal(null); await refreshInvalidPaths(false); setToast('备份恢复成功') } else if (!result.canceled) setToast(result.error || '备份恢复失败') }} /> : null}
      {toast ? <div className="toast">{toast}</div> : null}
    </main>
  )
}
