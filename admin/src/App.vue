<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import {
  Aim,
  Avatar,
  Bell,
  Box,
  ArrowDownBold,
  ArrowUpBold,
  Close,
  Collection,
  Connection,
  Cpu,
  DataAnalysis,
  Delete,
  Document,
  Download,
  Edit,
  Finished,
  FullScreen,
  Hide,
  House,
  Key,
  Link,
  Lock,
  MagicStick,
  Monitor,
  More,
  Moon,
  Operation,
  Plus,
  Position,
  Refresh,
  Search,
  Setting,
  Sunny,
  SwitchButton,
  Timer,
  Upload,
  View,
  WarningFilled
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi } from '@/api/client'
import type {
  ActiveAlert,
  AdminConfig,
  AlertSummary,
  AlertNotification,
  AlertsConfig,
  AuditRecord,
  BackupRecord,
  ConfigVersion,
  LogRecord,
  MetricsResponse,
  QualityCase,
  QualityPreset,
  SessionRecord,
  StudioInterface,
  StudioModel,
  StudioUpstream,
  UpstreamHealthRecord,
  UpdateInfo,
  UsageBucket,
  UsageResponse
} from '@/api/types'

type ViewKey = 'dashboard' | 'interfaces' | 'upstreams' | 'models' | 'quality' | 'logs' | 'usage' | 'alerts' | 'security' | 'system'
type DrawerMode = 'interface' | 'upstream' | 'model' | 'quality' | null
type ThemeMode = 'light' | 'dark'
type LayoutMode = 'left' | 'compact' | 'wide'
type MenuStyleMode = 'design' | 'dark' | 'light'
type TableDensity = 'default' | 'comfortable' | 'compact'
type SettingOptionGroup = 'theme' | 'layout' | 'menuStyle' | 'density'
type WorkTabActionKey = 'refresh' | 'fixed' | 'left' | 'right' | 'other' | 'all'
type TableHeaderToolKey = 'search' | 'refresh' | 'density' | 'columns'
type TableModuleKey = 'interfaces' | 'upstreams' | 'models' | 'quality'
type TablePaginationState = { currentPage: number; pageSize: number }

const navGroups: Array<{ title: string; items: Array<{ key: ViewKey; label: string; icon: unknown }> }> = [
  { title: '监控', items: [
    { key: 'dashboard', label: '仪表盘', icon: Monitor },
    { key: 'logs', label: '调用日志', icon: Document },
    { key: 'usage', label: '用量与成本', icon: DataAnalysis }
  ] },
  { title: '配置', items: [
    { key: 'interfaces', label: '接口管理', icon: Connection },
    { key: 'upstreams', label: '上游管理', icon: Link }
  ] },
  { title: '质量', items: [
    { key: 'models', label: '模型目录', icon: Box },
    { key: 'quality', label: '生图质量', icon: MagicStick }
  ] },
  { title: '安全', items: [
    { key: 'security', label: '账号与安全', icon: Lock },
    { key: 'alerts', label: '告警中心', icon: Bell }
  ] },
  { title: '系统', items: [
    { key: 'system', label: '备份与更新', icon: Cpu }
  ] }
]

const loading = ref(false)
const authenticated = ref(false)
const username = ref('admin')
const activeView = ref<ViewKey>('dashboard')
const pageContentRefreshing = ref(true)
const showPageTransitionMask = ref(false)
const pageTransitionName = computed(() => showPageTransitionMask.value ? '' : 'slide-left')
const pageTabs = ref<ViewKey[]>(['dashboard'])
const fixedPageTabs = ref<ViewKey[]>(['dashboard'])
const workTabTarget = ref<ViewKey>('dashboard')
const themeMode = ref<ThemeMode>('light')
const layoutMode = ref<LayoutMode>('left')
const menuStyleMode = ref<MenuStyleMode>('design')
const menuOpen = ref(true)
const mobileMenuVisible = ref(false)
const viewportWidth = ref(typeof window === 'undefined' ? 1200 : window.innerWidth)
const isMobileMenuMode = computed(() => viewportWidth.value <= 800)
const globalSearchVisible = ref(false)
const highlightedSearchIndex = ref(0)
const globalSearchInputRef = ref<HTMLInputElement | null>(null)
const notificationPanelVisible = ref(false)
const activeNotificationTab = ref<'alerts' | 'notifications' | 'system'>('alerts')
const loginForm = reactive({ username: 'admin', password: '', totpCode: '' })
const accountForm = reactive({ username: '', currentPassword: '', newPassword: '' })
const totpSetup = ref<{ secret: string; otpauthURL: string } | null>(null)
const totpCode = ref('')
const config = ref<AdminConfig | null>(null)
const lastSavedConfig = ref('')
const metrics = ref<MetricsResponse['metrics'] | null>(null)
const generationLogs = ref<LogRecord[]>([])
const apiLogs = ref<LogRecord[]>([])
const qualityCases = ref<QualityCase[]>([])
const upstreamHealth = ref<UpstreamHealthRecord[]>([])
const usage = ref<UsageResponse['usage'] | null>(null)
const versions = ref<ConfigVersion[]>([])
const backups = ref<BackupRecord[]>([])
const auditLogs = ref<AuditRecord[]>([])
const sessions = ref<SessionRecord[]>([])
const updateInfo = ref<UpdateInfo>({})
const activeAlerts = ref<ActiveAlert[]>([])
const alertSummary = ref<AlertSummary>({ total: 0, critical: 0, warning: 0, info: 0, acknowledged: 0 })
const alertNotification = ref<AlertNotification>({ status: 'idle' })
const backupStatus = ref('')
const backupFileInput = ref<HTMLInputElement | null>(null)
const settingsPanelVisible = ref(false)
const drawerVisible = ref(false)
const drawerMode = ref<DrawerMode>(null)
const drawerIndex = ref(-1)
const logDetailVisible = ref(false)
const selectedLog = ref<LogRecord | null>(null)
const activeLogTab = ref<'generations' | 'api'>('generations')
const logSearchExpanded = ref(false)
const secretValues = reactive<Record<string, string>>({})
const headerSearchKeyword = ref('')
const tableSearch = reactive<Record<'interfaces' | 'upstreams' | 'models' | 'quality', string>>({
  interfaces: '',
  upstreams: '',
  models: '',
  quality: ''
})
const tableSearchVisible = reactive<Record<TableModuleKey, boolean>>({
  interfaces: true,
  upstreams: true,
  models: true,
  quality: true
})
const tablePageSizes = [10, 20, 30, 50, 100]
const tablePagination = reactive<Record<TableModuleKey, TablePaginationState>>({
  interfaces: { currentPage: 1, pageSize: 10 },
  upstreams: { currentPage: 1, pageSize: 10 },
  models: { currentPage: 1, pageSize: 10 },
  quality: { currentPage: 1, pageSize: 10 }
})
const tableDensity = ref<TableDensity>('comfortable')
const tableColumnSettingsVisible = ref(false)
const logFilter = reactive({
  keyword: '',
  status: '',
  interfaceId: '',
  upstreamId: '',
  model: '',
  endpoint: '',
  requestId: '',
  from: '',
  to: '',
  statusMin: undefined as number | undefined,
  statusMax: undefined as number | undefined,
  minDurationMs: undefined as number | undefined,
  maxDurationMs: undefined as number | undefined
})

const flatNavItems = computed(() => navGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title }))))
const currentNavItem = computed(() => flatNavItems.value.find((item) => item.key === activeView.value) || flatNavItems.value[0])
const currentTitle = computed(() => currentNavItem.value?.label || '仪表盘')
const breadcrumbItems = computed(() => [
  { label: '工作台', icon: House },
  { label: currentNavItem.value?.group || '监控' },
  { label: currentTitle.value }
])
const openedPageTabs = computed(() => pageTabs.value
  .map((key) => flatNavItems.value.find((item) => item.key === key))
  .filter((item): item is NonNullable<typeof item> => Boolean(item))
  .map((item) => ({ ...item, fixed: fixedPageTabs.value.includes(item.key) })) as Array<{ key: ViewKey; label: string; icon: unknown; group: string; fixed: boolean }>)
const workTabActions = computed(() => {
  const target = workTabTarget.value
  const targetIndex = pageTabs.value.indexOf(target)
  const leftTabs = pageTabs.value.slice(0, Math.max(targetIndex, 0))
  const rightTabs = targetIndex >= 0 ? pageTabs.value.slice(targetIndex + 1) : []
  const isOnlyClosable = pageTabs.value.filter((key) => !isPageTabFixed(key)).length <= 0
  return [
    { key: 'refresh', label: '刷新当前', icon: Refresh, disabled: target !== activeView.value },
    { key: 'fixed', label: isPageTabFixed(target) ? '取消固定' : '固定标签', icon: Position, disabled: target === 'dashboard' },
    { key: 'left', label: '关闭左侧', icon: Close, disabled: !leftTabs.some((key) => !isPageTabFixed(key)) },
    { key: 'right', label: '关闭右侧', icon: Close, disabled: !rightTabs.some((key) => !isPageTabFixed(key)) },
    { key: 'other', label: '关闭其它', icon: Collection, disabled: !pageTabs.value.some((key) => key !== target && !isPageTabFixed(key)) },
    { key: 'all', label: '关闭全部', icon: SwitchButton, disabled: isOnlyClosable },
  ] as Array<{ key: WorkTabActionKey; label: string; icon: unknown; disabled: boolean }>
})
const headerSearchResults = computed(() => {
  const keyword = headerSearchKeyword.value.trim().toLowerCase()
  const items = flatNavItems.value.map((item) => ({
    ...item,
    hint: `${item.group} / ${item.label}`,
  }))
  if (!keyword) return items.slice(0, 6)
  return items.filter((item) => `${item.group} ${item.label} ${item.key}`.toLowerCase().includes(keyword)).slice(0, 8)
})
const settingsOptions = computed(() => ({
  theme: [
    { label: '浅色', value: 'light', icon: Sunny, hint: '清爽工作台' },
    { label: '深色', value: 'dark', icon: Moon, hint: '夜间运维' },
  ],
  layout: [
    { label: '左侧菜单', value: 'left', icon: Operation, hint: '经典后台' },
    { label: '紧凑菜单', value: 'compact', icon: Collection, hint: '更多内容空间' },
    { label: '宽屏工作台', value: 'wide', icon: FullScreen, hint: '大屏监控' },
  ],
  menuStyle: [
    { label: '设计风格', value: 'design', icon: MagicStick, hint: '品牌渐变' },
    { label: '暗色菜单', value: 'dark', icon: Moon, hint: '高对比导航' },
    { label: '亮色菜单', value: 'light', icon: Sunny, hint: '轻量导航' },
  ],
  density: [
    { label: '默认', value: 'default', icon: More, hint: '大字号表格' },
    { label: '舒适', value: 'comfortable', icon: Collection, hint: '均衡密度' },
    { label: '紧凑', value: 'compact', icon: Operation, hint: '高频扫表' },
  ],
}))
const activeInterfaces = computed(() => config.value?.interfaces || [])
const activeUpstreams = computed(() => config.value?.upstreams || [])
const activeModels = computed(() => config.value?.models || [])
const activePresets = computed(() => config.value?.qualityPresets || [])
const tableSize = computed(() => {
  if (tableDensity.value === 'compact') return 'small'
  if (tableDensity.value === 'default') return 'large'
  return 'default'
})
const tableColumnOptions: Record<TableModuleKey, Array<{ key: string; label: string; fixed?: boolean }>> = {
  interfaces: [
    { key: 'name', label: '名称', fixed: true },
    { key: 'apiToken', label: 'API Key' },
    { key: 'defaultImageModel', label: '模型' },
    { key: 'sizeQuality', label: '尺寸/质量' },
    { key: 'upstreamIds', label: '绑定上游' },
    { key: 'rateLimitPerMinute', label: '限流' },
    { key: 'enabled', label: '状态' },
    { key: 'lastUsedAt', label: '最后使用' }
  ],
  upstreams: [
    { key: 'name', label: '名称', fixed: true },
    { key: 'baseURL', label: 'Base URL' },
    { key: 'apiKey', label: 'API Key' },
    { key: 'priority', label: '优先级' },
    { key: 'weight', label: '权重' },
    { key: 'health', label: '健康' },
    { key: 'lastCheckedAt', label: '最近检测' },
    { key: 'lastFailureReason', label: '最近失败原因' },
    { key: 'healthCheckEnabled', label: '健康检查' },
    { key: 'enabled', label: '状态' }
  ],
  models: [
    { key: 'id', label: '模型 ID', fixed: true },
    { key: 'name', label: '名称' },
    { key: 'capabilities', label: '能力' },
    { key: 'sizes', label: '尺寸' },
    { key: 'qualities', label: '质量' },
    { key: 'defaultOutputFormat', label: '默认格式' },
    { key: 'upstreamIds', label: '绑定上游' },
    { key: 'recommendedUse', label: '推荐用途' },
    { key: 'enabled', label: '启用' }
  ],
  quality: [
    { key: 'id', label: '预设 ID', fixed: true },
    { key: 'name', label: '名称' },
    { key: 'quality', label: '质量' },
    { key: 'size', label: '尺寸' },
    { key: 'outputFormat', label: '格式' },
    { key: 'promptEnhance', label: '增强' },
    { key: 'useCase', label: '用途' }
  ]
}
const tableColumnVisibility = reactive<Record<TableModuleKey, Record<string, boolean>>>({
  interfaces: Object.fromEntries(tableColumnOptions.interfaces.map((item) => [item.key, true])),
  upstreams: Object.fromEntries(tableColumnOptions.upstreams.map((item) => [item.key, true])),
  models: Object.fromEntries(tableColumnOptions.models.map((item) => [item.key, true])),
  quality: Object.fromEntries(tableColumnOptions.quality.map((item) => [item.key, true]))
})
const activeTableModule = computed<TableModuleKey>(() => {
  if (activeView.value === 'upstreams') return 'upstreams'
  if (activeView.value === 'models') return 'models'
  if (activeView.value === 'quality') return 'quality'
  return 'interfaces'
})
const visibleTableColumnOptions = computed(() => tableColumnOptions[activeTableModule.value])
const tableHeaderTools = computed(() => [
  { key: 'search', icon: Search, active: isTableSearchVisible(activeTableModule.value) },
  { key: 'refresh', icon: Refresh, active: false },
  { key: 'density', icon: Operation, active: tableDensity.value === 'compact' },
  { key: 'columns', icon: More, active: false }
] as Array<{ key: TableHeaderToolKey; icon: unknown; active: boolean }>)
const emptyStateCopy = {
  interfaces: {
    title: '还没有可用接口',
    description: '新增一个 Skill/API 调用入口，配置 Key、默认模型和上游绑定后即可开始使用。',
  },
  upstreams: {
    title: '还没有上游中转站',
    description: '添加 OpenAI-compatible 上游地址和服务端 Key，再通过接口管理绑定路由。',
  },
  models: {
    title: '还没有模型目录',
    description: '维护模型能力、尺寸、质量和推荐用途，接口默认参数会优先参考这里。',
  },
  quality: {
    title: '还没有质量预设',
    description: '新增摄影、电商、海报、图标等 Prompt 模板，让生图质量更稳定。',
  },
  qualityCases: {
    title: '还没有质量案例',
    description: '在日志详情里标记质量差或优秀案例，用于持续优化 Prompt 模板。',
  },
  generationLogs: {
    title: '还没有生图日志',
    description: '完成一次图片生成或编辑调用后，这里会显示请求、上游、耗时和质量标记。',
  },
  apiLogs: {
    title: '还没有后台 API 日志',
    description: '后台配置、查询和安全相关请求会在这里留下可审计记录。',
  },
  alerts: {
    title: '当前没有活跃告警',
    description: '上游、Key、成功率、P95 和备份状态都没有触发待处理事件。',
  },
  sessions: {
    title: '还没有会话记录',
    description: '登录后台后会同步当前会话，也可以在这里退出其他会话。',
  },
  audit: {
    title: '还没有审计记录',
    description: '登录、配置保存、Key 查看、恢复配置等关键操作会进入审计日志。',
  },
  backups: {
    title: '还没有配置备份',
    description: '创建备份后可下载或恢复，系统会自动保留最近 10 个配置快照。',
  },
  versions: {
    title: '还没有配置版本',
    description: '每次保存配置前会生成快照，可用于快速恢复到旧版本。',
  },
}
const filteredInterfaces = computed(() => filterTableRows(activeInterfaces.value, tableSearch.interfaces))
const filteredUpstreams = computed(() => filterTableRows(activeUpstreams.value, tableSearch.upstreams))
const filteredModels = computed(() => filterTableRows(activeModels.value, tableSearch.models))
const filteredPresets = computed(() => filterTableRows(activePresets.value, tableSearch.quality))
const paginatedInterfaces = computed(() => paginateTableRows(filteredInterfaces.value, 'interfaces'))
const paginatedUpstreams = computed(() => paginateTableRows(filteredUpstreams.value, 'upstreams'))
const paginatedModels = computed(() => paginateTableRows(filteredModels.value, 'models'))
const paginatedPresets = computed(() => paginateTableRows(filteredPresets.value, 'quality'))
const drawerContext = computed(() => {
  if (!config.value || !drawerMode.value) return null
  if (drawerMode.value === 'interface') {
    const item = config.value.interfaces[drawerIndex.value]
    if (!item) return null
    return {
      title: item.name || item.id,
      eyebrow: '接口管理',
      description: '配置 Skill 调用 Key、默认模型参数、路由上游和请求策略。',
      enabled: item.enabled,
      id: item.id,
      meta: item.defaultImageModel || '未配置模型'
    }
  }
  if (drawerMode.value === 'upstream') {
    const item = config.value.upstreams[drawerIndex.value]
    if (!item) return null
    return {
      title: item.name || item.id,
      eyebrow: '上游管理',
      description: '维护上游中转站地址、密钥、权重和健康检查策略。',
      enabled: item.enabled,
      id: item.id,
      meta: item.baseURL || '未配置 Base URL'
    }
  }
  if (drawerMode.value === 'model') {
    const item = config.value.models[drawerIndex.value]
    if (!item) return null
    return {
      title: item.name || item.id,
      eyebrow: '模型目录',
      description: '维护模型能力、尺寸质量支持、输出格式和绑定上游。',
      enabled: item.enabled,
      id: item.id,
      meta: item.capabilities.join(' / ') || '未配置能力'
    }
  }
  const item = config.value.qualityPresets[drawerIndex.value]
  if (!item) return null
  return {
    title: item.name || item.id,
    eyebrow: '生图质量',
    description: '维护质量预设、Prompt 模板和默认出图参数。',
    enabled: true,
    id: item.id,
    meta: `${item.quality || 'auto'} · ${item.size || '默认尺寸'}`
  }
})
const drawerStatusCards = computed(() => {
  const context = drawerContext.value
  if (!context || !drawerMode.value || !config.value) return []
  if (drawerMode.value === 'interface') {
    const item = config.value.interfaces[drawerIndex.value]
    return [
      { label: '状态', value: item.enabled ? '启用' : '禁用', type: item.enabled ? 'success' : 'warning' },
      { label: 'Key', value: item.apiTokenSet || item.apiToken ? '已配置' : '缺失', type: item.apiTokenSet || item.apiToken ? 'success' : 'critical' },
      { label: '上游', value: item.upstreamIds.length, type: item.upstreamIds.length ? 'info' : 'warning' },
      { label: '限流', value: `${item.rateLimitPerMinute}/min`, type: 'info' }
    ]
  }
  if (drawerMode.value === 'upstream') {
    const item = config.value.upstreams[drawerIndex.value]
    return [
      { label: '状态', value: item.enabled ? '参与' : '停用', type: item.enabled ? 'success' : 'warning' },
      { label: 'Key', value: item.apiKeySet || item.apiKey ? '已配置' : '缺失', type: item.apiKeySet || item.apiKey ? 'success' : 'critical' },
      { label: '优先级', value: item.priority, type: 'info' },
      { label: '权重', value: item.weight, type: 'info' }
    ]
  }
  if (drawerMode.value === 'model') {
    const item = config.value.models[drawerIndex.value]
    return [
      { label: '状态', value: item.enabled ? '启用' : '禁用', type: item.enabled ? 'success' : 'warning' },
      { label: '能力', value: item.capabilities.length, type: 'info' },
      { label: '尺寸', value: item.sizes.length, type: 'info' },
      { label: '质量', value: item.qualities.length, type: 'info' }
    ]
  }
  const item = config.value.qualityPresets[drawerIndex.value]
  return [
    { label: '质量', value: item.quality || 'auto', type: 'info' },
    { label: '尺寸', value: item.size || '默认', type: 'info' },
    { label: '格式', value: item.outputFormat || 'png', type: 'info' },
    { label: '增强', value: item.promptEnhance ? '开启' : '关闭', type: item.promptEnhance ? 'warning' : 'success' }
  ]
})
const alertsForm = computed<AlertsConfig>(() => config.value?.alerts || {
  webhookEnabled: false,
  webhookURL: '',
  upstreamFailureThreshold: 3,
  successRateThreshold: 90,
  p95LatencyMsThreshold: 30000
})
const securityForm = computed(() => config.value?.security || {
  ipAllowlist: [],
  totpEnabled: false,
  totpConfigured: false,
  failedLoginLockoutEnabled: true
})
const loginHistoryRows = computed(() => auditLogs.value.filter((item) => item.action.startsWith('auth.')).slice(0, 8))
const securityScore = computed(() => {
  let score = 25
  if (securityForm.value.totpEnabled) score += 25
  else if (securityForm.value.totpConfigured) score += 12
  if (securityForm.value.failedLoginLockoutEnabled) score += 20
  if (securityForm.value.ipAllowlist.length) score += 18
  if (sessions.value.some((item) => item.current)) score += 7
  const criticalPenalty = Math.min(15, alertSummary.value.critical * 5)
  return Math.max(0, Math.min(100, score - criticalPenalty))
})
const securitySummaryCards = computed(() => [
  {
    label: '二次验证',
    value: securityForm.value.totpEnabled ? '已启用' : securityForm.value.totpConfigured ? '待验证' : '未启用',
    hint: securityForm.value.totpEnabled ? '登录需要动态验证码' : '建议为后台账号启用 TOTP',
    type: securityForm.value.totpEnabled ? 'success' : 'warning'
  },
  {
    label: 'IP 白名单',
    value: securityForm.value.ipAllowlist.length,
    hint: securityForm.value.ipAllowlist.length ? '限制后台来源地址' : '当前允许任意来源登录',
    type: securityForm.value.ipAllowlist.length ? 'success' : 'info'
  },
  {
    label: '活跃会话',
    value: sessions.value.length,
    hint: sessions.value.some((item) => item.current) ? '当前会话已识别' : '等待会话同步',
    type: sessions.value.length > 1 ? 'warning' : 'info'
  },
  {
    label: '认证审计',
    value: loginHistoryRows.value.length,
    hint: securityForm.value.failedLoginLockoutEnabled ? '失败登录锁定已开启' : '失败登录锁定未开启',
    type: securityForm.value.failedLoginLockoutEnabled ? 'success' : 'warning'
  }
])
const latestBackup = computed(() => backups.value[0] || null)
const systemSummaryCards = computed(() => [
  {
    label: '配置备份',
    value: backups.value.length,
    hint: latestBackup.value ? `最近 ${formatTime(latestBackup.value.createdAt)}` : '暂无保留备份',
    type: backups.value.length ? 'success' : 'warning'
  },
  {
    label: '版本快照',
    value: versions.value.length,
    hint: versions.value[0]?.summary || '等待配置变更',
    type: versions.value.length ? 'info' : 'warning'
  },
  {
    label: '更新状态',
    value: updateInfo.value.status || 'unknown',
    hint: updateInfo.value.latestVersion ? `最新 ${updateInfo.value.latestVersion}` : '等待更新检查',
    type: updateInfo.value.status === 'outdated' ? 'warning' : 'info'
  },
  {
    label: '回滚入口',
    value: updateInfo.value.rollbackCommand ? '可用' : '未配置',
    hint: updateInfo.value.dockerImageTag || updateInfo.value.currentCommit || '等待版本元数据',
    type: updateInfo.value.rollbackCommand ? 'success' : 'info'
  }
])
const pendingAlertCount = computed(() => activeAlerts.value.filter((item) => !item.acknowledged).length)
const notificationTabs = computed(() => [
  { key: 'alerts', label: '告警', count: pendingAlertCount.value },
  { key: 'notifications', label: '通知', count: alertNotification.value.status === 'idle' ? 0 : 1 },
  { key: 'system', label: '系统', count: updateInfo.value.status ? 1 : 0 },
] as Array<{ key: 'alerts' | 'notifications' | 'system'; label: string; count: number }>)
const notificationPreviewItems = computed(() => {
  if (activeNotificationTab.value === 'alerts') {
    return activeAlerts.value
      .filter((item) => !item.acknowledged)
      .slice(0, 6)
      .map((item) => ({
        id: item.id,
        title: item.title,
        time: formatTime(item.createdAt),
        meta: item.message,
        type: item.severity === 'critical' ? 'critical' : item.severity === 'warning' ? 'warning' : 'info',
      }))
  }
  if (activeNotificationTab.value === 'notifications') {
    return [{
      id: 'alert-webhook-status',
      title: `Webhook ${notificationLabel(alertNotification.value.status)}`,
      time: alertNotification.value.sentAt ? formatTime(alertNotification.value.sentAt) : '未发送',
      meta: config.value?.alerts.webhookURLSet ? '告警通知通道已配置' : 'Webhook 通知未配置',
      type: alertNotification.value.status === 'failed' ? 'critical' : alertNotification.value.status === 'sent' ? 'success' : 'info',
    }]
  }
  return [{
    id: 'system-update-status',
    title: `版本状态 ${updateInfo.value.status || 'unknown'}`,
    time: updateInfo.value.status ? '已检查' : '等待检查',
    meta: updateInfo.value.latestVersion ? `最新版本 ${updateInfo.value.latestVersion}` : '未获取到更新信息',
    type: updateInfo.value.status === 'outdated' ? 'warning' : 'info',
  }]
})
const alertSummaryCards = computed(() => [
  {
    label: '活跃告警',
    value: alertSummary.value.total,
    hint: `已确认 ${alertSummary.value.acknowledged}`,
    type: alertSummary.value.total ? 'warning' : 'success'
  },
  {
    label: '严重事件',
    value: alertSummary.value.critical,
    hint: 'Key、配置和可用性风险',
    type: alertSummary.value.critical ? 'critical' : 'success'
  },
  {
    label: '待处理',
    value: pendingAlertCount.value,
    hint: pendingAlertCount.value ? '需要人工确认' : '队列已处理',
    type: pendingAlertCount.value ? 'warning' : 'success'
  },
  {
    label: '通知状态',
    value: notificationLabel(alertNotification.value.status),
    hint: alertNotification.value.sentAt ? formatTime(alertNotification.value.sentAt) : (config.value?.alerts.webhookURLSet ? '等待新告警' : 'Webhook 未配置'),
    type: alertNotification.value.status === 'failed' ? 'critical' : alertNotification.value.status === 'sent' ? 'success' : 'info'
  }
])
const filteredGenerationLogs = computed(() => filterLogs(generationLogs.value))
const filteredApiLogs = computed(() => filterLogs(apiLogs.value))
const logSummaryCards = computed(() => {
  const failedGenerations = generationLogs.value.filter((item) => item.status === 'failed' || Number(item.status) >= 400).length
  const failedApis = apiLogs.value.filter((item) => item.status === 'failed' || Number(item.status) >= 400).length
  return [
    { label: '生图日志', value: generationLogs.value.length, hint: `失败 ${failedGenerations}`, type: failedGenerations ? 'warning' : 'success' },
    { label: '后台 API', value: apiLogs.value.length, hint: `失败 ${failedApis}`, type: failedApis ? 'warning' : 'success' },
    { label: '筛选命中', value: filteredGenerationLogs.value.length + filteredApiLogs.value.length, hint: '当前查询结果', type: 'info' },
    { label: '质量案例', value: qualityCases.value.length, hint: '差评与优秀沉淀', type: 'info' }
  ]
})
const logSearchFields = computed(() => [
  { key: 'keyword', label: '关键词', span: 'wide' },
  { key: 'status', label: '状态' },
  { key: 'interfaceId', label: '接口' },
  { key: 'upstreamId', label: '上游' },
  { key: 'model', label: '模型' },
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'requestId', label: '请求 ID' },
  { key: 'from', label: '开始时间' },
  { key: 'to', label: '结束时间' },
  { key: 'statusMin', label: '状态≥' },
  { key: 'statusMax', label: '状态≤' },
  { key: 'minDurationMs', label: '耗时≥ms' },
  { key: 'maxDurationMs', label: '耗时≤ms' }
])
const visibleLogSearchFields = computed(() => logSearchExpanded.value
  ? logSearchFields.value
  : logSearchFields.value.slice(0, 4))
const hiddenLogSearchFieldCount = computed(() => Math.max(0, logSearchFields.value.length - visibleLogSearchFields.value.length))
const usageSummaryCards = computed(() => {
  const total = usage.value?.total
  const failureCount = Number(total?.failed || 0)
  return [
    {
      label: '总调用',
      value: Number(total?.total || 0),
      hint: `成功 ${Number(total?.success || 0)} / 失败 ${failureCount}`,
      type: failureCount ? 'warning' : 'success'
    },
    {
      label: '估算成本',
      value: formatCost(total?.estimatedCostUSD),
      hint: `图片 ${Number(total?.imageCount || 0)} 张`,
      type: Number(total?.estimatedCostUSD || 0) > 0 ? 'info' : 'success'
    },
    {
      label: '成功率',
      value: formatPercent(total?.successRate),
      hint: failureCount ? '需要关注失败调用' : '当前调用稳定',
      type: Number(total?.successRate || 0) >= 95 || !Number(total?.total || 0) ? 'success' : 'warning'
    },
    {
      label: '平均耗时',
      value: formatDuration(total?.averageDurationMs),
      hint: `累计 ${formatDuration(total?.durationMs)}`,
      type: Number(total?.averageDurationMs || 0) > 60000 ? 'warning' : 'info'
    }
  ]
})
const usageInterfaceRows = computed(() => usageRows(usage.value?.byInterface))
const usageModelRows = computed(() => usageRows(usage.value?.byModel))
const usageUpstreamRows = computed(() => usageRows(usage.value?.byUpstream))
const usageDateRows = computed(() => usageRows(usage.value?.byDate).sort((left, right) => right.name.localeCompare(left.name)))
const usageCostLeaders = computed(() => [
  ...usageModelRows.value.map((item) => ({ ...item, scope: '模型' })),
  ...usageInterfaceRows.value.map((item) => ({ ...item, scope: '接口' })),
  ...usageUpstreamRows.value.map((item) => ({ ...item, scope: '上游' }))
].sort((left, right) => Number(right.estimatedCostUSD || 0) - Number(left.estimatedCostUSD || 0)).slice(0, 6))
const usageEfficiencyRows = computed(() => {
  const rows = usageUpstreamRows.value.length ? usageUpstreamRows.value : usageModelRows.value
  return rows
    .map((item) => ({
      ...item,
      healthLabel: Number(item.successRate || 0) >= 95 ? '稳定' : Number(item.successRate || 0) >= 80 ? '波动' : '异常',
      healthType: Number(item.successRate || 0) >= 95 ? 'success' : Number(item.successRate || 0) >= 80 ? 'warning' : 'danger'
    }))
    .sort((left, right) => Number(right.averageDurationMs || 0) - Number(left.averageDurationMs || 0))
    .slice(0, 5)
})
const usageTrendBars = computed(() => {
  const rows = usageRows(usage.value?.byDate).sort((left, right) => left.name.localeCompare(right.name)).slice(-7)
  const maxTotal = Math.max(1, ...rows.map((item) => item.total))
  return rows.map((item) => ({
    ...item,
    shortName: item.name.slice(5),
    height: Math.max(8, Math.round((item.total / maxTotal) * 100))
  }))
})
const statusDistribution = computed(() => {
  const total = Math.max(1, Number(metrics.value?.generations.total || 0))
  const success = Number(metrics.value?.generations.success || 0)
  const failed = Number(metrics.value?.generations.failed || metrics.value?.generations.error || 0)
  return [
    { label: '成功', count: success, percent: Math.round((success / total) * 100), className: 'success' },
    { label: '失败', count: failed, percent: Math.round((failed / total) * 100), className: 'failed' }
  ]
})
const logDetailSummaryCards = computed(() => {
  const record = selectedLog.value
  if (!record) return []
  const statusText = String(record.status || '-')
  const failed = statusText === 'failed' || Number(statusText) >= 400
  return [
    { label: '请求状态', value: statusText, hint: record.upstreamStatus ? `上游 ${record.upstreamStatus}` : '等待上游记录', type: failed ? 'critical' : 'success' },
    { label: '耗时', value: formatDuration(record.durationMs), hint: `${record.retryCount || 0} 次重试`, type: Number(record.durationMs || 0) > 60000 ? 'warning' : 'info' },
    { label: '接口', value: record.interfaceId || '-', hint: record.model || '未记录模型', type: 'info' },
    { label: '上游', value: record.upstreamId || '-', hint: record.endpoint || record.path || '-', type: record.upstreamId ? 'info' : 'warning' }
  ]
})
const logDetailRouteSteps = computed(() => {
  const record = selectedLog.value
  if (!record) return []
  const chain = Array.isArray(record.failoverChain) && record.failoverChain.length
    ? record.failoverChain
    : [record.upstreamId || '未记录上游']
  return chain.map((item, index) => ({
    name: item,
    index: index + 1,
    active: item === record.upstreamId || index === chain.length - 1,
    hint: index === 0 ? '首选路由' : '故障转移'
  }))
})
const unhealthyUpstreams = computed(() => upstreamHealth.value.filter((item) => {
  if (!item.enabled) return false
  const rate = Number(item.metrics?.successRate || 0)
  return rate < 90 || Boolean(item.metrics?.lastFailureReason)
}))
const missingKeyCount = computed(() => {
  const interfaceMissing = activeInterfaces.value.filter((item) => item.enabled && !item.apiTokenSet && !item.apiToken).length
  const upstreamMissing = activeUpstreams.value.filter((item) => item.enabled && !item.apiKeySet && !item.apiKey).length
  return interfaceMissing + upstreamMissing
})
const dashboardSummaryCards = computed(() => [
  {
    label: '今日生图',
    value: metricValue(metrics.value?.generations.today),
    hint: `成功率 ${metricValue(metrics.value?.generations.successRate)}%`,
    icon: MagicStick,
    tone: 'primary'
  },
  {
    label: '错误率',
    value: `${metricValue(metrics.value?.generations.errorRate)}%`,
    hint: `失败 ${metricValue(metrics.value?.generations.failed)}`,
    icon: WarningFilled,
    tone: 'danger'
  },
  {
    label: 'P95',
    value: formatDuration(metrics.value?.generations.p95DurationMs),
    hint: `P99 ${formatDuration(metrics.value?.generations.p99DurationMs)}`,
    icon: Timer,
    tone: 'warning'
  },
  {
    label: '当前并发',
    value: metricValue(metrics.value?.activeRequests),
    hint: `接口上限 ${config.value?.maxConcurrentRequests || 0}`,
    icon: Monitor,
    tone: 'success'
  }
])
const quickActions = computed(() => [
  { label: '保存配置', icon: Finished, type: 'primary', action: () => saveConfig() },
  { label: '测试上游', icon: Aim, type: 'default', action: () => navigateTo('upstreams') },
  { label: '查看日志', icon: Document, type: 'default', action: () => navigateTo('logs') },
  { label: '创建备份', icon: Download, type: 'default', action: () => createBackup() }
])
const riskItems = computed(() => [
  {
    label: '活跃告警',
    value: alertSummary.value.total,
    severity: alertSummary.value.critical ? 'critical' : alertSummary.value.warning ? 'warning' : 'info',
    hint: `${alertSummary.value.critical} 个严重 / ${alertSummary.value.warning} 个警告`,
    target: 'alerts' as ViewKey
  },
  {
    label: '上游风险',
    value: unhealthyUpstreams.value.length,
    severity: unhealthyUpstreams.value.length ? 'warning' : 'info',
    hint: unhealthyUpstreams.value[0]?.metrics.lastFailureReason || '健康检查正常',
    target: 'upstreams' as ViewKey
  },
  {
    label: 'Key 缺失',
    value: missingKeyCount.value,
    severity: missingKeyCount.value ? 'critical' : 'info',
    hint: missingKeyCount.value ? '存在启用项未配置 Key' : '接口与上游 Key 已配置',
    target: 'interfaces' as ViewKey
  },
  {
    label: '版本状态',
    value: updateInfo.value.status || 'unknown',
    severity: updateInfo.value.status === 'outdated' ? 'warning' : 'info',
    hint: updateInfo.value.latestVersion ? `最新 ${updateInfo.value.latestVersion}` : '等待更新检查',
    target: 'system' as ViewKey
  }
])
const poorQualityCases = computed(() => qualityCases.value.filter((item) => item.label === 'poor'))
const excellentQualityCases = computed(() => qualityCases.value.filter((item) => item.label === 'excellent'))
const qualitySummaryCards = computed(() => [
  {
    label: '质量预设',
    value: activePresets.value.length,
    hint: '可绑定到接口默认参数',
    icon: MagicStick,
    tone: 'primary'
  },
  {
    label: '质量差案例',
    value: poorQualityCases.value.length,
    hint: '用于修正模板与参数',
    icon: WarningFilled,
    tone: 'danger'
  },
  {
    label: '优秀案例',
    value: excellentQualityCases.value.length,
    hint: '用于沉淀高质量提示词',
    icon: Finished,
    tone: 'success'
  },
  {
    label: '增强开关',
    value: activePresets.value.filter((item) => item.promptEnhance).length,
    hint: '默认关闭，按预设启用',
    icon: SwitchButton,
    tone: 'warning'
  }
] as Array<{ label: string; value: number; hint: string; icon: unknown; tone: 'primary' | 'danger' | 'success' | 'warning' }>)
const qualityCaseByRecordId = computed(() => {
  const map = new Map<string, QualityCase[]>()
  for (const item of qualityCases.value) {
    const list = map.get(item.recordId) || []
    list.push(item)
    map.set(item.recordId, list)
  }
  return map
})

function formatTime(value?: string) {
  if (!value) return '未记录'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', { hour12: false })
}

function formatDuration(value?: number) {
  const ms = Number(value || 0)
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

function formatCost(value?: number) {
  return `$${Number(value || 0).toFixed(4)}`
}

function formatPercent(value?: number) {
  return `${Number(value || 0).toFixed(2)}%`
}

function notificationLabel(value?: string) {
  if (value === 'sent') return '已发送'
  if (value === 'failed') return '失败'
  return '待触发'
}

function metricValue(value?: number) {
  return Number.isFinite(Number(value)) ? String(value) : '0'
}

function usageRows(group?: Record<string, UsageBucket>) {
  return Object.entries(group || {}).map(([name, value]) => ({ name, ...value }))
}

function filterTableRows<T>(rows: T[], keyword: string) {
  const normalized = String(keyword || '').trim().toLowerCase()
  if (!normalized) return rows
  return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(normalized))
}

function paginateTableRows<T>(rows: T[], module: TableModuleKey) {
  const pagination = tablePagination[module]
  const currentPage = tableEffectiveCurrentPage(module, rows.length)
  const start = (currentPage - 1) * pagination.pageSize
  return rows.slice(start, start + pagination.pageSize)
}

function tableEffectiveCurrentPage(module: TableModuleKey, total: number) {
  const pagination = tablePagination[module]
  const maxPage = Math.max(1, Math.ceil(total / pagination.pageSize))
  return Math.min(Math.max(1, pagination.currentPage), maxPage)
}

function handleTablePageSizeChange(module: TableModuleKey, pageSize: number) {
  tablePagination[module].pageSize = pageSize
  tablePagination[module].currentPage = 1
}

function handleTableCurrentPageChange(module: TableModuleKey, currentPage: number) {
  tablePagination[module].currentPage = currentPage
}

function rowIndex<T extends { id?: string }>(rows: T[], row: T) {
  if (!row?.id) return rows.indexOf(row)
  const index = rows.findIndex((item) => item.id === row.id)
  return index >= 0 ? index : rows.indexOf(row)
}

function qualityCaseTag(recordId: string, label: 'poor' | 'excellent') {
  return qualityCaseByRecordId.value.get(recordId)?.some((item) => item.label === label) || false
}

function qualityCaseLabel(label: 'poor' | 'excellent') {
  return label === 'poor' ? '质量差' : '优秀'
}

function upstreamNames(ids: string[] = []) {
  if (!ids.length) return '未绑定'
  const names = ids.map((id) => activeUpstreams.value.find((item) => item.id === id)?.name || id)
  return names.join(', ')
}

function upstreamHealthFor(id?: string) {
  return upstreamHealth.value.find((item) => item.id === id)
}

function emptyState(key: keyof typeof emptyStateCopy) {
  return emptyStateCopy[key]
}

function alertTagType(severity: string) {
  if (severity === 'critical') return 'danger'
  if (severity === 'warning') return 'warning'
  return 'info'
}

function riskClass(severity: string) {
  if (severity === 'critical') return 'critical'
  if (severity === 'warning') return 'warning'
  return 'info'
}

function navigateTo(key: ViewKey) {
  activeView.value = key
  if (!pageTabs.value.includes(key)) {
    pageTabs.value = compactPageTabs([...pageTabs.value, key])
  }
  workTabTarget.value = key
  closeMobileMenu()
}

function selectHeaderSearch(key: ViewKey) {
  navigateTo(key)
  closeGlobalSearch()
}

function syncViewportWidth() {
  viewportWidth.value = window.innerWidth
  if (!isMobileMenuMode.value) {
    mobileMenuVisible.value = false
    if (!menuOpen.value) menuOpen.value = true
  }
}

function toggleMenuVisibility() {
  if (isMobileMenuMode.value) {
    mobileMenuVisible.value = !mobileMenuVisible.value
    menuOpen.value = mobileMenuVisible.value
    return
  }
  menuOpen.value = !menuOpen.value
  mobileMenuVisible.value = false
}

function closeMobileMenu() {
  if (!isMobileMenuMode.value) return
  mobileMenuVisible.value = false
  menuOpen.value = false
}

function openGlobalSearch() {
  notificationPanelVisible.value = false
  globalSearchVisible.value = true
  nextTick(() => {
    globalSearchInputRef.value?.focus?.()
  })
}

function closeGlobalSearch() {
  globalSearchVisible.value = false
  headerSearchKeyword.value = ''
  highlightedSearchIndex.value = 0
}

function moveSearchHighlight(step: number) {
  const count = headerSearchResults.value.length
  if (!count) return
  highlightedSearchIndex.value = (highlightedSearchIndex.value + step + count) % count
}

function selectHighlightedSearch() {
  const item = headerSearchResults.value[highlightedSearchIndex.value]
  if (item) selectHeaderSearch(item.key)
}

function handleGlobalSearchKeydown(event: KeyboardEvent) {
  const isCommandKey = event.ctrlKey || event.metaKey
  if (isCommandKey && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    openGlobalSearch()
    return
  }
  if (!globalSearchVisible.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeGlobalSearch()
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveSearchHighlight(1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveSearchHighlight(-1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    selectHighlightedSearch()
  }
}

function openNotifications() {
  notificationPanelVisible.value = true
}

function toggleNotificationPanel() {
  notificationPanelVisible.value = !notificationPanelVisible.value
}

function openSettings() {
  notificationPanelVisible.value = false
  settingsPanelVisible.value = true
}

function viewAllNotifications() {
  notificationPanelVisible.value = false
  navigateTo('alerts')
}

function closeSettingsPanel() {
  settingsPanelVisible.value = false
}

function persistSettings() {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('image-studio-admin-theme', themeMode.value)
  window.localStorage.setItem('image-studio-admin-layout', layoutMode.value)
  window.localStorage.setItem('image-studio-admin-menu-style', menuStyleMode.value)
  window.localStorage.setItem('image-studio-admin-table-density', tableDensity.value)
}

function applySettingsPreset(group: SettingOptionGroup, value: string) {
  if (group === 'theme' && (value === 'light' || value === 'dark')) {
    themeMode.value = value
  }
  if (group === 'layout' && (value === 'left' || value === 'compact' || value === 'wide')) {
    layoutMode.value = value
  }
  if (group === 'menuStyle' && (value === 'design' || value === 'dark' || value === 'light')) {
    menuStyleMode.value = value
  }
  if (group === 'density' && (value === 'default' || value === 'comfortable' || value === 'compact')) {
    tableDensity.value = value
  }
  persistSettings()
}

function resetSettingsPanel() {
  themeMode.value = 'light'
  layoutMode.value = 'left'
  menuStyleMode.value = 'design'
  tableDensity.value = 'comfortable'
  persistSettings()
}

function isPageTabFixed(key: ViewKey) {
  return fixedPageTabs.value.includes(key)
}

function compactPageTabs(keys: ViewKey[]) {
  const unique = Array.from(new Set(keys))
  const pinned = fixedPageTabs.value.filter((key) => unique.includes(key))
  const floating = unique.filter((key) => !pinned.includes(key))
  const maxFloating = Math.max(1, 8 - pinned.length)
  return [...pinned, ...floating.slice(-maxFloating)]
}

function setWorkTabTarget(key: ViewKey) {
  workTabTarget.value = key
}

function closePageTab(key: ViewKey) {
  if (isPageTabFixed(key)) return
  const nextTabs = pageTabs.value.filter((item) => item !== key)
  pageTabs.value = nextTabs.length ? nextTabs : ['dashboard']
  if (activeView.value === key) {
    activeView.value = pageTabs.value[pageTabs.value.length - 1] || 'dashboard'
  }
  workTabTarget.value = activeView.value
}

function toggleFixedPageTab(key: ViewKey) {
  if (key === 'dashboard') return
  fixedPageTabs.value = isPageTabFixed(key)
    ? fixedPageTabs.value.filter((item) => item !== key)
    : [...fixedPageTabs.value, key]
  pageTabs.value = compactPageTabs(pageTabs.value)
}

function closePageTabsToLeft(key: ViewKey) {
  const index = pageTabs.value.indexOf(key)
  if (index <= 0) return
  pageTabs.value = pageTabs.value.filter((item, itemIndex) => itemIndex >= index || isPageTabFixed(item))
  if (!pageTabs.value.includes(activeView.value)) activeView.value = key
  workTabTarget.value = activeView.value
}

function closePageTabsToRight(key: ViewKey) {
  const index = pageTabs.value.indexOf(key)
  if (index < 0) return
  pageTabs.value = pageTabs.value.filter((item, itemIndex) => itemIndex <= index || isPageTabFixed(item))
  if (!pageTabs.value.includes(activeView.value)) activeView.value = key
  workTabTarget.value = activeView.value
}

function closeOtherPageTabs(key: ViewKey) {
  pageTabs.value = pageTabs.value.filter((item) => item === key || isPageTabFixed(item))
  if (!pageTabs.value.includes(activeView.value)) activeView.value = key
  workTabTarget.value = activeView.value
}

function closeAllPageTabs() {
  pageTabs.value = fixedPageTabs.value.length ? [...fixedPageTabs.value] : ['dashboard']
  if (!pageTabs.value.includes(activeView.value)) activeView.value = pageTabs.value[0] || 'dashboard'
  workTabTarget.value = activeView.value
}

async function refreshCurrentPageTab() {
  if (activeView.value === 'logs') await refreshLogsOnly()
  else await refreshAll()
  await reloadPageContent()
}

async function reloadPageContent() {
  pageContentRefreshing.value = false
  showPageTransitionMask.value = true
  await nextTick()
  pageContentRefreshing.value = true
  window.setTimeout(() => {
    showPageTransitionMask.value = false
  }, 120)
}

async function runWorkTabAction(key: WorkTabActionKey) {
  const target = workTabTarget.value || activeView.value
  if (key === 'refresh') await refreshCurrentPageTab()
  if (key === 'fixed') toggleFixedPageTab(target)
  if (key === 'left') closePageTabsToLeft(target)
  if (key === 'right') closePageTabsToRight(target)
  if (key === 'other') closeOtherPageTabs(target)
  if (key === 'all') closeAllPageTabs()
}

function loadThemeMode() {
  if (typeof window === 'undefined') return
  const stored = window.localStorage.getItem('image-studio-admin-theme')
  themeMode.value = stored === 'dark' ? 'dark' : 'light'
  const storedLayout = window.localStorage.getItem('image-studio-admin-layout')
  layoutMode.value = storedLayout === 'compact' || storedLayout === 'wide' ? storedLayout : 'left'
  const storedMenuStyle = window.localStorage.getItem('image-studio-admin-menu-style')
  menuStyleMode.value = storedMenuStyle === 'dark' || storedMenuStyle === 'light' ? storedMenuStyle : 'design'
  const storedDensity = window.localStorage.getItem('image-studio-admin-table-density')
  tableDensity.value = storedDensity === 'default' || storedDensity === 'compact' ? storedDensity : 'comfortable'
}

function toggleTheme() {
  themeMode.value = themeMode.value === 'dark' ? 'light' : 'dark'
  persistSettings()
}

async function toggleFullscreen() {
  if (typeof document === 'undefined') return
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await document.documentElement.requestFullscreen()
    }
  } catch {
    ElMessage.warning('当前浏览器不支持全屏切换')
  }
}

function filterLogs(records: LogRecord[]) {
  const keyword = logFilter.keyword.trim().toLowerCase()
  return records.filter((record) => {
    const matchesKeyword = !keyword || JSON.stringify(record).toLowerCase().includes(keyword)
    return matchesKeyword
  })
}

function tableHeaderToolLabel(key: TableHeaderToolKey) {
  const labels: Record<TableHeaderToolKey, string> = {
    search: '搜索',
    refresh: '刷新',
    density: '密度',
    columns: '列设置'
  }
  return labels[key]
}

function handleTableHeaderTool(key: TableHeaderToolKey) {
  if (key === 'search') {
    toggleTableSearchVisible()
    return
  }
  if (key === 'refresh') {
    refreshAll()
    return
  }
  if (key === 'density') {
    tableDensity.value = tableDensity.value === 'compact' ? 'comfortable' : 'compact'
    persistSettings()
    return
  }
  if (key === 'columns') {
    tableColumnSettingsVisible.value = true
  }
}

function isTableSearchVisible(module: TableModuleKey) {
  return tableSearchVisible[module] !== false
}

function toggleTableSearchVisible(module: TableModuleKey = activeTableModule.value) {
  tableSearchVisible[module] = !isTableSearchVisible(module)
}

function isTableColumnVisible(module: TableModuleKey, key: string) {
  return tableColumnVisibility[module]?.[key] !== false
}

function toggleTableColumn(key: string, value: boolean | string | number) {
  const option = visibleTableColumnOptions.value.find((item) => item.key === key)
  if (option?.fixed) return
  tableColumnVisibility[activeTableModule.value][key] = !!value
}

function resetTableColumns() {
  for (const item of visibleTableColumnOptions.value) {
    tableColumnVisibility[activeTableModule.value][item.key] = true
  }
}

function toggleLogSearchExpanded() {
  logSearchExpanded.value = !logSearchExpanded.value
}

function logQuery() {
  return {
    status: logFilter.status,
    interfaceId: logFilter.interfaceId,
    upstreamId: logFilter.upstreamId,
    model: logFilter.model,
    endpoint: logFilter.endpoint,
    requestId: logFilter.requestId,
    from: logFilter.from,
    to: logFilter.to,
    statusMin: logFilter.statusMin,
    statusMax: logFilter.statusMax,
    minDurationMs: logFilter.minDurationMs,
    maxDurationMs: logFilter.maxDurationMs
  }
}

function setConfig(next: AdminConfig) {
  config.value = structuredClone(next)
  lastSavedConfig.value = JSON.stringify(config.value)
  accountForm.username = next.adminUsername || username.value
  totpSetup.value = null
  totpCode.value = ''
}

function markSaved() {
  if (config.value) lastSavedConfig.value = JSON.stringify(config.value)
}

function createInterface(): StudioInterface {
  const index = activeInterfaces.value.length + 1
  return {
    id: `interface-${index}`,
    name: `接口 ${index}`,
    enabled: true,
    apiTokenSet: false,
    apiToken: '',
    upstreamIds: activeUpstreams.value[0]?.id ? [activeUpstreams.value[0].id] : [],
    defaultImageModel: 'gpt-image-2',
    defaultTextModel: 'gpt-5.5',
    defaultSize: '1024x1024',
    defaultQuality: 'high',
    defaultOutputFormat: 'png',
    qualityPresetId: activePresets.value[0]?.id || 'high-quality-final',
    requestTimeoutSeconds: 120,
    maxConcurrentRequests: 1,
    rateLimitPerMinute: 10,
    lastUsedAt: ''
  }
}

function createUpstream(): StudioUpstream {
  const index = activeUpstreams.value.length + 1
  return {
    id: `upstream-${index}`,
    name: `上游 ${index}`,
    enabled: true,
    baseURL: '',
    apiKeySet: false,
    apiKey: '',
    priority: 100,
    weight: 1,
    healthCheckEnabled: true
  }
}

function createModel(): StudioModel {
  return {
    id: `model-${activeModels.value.length + 1}`,
    name: '新模型',
    enabled: true,
    capabilities: ['generate'],
    sizes: ['1024x1024'],
    qualities: ['high', 'medium', 'low'],
    defaultOutputFormat: 'png',
    recommendedUse: '自定义模型用途',
    upstreamIds: activeUpstreams.value[0]?.id ? [activeUpstreams.value[0].id] : []
  }
}

function createPreset(): QualityPreset {
  return {
    id: `preset-${activePresets.value.length + 1}`,
    name: '新质量预设',
    quality: 'high',
    size: '1024x1024',
    outputFormat: 'png',
    promptEnhance: false,
    template: '主体清晰，细节完整，避免低清晰度和杂乱背景。',
    useCase: '自定义生图场景'
  }
}

async function bootstrap() {
  loading.value = true
  try {
    const session = await adminApi.session()
    authenticated.value = session.authenticated
    username.value = session.account?.username || 'admin'
    if (session.authenticated) await refreshAll()
  } finally {
    loading.value = false
  }
}

async function refreshAll() {
  loading.value = true
  try {
    const [configData, metricData, generationData, apiData, usageData, versionData, backupData, auditData, sessionData, updateData, qualityCaseData, upstreamHealthData, activeAlertData] = await Promise.all([
      adminApi.config(),
      adminApi.metrics(),
      adminApi.logs('generations', logQuery()),
      adminApi.logs('api', logQuery()),
      adminApi.usage().catch(() => ({ usage: null })),
      adminApi.versions().catch(() => ({ versions: [] })),
      adminApi.backups().catch(() => ({ backups: [] })),
      adminApi.auditLogs().catch(() => ({ records: [] })),
      adminApi.sessions().catch(() => ({ sessions: [] })),
      adminApi.updateCheck().catch(() => ({ update: {} })),
      adminApi.qualityCases().catch(() => ({ qualityCases: [] })),
      adminApi.upstreamHealth().catch(() => ({ upstreams: [] })),
      adminApi.activeAlerts().catch(() => ({ alerts: [], summary: { total: 0, critical: 0, warning: 0, info: 0, acknowledged: 0 }, notification: { status: 'idle' as const } }))
    ])
    setConfig(configData.config)
    metrics.value = metricData.metrics
    generationLogs.value = generationData.records
    apiLogs.value = apiData.records
    usage.value = usageData.usage
    versions.value = versionData.versions
    backups.value = backupData.backups
    auditLogs.value = auditData.records
    sessions.value = sessionData.sessions
    updateInfo.value = updateData.update
    qualityCases.value = qualityCaseData.qualityCases
    upstreamHealth.value = upstreamHealthData.upstreams
    activeAlerts.value = activeAlertData.alerts
    alertSummary.value = activeAlertData.summary
    alertNotification.value = activeAlertData.notification
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '刷新失败')
  } finally {
    loading.value = false
  }
}

async function login() {
  loading.value = true
  try {
    const result = await adminApi.login(loginForm.username, loginForm.password, loginForm.totpCode)
    authenticated.value = true
    username.value = result.account.username
    loginForm.password = ''
    loginForm.totpCode = ''
    await refreshAll()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '登录失败')
  } finally {
    loading.value = false
  }
}

async function logout() {
  await adminApi.logout().catch(() => undefined)
  authenticated.value = false
  config.value = null
}

async function saveConfig(message = '配置已保存') {
  if (!config.value) return
  const result = await adminApi.saveConfig(config.value)
  setConfig(result.config)
  markSaved()
  ElMessage.success(message)
}

function openDrawer(mode: Exclude<DrawerMode, null>, index: number) {
  drawerMode.value = mode
  drawerIndex.value = index
  drawerVisible.value = true
}

function closeDrawer() {
  drawerVisible.value = false
  drawerMode.value = null
  drawerIndex.value = -1
}

function drawerTitle() {
  if (drawerMode.value === 'interface') return '编辑接口'
  if (drawerMode.value === 'upstream') return '编辑上游'
  if (drawerMode.value === 'model') return '编辑模型'
  if (drawerMode.value === 'quality') return '编辑质量预设'
  return '编辑'
}

async function saveDrawer() {
  await saveConfig('保存成功')
  closeDrawer()
}

async function copyText(text: string, message: string) {
  if (!navigator.clipboard?.writeText) {
    ElMessage.warning('当前浏览器不支持剪贴板复制')
    return
  }
  await navigator.clipboard.writeText(text)
  ElMessage.success(message)
}

async function revealSecret(kind: 'interface' | 'upstream', id: string) {
  const key = `${kind}:${id}`
  if (secretValues[key]) {
    secretValues[key] = ''
    return
  }
  const data = await adminApi.secret(kind, id)
  secretValues[key] = data.secret.value
}

async function copySecret(kind: 'interface' | 'upstream', id: string) {
  const key = `${kind}:${id}`
  if (!secretValues[key]) {
    const data = await adminApi.secret(kind, id)
    secretValues[key] = data.secret.value
  }
  if (!secretValues[key]) {
    ElMessage.warning('当前没有可复制的 Key')
    return
  }
  await copyText(secretValues[key], kind === 'interface' ? '已复制接口 Key' : '已复制上游 Key')
}

async function rotateKey(item: StudioInterface) {
  await ElMessageBox.confirm('重新生成后旧 Key 会立即失效，确定继续吗？', '重新生成 Key', { type: 'warning' })
  const data = await adminApi.rotateInterfaceKey(item.id)
  secretValues[`interface:${item.id}`] = data.apiToken
  setConfig(data.config)
  ElMessage.success('接口 Key 已重新生成，可直接复制')
}

async function cloneInterface(item: StudioInterface) {
  const cloneId = `${item.id}-copy`
  const data = await adminApi.cloneInterface(item.id, cloneId, `${item.name} 副本`)
  setConfig(data.config)
  ElMessage.success('接口已克隆')
}

async function testInterface(item: StudioInterface) {
  await adminApi.testInterface(item.id)
  ElMessage.success('接口配置可用')
}

async function testUpstream(item: StudioUpstream) {
  const data = await adminApi.testUpstream(item.id)
  ElMessage.success(data.upstream.message || '上游连接正常')
}

function addInterface() {
  config.value?.interfaces.push(createInterface())
  openDrawer('interface', activeInterfaces.value.length - 1)
}

function addUpstream() {
  config.value?.upstreams.push(createUpstream())
  openDrawer('upstream', activeUpstreams.value.length - 1)
}

function addModel() {
  config.value?.models.push(createModel())
  openDrawer('model', activeModels.value.length - 1)
}

function addPreset() {
  config.value?.qualityPresets.push(createPreset())
  openDrawer('quality', activePresets.value.length - 1)
}

async function removeItem(kind: 'interface' | 'upstream' | 'model' | 'quality', index: number) {
  await ElMessageBox.confirm('删除后需要保存才会生效，确定删除吗？', '删除确认', { type: 'warning' })
  if (!config.value) return
  if (kind === 'interface' && config.value.interfaces.length > 1) config.value.interfaces.splice(index, 1)
  if (kind === 'upstream' && config.value.upstreams.length > 1) config.value.upstreams.splice(index, 1)
  if (kind === 'model') config.value.models.splice(index, 1)
  if (kind === 'quality') config.value.qualityPresets.splice(index, 1)
}

async function saveModels() {
  if (!config.value) return
  const result = await adminApi.saveModels(config.value.models)
  config.value.models = result.models
  markSaved()
  ElMessage.success('模型目录已保存')
}

async function saveQualityPresets() {
  if (!config.value) return
  const result = await adminApi.saveQualityPresets(config.value.qualityPresets)
  config.value.qualityPresets = result.qualityPresets
  markSaved()
  ElMessage.success('质量预设已保存')
}

async function saveAlerts() {
  if (!config.value) return
  const result = await adminApi.saveAlerts(config.value.alerts)
  config.value.alerts = result.alerts
  markSaved()
  const active = await adminApi.activeAlerts().catch(() => ({ alerts: [], summary: alertSummary.value, notification: alertNotification.value }))
  activeAlerts.value = active.alerts
  alertSummary.value = active.summary
  alertNotification.value = active.notification
  ElMessage.success('告警配置已保存')
}

async function acknowledgeAlert(id: string) {
  const data = await adminApi.acknowledgeAlert(id)
  activeAlerts.value = data.alerts
  alertSummary.value = data.summary
  alertNotification.value = data.notification
  ElMessage.success('告警已确认')
}

async function restoreVersion(id: string) {
  await ElMessageBox.confirm('恢复后当前配置会被覆盖，确定继续吗？', '恢复配置版本', { type: 'warning' })
  const result = await adminApi.restoreVersion(id)
  setConfig(result.config)
  markSaved()
  ElMessage.success('配置版本已恢复')
}

async function createBackup() {
  const result = await adminApi.backup()
  backupStatus.value = `已生成备份：${formatTime(result.backup.createdAt)}`
  backups.value = [result.backup, ...backups.value.filter((item) => item.id !== result.backup.id)].slice(0, 10)
  downloadJSON(`image-studio-backup-${Date.now()}.json`, result.backup)
  ElMessage.success('备份已生成')
}

async function restoreBackup(id: string) {
  await ElMessageBox.confirm('恢复后当前配置会被覆盖，确定继续吗？', '恢复备份', { type: 'warning' })
  const result = await adminApi.restore({ backupId: id })
  setConfig(result.config)
  markSaved()
  ElMessage.success('备份已恢复')
}

function downloadBackup(record: BackupRecord) {
  downloadJSON(`image-studio-backup-${record.createdAt.slice(0, 10)}-${record.id}.json`, record)
}

function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function exportLogs(format: 'jsonl' | 'csv') {
  const params = new URLSearchParams({ type: 'generations', format })
  for (const [key, value] of Object.entries(logQuery())) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  window.location.href = `/api/logs/export?${params.toString()}`
}

function openUpdateLink() {
  const url = updateInfo.value.changelogURL || updateInfo.value.releaseURL
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

async function copyRollbackCommand() {
  const command = updateInfo.value.rollbackCommand || ''
  if (!command) {
    ElMessage.warning('暂无回滚命令')
    return
  }
  await copyText(command, '已复制回滚命令')
}

async function refreshLogsOnly() {
  loading.value = true
  try {
    const [generationData, apiData] = await Promise.all([
      adminApi.logs('generations', logQuery()),
      adminApi.logs('api', logQuery())
    ])
    generationLogs.value = generationData.records
    apiLogs.value = apiData.records
  } finally {
    loading.value = false
  }
}

function resetLogFilters() {
  Object.assign(logFilter, {
    keyword: '',
    status: '',
    interfaceId: '',
    upstreamId: '',
    model: '',
    endpoint: '',
    requestId: '',
    from: '',
    to: '',
    statusMin: undefined,
    statusMax: undefined,
    minDurationMs: undefined,
    maxDurationMs: undefined
  })
}

function openLogDetail(record: LogRecord) {
  selectedLog.value = record
  logDetailVisible.value = true
}

function openQualityCaseLog(item: QualityCase) {
  const record = generationLogs.value.find((entry) => entry.id === item.recordId)
  selectedLog.value = record || {
    id: item.recordId,
    createdAt: item.createdAt,
    endpoint: item.endpoint,
    status: item.status,
    interfaceId: item.interfaceId,
    upstreamId: item.upstreamId,
    model: item.model,
    durationMs: item.durationMs,
    errorSummary: item.errorSummary,
  }
  logDetailVisible.value = true
}

function sanitizedCurl(record: LogRecord) {
  const endpoint = record.endpoint || record.path || '/v1/images/generations'
  const method = record.method || 'POST'
  const payload = endpoint.includes('/v1/images')
    ? JSON.stringify({ model: record.model || '<model>', prompt: '<redacted prompt>' })
    : '{}'
  return [
    `curl -X ${method} "${window.location.origin}${endpoint}"`,
    '  -H "Authorization: Bearer <IMAGE_STUDIO_API_TOKEN>"',
    '  -H "Content-Type: application/json"',
    `  -d '${payload}'`
  ].join(' \\\n')
}

async function copySanitizedCurl(record: LogRecord) {
  await copyText(sanitizedCurl(record), '已复制脱敏 curl')
}

async function markQualityCase(record: LogRecord, label: 'poor' | 'excellent') {
  const data = await adminApi.markQualityCase(record.id, label)
  qualityCases.value = data.qualityCases
  if (config.value) config.value.qualityCases = data.qualityCases
  ElMessage.success(label === 'poor' ? '已标记为质量差案例' : '已保存为优秀案例')
}

function openRestorePicker() {
  backupFileInput.value?.click()
}

async function restoreFromFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const raw = await file.text()
  const parsed = JSON.parse(raw)
  await ElMessageBox.confirm('上传恢复会覆盖当前配置，确定继续吗？', '上传恢复', { type: 'warning' })
  const result = await adminApi.restore(parsed.config ? { config: parsed.config } : { backup: parsed })
  setConfig(result.config)
  markSaved()
  ElMessage.success('配置已从备份恢复')
}

async function saveAccount() {
  const result = await adminApi.account(accountForm)
  username.value = result.account.username
  accountForm.currentPassword = ''
  accountForm.newPassword = ''
  ElMessage.success('账号密码已更新')
}

function updateSecurity(security: AdminConfig['security']) {
  if (!config.value) return
  config.value.security = security
  markSaved()
}

async function setupTOTP() {
  const result = await adminApi.totpSetup()
  totpSetup.value = result.totp
  totpCode.value = ''
  updateSecurity(result.security)
  ElMessage.success('TOTP 密钥已生成')
}

async function enableTOTP() {
  if (!totpCode.value.trim()) {
    ElMessage.warning('请输入验证器中的 6 位验证码')
    return
  }
  const result = await adminApi.totpEnable(totpCode.value)
  updateSecurity(result.security)
  totpSetup.value = null
  totpCode.value = ''
  ElMessage.success('TOTP 二次验证已启用')
}

async function disableTOTP() {
  await ElMessageBox.confirm('禁用后登录将不再要求动态验证码，确定继续吗？', '禁用 TOTP', { type: 'warning' })
  const result = await adminApi.totpDisable(totpCode.value)
  updateSecurity(result.security)
  totpSetup.value = null
  totpCode.value = ''
  ElMessage.success('TOTP 二次验证已禁用')
}

async function revokeSession(id: string) {
  const data = await adminApi.revokeSession({ id })
  sessions.value = data.sessions
  ElMessage.success('会话已退出')
}

async function revokeOtherSessions() {
  await ElMessageBox.confirm('这会退出除当前浏览器外的所有后台会话，确定继续吗？', '退出其他会话', { type: 'warning' })
  const data = await adminApi.revokeSession({ others: true })
  sessions.value = data.sessions
  ElMessage.success(`已退出 ${data.revoked} 个会话`)
}

function copySnippet(item: StudioInterface) {
  const snippet = [
    `IMAGE_STUDIO_ENDPOINT=${window.location.origin}`,
    'IMAGE_STUDIO_API_TOKEN=<点击显示已保存 Key 后填写>',
    `IMAGE_STUDIO_DEFAULT_MODEL=${item.defaultImageModel}`,
    `IMAGE_STUDIO_DEFAULT_SIZE=${item.defaultSize}`,
    `IMAGE_STUDIO_DEFAULT_QUALITY=${item.defaultQuality}`
  ].join('\n')
  copyText(snippet, '已复制 Skill/Codex 配置片段')
}

onMounted(() => {
  loadThemeMode()
  syncViewportWidth()
  document.addEventListener('keydown', handleGlobalSearchKeydown)
  window.addEventListener('resize', syncViewportWidth)
  bootstrap()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalSearchKeydown)
  window.removeEventListener('resize', syncViewportWidth)
})

window.addEventListener('beforeunload', (event) => {
  if (!config.value || JSON.stringify(config.value) === lastSavedConfig.value) return
  event.preventDefault()
  event.returnValue = ''
})
</script>

<template>
  <div v-if="!authenticated" class="login-page login-workspace" v-loading="loading">
    <section class="login-status-panel">
      <div class="brand-orbit">
        <div class="brand-logo">IS</div>
        <div>
          <strong>Image Studio API</strong>
          <span>Self-hosted operations console</span>
        </div>
      </div>
      <div class="login-headline">
        <span>Art Design Pro Console</span>
        <h1>Image Studio 运维控制台</h1>
        <p>集中管理接口、上游、模型、质量预设、日志、成本、安全和版本更新。</p>
      </div>
      <div class="login-signal-grid">
        <div><span>模型</span><strong>GPT Image 2</strong><small>生成 / 编辑</small></div>
        <div><span>路由</span><strong>Failover</strong><small>上游故障转移</small></div>
        <div><span>安全</span><strong>Audit</strong><small>会话与审计</small></div>
        <div><span>运维</span><strong>Backup</strong><small>备份与回滚</small></div>
      </div>
      <div class="login-pipeline">
        <div><i></i><span>Client Key</span></div>
        <div><i></i><span>Interface Policy</span></div>
        <div><i></i><span>Upstream Route</span></div>
        <div><i></i><span>Logs & Usage</span></div>
      </div>
    </section>
    <el-card class="login-card login-access-panel" shadow="never">
      <template #header>
        <div>
          <h2>账号密码登录</h2>
          <p>登录后进入管理后台，继续管理你的自托管 Image Studio API。</p>
        </div>
      </template>
      <el-form :model="loginForm" label-position="top" @submit.prevent="login">
        <el-form-item label="账号">
          <el-input v-model="loginForm.username" autocomplete="username" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="loginForm.password" type="password" autocomplete="current-password" show-password @keyup.enter="login" />
        </el-form-item>
        <el-form-item label="TOTP 验证码">
          <el-input v-model="loginForm.totpCode" autocomplete="one-time-code" maxlength="6" placeholder="未启用时可留空" @keyup.enter="login" />
        </el-form-item>
        <el-button type="primary" size="large" class="full-button" :loading="loading" @click="login">登录</el-button>
      </el-form>
      <div class="login-security-strip">
        <span><Lock /> Cookie Session</span>
        <span><Key /> Optional TOTP</span>
        <span><Document /> Audit Trail</span>
      </div>
    </el-card>
  </div>

  <div v-else class="admin-shell"
    :class="{ 'mobile-menu-visible': mobileMenuVisible }"
    :data-theme="themeMode"
    :data-layout="layoutMode"
    :data-menu-style="menuStyleMode"
    :data-menu-open="menuOpen"
    v-loading="loading"
  >
    <aside class="admin-sidebar layout-sidebar" :class="[menuOpen ? 'menu-left-open' : 'menu-left-close']">
      <div class="sidebar-brand">
        <div class="brand-logo">IS</div>
        <div>
          <strong>Image Studio</strong>
          <span>Art Design Pro Console</span>
        </div>
      </div>
      <nav class="sidebar-nav">
        <section v-for="group in navGroups" :key="group.title">
          <p>{{ group.title }}</p>
          <button v-for="item in group.items" :key="item.key" :class="{ active: activeView === item.key }" @click="navigateTo(item.key)">
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </button>
        </section>
      </nav>
      <div class="sidebar-footer">
        <el-tag type="success" effect="dark">在线</el-tag>
        <span>{{ username }}</span>
      </div>
    </aside>
    <div v-show="mobileMenuVisible" class="menu-model" @click="closeMobileMenu"></div>

    <main class="admin-main">
      <header class="admin-topbar">
        <div>
          <nav class="page-breadcrumb" aria-label="当前位置">
            <span v-for="(item, index) in breadcrumbItems" :key="`${item.label}-${index}`">
              <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
              {{ item.label }}
            </span>
          </nav>
          <h1>{{ currentTitle }}</h1>
          <small v-if="config && JSON.stringify(config) !== lastSavedConfig" class="dirty-hint">有未保存的配置变更</small>
        </div>
        <div class="art-header-actions header-tools">
          <button type="button" class="header-tool header-menu-trigger" @click="toggleMenuVisibility" aria-label="切换菜单">
            <Operation />
          </button>
          <button type="button" class="global-search" @click="openGlobalSearch" aria-label="搜索模块">
            <el-icon><Search /></el-icon>
            <span>搜索模块</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button type="button" class="header-tool notification-entry" @click="toggleNotificationPanel" aria-label="告警通知">
            <el-badge :value="pendingAlertCount" :hidden="!pendingAlertCount" type="danger">
              <Bell />
            </el-badge>
          </button>
          <button type="button" class="header-tool" @click="refreshAll" aria-label="刷新">
            <Refresh />
          </button>
          <button type="button" class="header-tool" @click="toggleFullscreen" aria-label="全屏">
            <FullScreen />
          </button>
          <button type="button" class="header-tool settings-entry" @click="openSettings" aria-label="系统设置">
            <Setting />
          </button>
          <button type="button" class="header-tool" @click="toggleTheme" :aria-label="themeMode === 'dark' ? '浅色主题' : '深色主题'">
            <component :is="themeMode === 'dark' ? Sunny : Moon" />
          </button>
          <el-dropdown trigger="click">
            <button type="button" class="user-entry">
              <el-icon><Avatar /></el-icon>
              <span>{{ username }}</span>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="navigateTo('security')">账号与安全</el-dropdown-item>
                <el-dropdown-item @click="navigateTo('system')">系统设置</el-dropdown-item>
                <el-dropdown-item divided @click="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <nav class="page-tabs art-work-tab" aria-label="打开的模块">
        <div class="worktab-scroll">
          <button
            v-for="tab in openedPageTabs"
            :key="tab.key"
            :class="{ active: activeView === tab.key, fixed: isPageTabFixed(tab.key) }"
            @click="navigateTo(tab.key)"
            @contextmenu.prevent="setWorkTabTarget(tab.key)"
          >
            <el-icon><component :is="tab.fixed ? Position : tab.icon" /></el-icon>
            <span>{{ tab.label }}</span>
            <el-icon v-if="!isPageTabFixed(tab.key)" class="tab-close" @click.stop="closePageTab(tab.key)"><Close /></el-icon>
          </button>
        </div>
        <el-dropdown trigger="click" @command="(key: WorkTabActionKey) => runWorkTabAction(key)">
          <button type="button" class="worktab-action-trigger" @click="setWorkTabTarget(activeView)" aria-label="标签操作">
            <More />
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="item in workTabActions"
                :key="item.key"
                :command="item.key"
                :disabled="item.disabled"
              >
                <el-icon><component :is="item.icon" /></el-icon>
                <span>{{ item.label }}</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </nav>

      <div class="layout-content">
        <div id="app-content-header">
          <section class="art-operations-panel" aria-label="后台快捷操作">
            <div>
              <div class="art-operations-heading">
                <el-icon><Operation /></el-icon>
                <span>运维快捷动作</span>
              </div>
              <div class="art-quick-actions">
                <el-button
                  v-for="item in quickActions"
                  :key="item.label"
                  :type="item.type === 'primary' ? 'primary' : undefined"
                  :icon="item.icon"
                  @click="item.action"
                >
                  {{ item.label }}
                </el-button>
              </div>
            </div>
            <div class="art-risk-board">
              <button v-for="item in riskItems" :key="item.label" :class="riskClass(item.severity)" @click="navigateTo(item.target)">
                <el-icon><WarningFilled /></el-icon>
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
                <small>{{ item.hint }}</small>
              </button>
            </div>
          </section>
        </div>

        <Transition :name="pageTransitionName" mode="out-in" appear>
          <div v-if="pageContentRefreshing" :key="activeView" class="art-page-view">
            <section v-if="activeView === 'dashboard'" class="view-stack">
        <div class="art-console-card-list">
          <el-card
            v-for="item in dashboardSummaryCards"
            :key="item.label"
            shadow="never"
            class="art-console-stat-card"
            :class="`tone-${item.tone}`"
          >
            <div class="art-console-stat-body">
              <div class="art-console-stat-meta">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
                <div class="art-console-stat-trend">
                  <span>{{ item.hint }}</span>
                </div>
              </div>
              <div class="art-console-stat-icon">
                <component :is="item.icon" />
              </div>
            </div>
          </el-card>
        </div>
        <div class="art-console-section-grid art-dashboard-visual-grid">
          <el-card shadow="never" class="art-console-panel">
            <template #header>
              <div class="art-console-panel-header">
                <div class="art-console-panel-title">
                  <h4><DataAnalysis />近 7 日用量趋势</h4>
                  <p>按日期汇总生成量与估算成本</p>
                </div>
                <div class="art-console-panel-tools">
                  <span class="art-console-panel-badge">Usage</span>
                  <button type="button" class="art-console-panel-action" @click="navigateTo('usage')">详情</button>
                </div>
              </div>
            </template>
            <div class="art-trend-chart" aria-label="近 7 日用量趋势">
              <div v-for="item in usageTrendBars" :key="item.name" class="art-trend-bar">
                <span>{{ item.total }}</span>
                <i :style="{ height: `${item.height}%` }"></i>
                <small>{{ item.shortName }}</small>
              </div>
              <div v-if="!usageTrendBars.length" class="art-chart-empty">暂无用量数据</div>
            </div>
          </el-card>
          <el-card shadow="never" class="art-console-panel">
            <template #header>
              <div class="art-console-panel-header">
                <div class="art-console-panel-title">
                  <h4><Monitor />任务状态分布</h4>
                  <p>成功、失败与处理中请求占比</p>
                </div>
                <div class="art-console-panel-tools">
                  <span class="art-console-panel-badge">Live</span>
                  <button type="button" class="art-console-panel-action" @click="refreshAll">刷新</button>
                </div>
              </div>
            </template>
            <div class="art-status-distribution" aria-label="任务状态分布">
              <div v-for="item in statusDistribution" :key="item.label" class="art-distribution-row">
                <div>
                  <span>{{ item.label }}</span>
                  <strong>{{ item.count }}</strong>
                </div>
                <p><i :class="item.className" :style="{ width: `${item.percent}%` }"></i></p>
                <small>{{ item.percent }}%</small>
              </div>
            </div>
          </el-card>
        </div>
        <div class="art-console-section-grid">
          <el-card shadow="never" class="art-console-panel">
            <template #header>
              <div class="art-console-panel-header">
                <div class="art-console-panel-title">
                  <h4><Monitor />服务状态</h4>
                  <p>接口、上游、模型和版本概览</p>
                </div>
                <div class="art-console-panel-tools">
                  <span class="art-console-panel-badge">Service</span>
                  <button type="button" class="art-console-panel-action" @click="navigateTo('system')">系统</button>
                </div>
              </div>
            </template>
            <div class="art-console-status-list">
              <div><span>接口数量</span><strong>{{ activeInterfaces.length }}</strong></div>
              <div><span>上游数量</span><strong>{{ activeUpstreams.length }}</strong></div>
              <div><span>默认模型</span><strong>{{ config?.defaultImageModel }}</strong></div>
              <div><span>版本状态</span><strong>{{ updateInfo.status || 'unknown' }}</strong></div>
            </div>
          </el-card>
          <el-card shadow="never" class="art-console-panel">
            <template #header>
              <div class="art-console-panel-header">
                <div class="art-console-panel-title">
                  <h4><Timer />最近失败</h4>
                  <p>快速定位近期失败请求</p>
                </div>
                <div class="art-console-panel-tools">
                  <span class="art-console-panel-badge">Errors</span>
                  <button type="button" class="art-console-panel-action" @click="navigateTo('logs')">日志</button>
                </div>
              </div>
            </template>
            <el-table :data="generationLogs.filter((item) => item.status === 'failed').slice(0, 6)" size="small">
              <el-table-column prop="createdAt" label="时间" min-width="160">
                <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
              </el-table-column>
              <el-table-column prop="model" label="模型" min-width="120" />
              <el-table-column prop="durationMs" label="耗时" width="100">
                <template #default="{ row }">{{ formatDuration(row.durationMs) }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </div>
      </section>

      <section v-if="activeView === 'interfaces'" class="view-stack">
        <el-card shadow="never" class="art-table-workspace art-table-card">
          <div class="art-table-toolbar art-table-header">
            <div class="art-table-header-main" :class="{ 'search-hidden': !isTableSearchVisible('interfaces') }">
              <div class="art-table-title">
                <h4><Connection />接口管理</h4>
                <span>Skill/API 调用入口</span>
              </div>
              <div class="art-table-meta">共 {{ activeInterfaces.length }} 个接口，当前显示 {{ filteredInterfaces.length }} 个</div>
              <el-input v-show="isTableSearchVisible('interfaces')" v-model="tableSearch.interfaces" class="art-table-search-input" clearable placeholder="搜索接口、模型、上游" />
            </div>
            <div class="art-toolbar-actions">
              <div class="art-table-header-tools">
                <el-tooltip v-for="tool in tableHeaderTools" :key="tool.key" :content="tableHeaderToolLabel(tool.key)" placement="top">
                  <button type="button" class="art-table-tool-button" :class="{ active: tool.active }" @click="handleTableHeaderTool(tool.key)">
                    <component :is="tool.icon" />
                  </button>
                </el-tooltip>
              </div>
              <el-segmented v-model="tableDensity" :options="['default', 'comfortable', 'compact']" />
              <el-button type="primary" :icon="Plus" @click="addInterface">新增接口</el-button>
              <el-button :icon="Finished" @click="saveConfig()">保存接口配置</el-button>
            </div>
          </div>
          <el-table :data="paginatedInterfaces" :size="tableSize" row-key="id">
            <template #empty>
              <div class="art-empty-state">
                <Connection />
                <strong>{{ emptyState('interfaces').title }}</strong>
                <span>{{ emptyState('interfaces').description }}</span>
                <el-button type="primary" :icon="Plus" @click="addInterface">新增接口</el-button>
              </div>
            </template>
            <el-table-column v-if="isTableColumnVisible('interfaces', 'name')" prop="name" label="名称" min-width="150" />
            <el-table-column v-if="isTableColumnVisible('interfaces', 'apiToken')" prop="apiTokenSet" label="API Key" width="150">
              <template #default="{ row }">
                <div class="key-preview">
                  <el-tag :type="row.apiTokenSet ? 'success' : 'danger'">{{ row.apiTokenSet ? '已配置' : '未配置' }}</el-tag>
                  <span v-if="row.apiTokenPreview">{{ row.apiTokenPreview }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('interfaces', 'defaultImageModel')" prop="defaultImageModel" label="模型" min-width="140" />
            <el-table-column v-if="isTableColumnVisible('interfaces', 'sizeQuality')" label="尺寸/质量" min-width="150">
              <template #default="{ row }">{{ row.defaultSize }} · {{ row.defaultQuality }}</template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('interfaces', 'upstreamIds')" prop="upstreamIds" label="绑定上游" min-width="160">
              <template #default="{ row }">{{ row.upstreamIds.join(', ') || '-' }}</template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('interfaces', 'rateLimitPerMinute')" prop="rateLimitPerMinute" label="限流" width="90" />
            <el-table-column v-if="isTableColumnVisible('interfaces', 'enabled')" prop="enabled" label="状态" width="100">
              <template #default="{ row }"><el-switch v-model="row.enabled" /></template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('interfaces', 'lastUsedAt')" prop="lastUsedAt" label="最后使用" min-width="160">
              <template #default="{ row }">{{ formatTime(row.lastUsedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="190" fixed="right">
              <template #default="{ row }">
                <div class="art-table-actions">
                  <el-tooltip content="编辑接口" placement="top">
                    <button type="button" class="art-table-action-button action-edit" aria-label="编辑接口" @click="openDrawer('interface', rowIndex(activeInterfaces, row))">
                      <Edit />
                    </button>
                  </el-tooltip>
                  <el-tooltip content="重置 Key" placement="top">
                    <button type="button" class="art-table-action-button action-key" aria-label="重置接口 Key" @click="rotateKey(row)">
                      <Key />
                    </button>
                  </el-tooltip>
                  <el-dropdown trigger="click">
                    <button type="button" class="art-table-action-button action-more" aria-label="更多接口操作">
                      <More />
                    </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="testInterface(row)">测试接口</el-dropdown-item>
                      <el-dropdown-item @click="copySecret('interface', row.id)">复制 Key</el-dropdown-item>
                      <el-dropdown-item @click="cloneInterface(row)">克隆</el-dropdown-item>
                      <el-dropdown-item @click="copySnippet(row)">复制 Skill/Codex 配置</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                  </el-dropdown>
                  <el-tooltip content="删除接口" placement="top">
                    <button type="button" class="art-table-action-button action-danger" aria-label="删除接口" @click="removeItem('interface', rowIndex(activeInterfaces, row))">
                      <Delete />
                    </button>
                  </el-tooltip>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="filteredInterfaces.length" class="art-table-pagination art-table-custom-pagination right">
            <el-pagination
              background
              :page-sizes="tablePageSizes"
              layout="total, prev, pager, next, sizes, jumper"
              :total="filteredInterfaces.length"
              :page-size="tablePagination.interfaces.pageSize"
              :current-page="tableEffectiveCurrentPage('interfaces', filteredInterfaces.length)"
              @size-change="handleTablePageSizeChange('interfaces', $event)"
              @current-change="handleTableCurrentPageChange('interfaces', $event)"
            />
          </div>
        </el-card>
      </section>

      <section v-if="activeView === 'upstreams'" class="view-stack">
        <el-card shadow="never" class="art-table-workspace art-table-card">
          <div class="art-table-toolbar art-table-header">
            <div class="art-table-header-main" :class="{ 'search-hidden': !isTableSearchVisible('upstreams') }">
              <div class="art-table-title">
                <h4><Link />上游管理</h4>
                <span>模型服务路由与健康</span>
              </div>
              <div class="art-table-meta">共 {{ activeUpstreams.length }} 个上游，当前显示 {{ filteredUpstreams.length }} 个</div>
              <el-input v-show="isTableSearchVisible('upstreams')" v-model="tableSearch.upstreams" class="art-table-search-input" clearable placeholder="搜索上游、URL、失败原因" />
            </div>
            <div class="art-toolbar-actions">
              <div class="art-table-header-tools">
                <el-tooltip v-for="tool in tableHeaderTools" :key="tool.key" :content="tableHeaderToolLabel(tool.key)" placement="top">
                  <button type="button" class="art-table-tool-button" :class="{ active: tool.active }" @click="handleTableHeaderTool(tool.key)">
                    <component :is="tool.icon" />
                  </button>
                </el-tooltip>
              </div>
              <el-segmented v-model="tableDensity" :options="['default', 'comfortable', 'compact']" />
              <el-button type="primary" :icon="Plus" @click="addUpstream">新增上游</el-button>
              <el-button :icon="Finished" @click="saveConfig()">保存上游配置</el-button>
            </div>
          </div>
          <el-table :data="paginatedUpstreams" :size="tableSize" row-key="id">
            <template #empty>
              <div class="art-empty-state">
                <Link />
                <strong>{{ emptyState('upstreams').title }}</strong>
                <span>{{ emptyState('upstreams').description }}</span>
                <el-button type="primary" :icon="Plus" @click="addUpstream">新增上游</el-button>
              </div>
            </template>
            <el-table-column v-if="isTableColumnVisible('upstreams', 'name')" prop="name" label="名称" min-width="160" />
            <el-table-column v-if="isTableColumnVisible('upstreams', 'baseURL')" prop="baseURL" label="Base URL" min-width="260" show-overflow-tooltip />
            <el-table-column v-if="isTableColumnVisible('upstreams', 'apiKey')" prop="apiKeySet" label="API Key" width="150">
              <template #default="{ row }">
                <div class="key-preview">
                  <el-tag :type="row.apiKeySet ? 'success' : 'danger'">{{ row.apiKeySet ? '已配置' : '未配置' }}</el-tag>
                  <span v-if="row.apiKeyPreview">{{ row.apiKeyPreview }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('upstreams', 'priority')" prop="priority" label="优先级" width="90" />
            <el-table-column v-if="isTableColumnVisible('upstreams', 'weight')" prop="weight" label="权重" width="80" />
            <el-table-column v-if="isTableColumnVisible('upstreams', 'health')" label="健康" min-width="210">
              <template #default="{ row }">
                <div class="health-inline">
                  <el-tag :type="(upstreamHealthFor(row.id)?.metrics.successRate || 0) >= 90 ? 'success' : 'warning'">
                    {{ upstreamHealthFor(row.id)?.metrics.successRate || 0 }}%
                  </el-tag>
                  <span>平均 {{ formatDuration(upstreamHealthFor(row.id)?.metrics.averageDurationMs) }}</span>
                  <span>P95 {{ formatDuration(upstreamHealthFor(row.id)?.metrics.p95DurationMs) }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('upstreams', 'lastCheckedAt')" label="最近检测" min-width="160">
              <template #default="{ row }">{{ formatTime(upstreamHealthFor(row.id)?.metrics.lastCheckedAt) }}</template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('upstreams', 'lastFailureReason')" label="最近失败原因" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">{{ upstreamHealthFor(row.id)?.metrics.lastFailureReason || '-' }}</template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('upstreams', 'healthCheckEnabled')" prop="healthCheckEnabled" label="健康检查" width="110">
              <template #default="{ row }"><el-switch v-model="row.healthCheckEnabled" /></template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('upstreams', 'enabled')" prop="enabled" label="状态" width="100">
              <template #default="{ row }"><el-switch v-model="row.enabled" /></template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <div class="art-table-actions">
                  <el-tooltip content="编辑上游" placement="top">
                    <button type="button" class="art-table-action-button action-edit" aria-label="编辑上游" @click="openDrawer('upstream', rowIndex(activeUpstreams, row))">
                      <Edit />
                    </button>
                  </el-tooltip>
                  <el-tooltip content="测试上游" placement="top">
                    <button type="button" class="art-table-action-button action-test" aria-label="测试上游" @click="testUpstream(row)">
                      <Aim />
                    </button>
                  </el-tooltip>
                  <el-tooltip content="删除上游" placement="top">
                    <button type="button" class="art-table-action-button action-danger" aria-label="删除上游" @click="removeItem('upstream', rowIndex(activeUpstreams, row))">
                      <Delete />
                    </button>
                  </el-tooltip>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="filteredUpstreams.length" class="art-table-pagination art-table-custom-pagination right">
            <el-pagination
              background
              :page-sizes="tablePageSizes"
              layout="total, prev, pager, next, sizes, jumper"
              :total="filteredUpstreams.length"
              :page-size="tablePagination.upstreams.pageSize"
              :current-page="tableEffectiveCurrentPage('upstreams', filteredUpstreams.length)"
              @size-change="handleTablePageSizeChange('upstreams', $event)"
              @current-change="handleTableCurrentPageChange('upstreams', $event)"
            />
          </div>
        </el-card>
      </section>

      <section v-if="activeView === 'models'" class="view-stack">
        <el-card shadow="never" class="art-table-workspace art-table-card">
          <div class="art-table-toolbar art-table-header">
            <div class="art-table-header-main" :class="{ 'search-hidden': !isTableSearchVisible('models') }">
              <div class="art-table-title">
                <h4><Box />模型目录</h4>
                <span>能力、尺寸、质量与上游绑定</span>
              </div>
              <div class="art-table-meta">共 {{ activeModels.length }} 个模型，当前显示 {{ filteredModels.length }} 个</div>
              <el-input v-show="isTableSearchVisible('models')" v-model="tableSearch.models" class="art-table-search-input" clearable placeholder="搜索模型、能力、用途" />
            </div>
            <div class="art-toolbar-actions">
              <div class="art-table-header-tools">
                <el-tooltip v-for="tool in tableHeaderTools" :key="tool.key" :content="tableHeaderToolLabel(tool.key)" placement="top">
                  <button type="button" class="art-table-tool-button" :class="{ active: tool.active }" @click="handleTableHeaderTool(tool.key)">
                    <component :is="tool.icon" />
                  </button>
                </el-tooltip>
              </div>
              <el-segmented v-model="tableDensity" :options="['default', 'comfortable', 'compact']" />
              <el-button type="primary" :icon="Plus" @click="addModel">新增模型</el-button>
              <el-button :icon="Finished" @click="saveModels">保存模型目录</el-button>
            </div>
          </div>
          <el-table :data="paginatedModels" :size="tableSize" row-key="id">
            <template #empty>
              <div class="art-empty-state">
                <Box />
                <strong>{{ emptyState('models').title }}</strong>
                <span>{{ emptyState('models').description }}</span>
                <el-button type="primary" :icon="Plus" @click="addModel">新增模型</el-button>
              </div>
            </template>
            <el-table-column v-if="isTableColumnVisible('models', 'id')" prop="id" label="模型 ID" min-width="160" />
            <el-table-column v-if="isTableColumnVisible('models', 'name')" prop="name" label="名称" min-width="140" />
            <el-table-column v-if="isTableColumnVisible('models', 'capabilities')" prop="capabilities" label="能力" min-width="160">
              <template #default="{ row }">
                <div class="compact-tags">
                  <el-tag v-for="item in row.capabilities" :key="item" size="small">{{ item }}</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('models', 'sizes')" prop="sizes" label="尺寸" min-width="190" show-overflow-tooltip>
              <template #default="{ row }">{{ row.sizes.join(', ') || '-' }}</template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('models', 'qualities')" prop="qualities" label="质量" min-width="150">
              <template #default="{ row }">
                <div class="compact-tags">
                  <el-tag v-for="item in row.qualities" :key="item" size="small" type="info">{{ item }}</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('models', 'defaultOutputFormat')" prop="defaultOutputFormat" label="默认格式" width="110" />
            <el-table-column v-if="isTableColumnVisible('models', 'upstreamIds')" prop="upstreamIds" label="绑定上游" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">{{ upstreamNames(row.upstreamIds) }}</template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('models', 'recommendedUse')" prop="recommendedUse" label="推荐用途" min-width="220" show-overflow-tooltip />
            <el-table-column v-if="isTableColumnVisible('models', 'enabled')" prop="enabled" label="启用" width="90">
              <template #default="{ row }"><el-switch v-model="row.enabled" /></template>
            </el-table-column>
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <div class="art-table-actions">
                  <el-tooltip content="编辑模型" placement="top">
                    <button type="button" class="art-table-action-button action-edit" aria-label="编辑模型" @click="openDrawer('model', rowIndex(activeModels, row))">
                      <Edit />
                    </button>
                  </el-tooltip>
                  <el-tooltip content="删除模型" placement="top">
                    <button type="button" class="art-table-action-button action-danger" aria-label="删除模型" @click="removeItem('model', rowIndex(activeModels, row))">
                      <Delete />
                    </button>
                  </el-tooltip>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="filteredModels.length" class="art-table-pagination art-table-custom-pagination right">
            <el-pagination
              background
              :page-sizes="tablePageSizes"
              layout="total, prev, pager, next, sizes, jumper"
              :total="filteredModels.length"
              :page-size="tablePagination.models.pageSize"
              :current-page="tableEffectiveCurrentPage('models', filteredModels.length)"
              @size-change="handleTablePageSizeChange('models', $event)"
              @current-change="handleTableCurrentPageChange('models', $event)"
            />
          </div>
        </el-card>
      </section>

      <section v-if="activeView === 'quality'" class="view-stack">
        <div class="art-quality-stats-grid">
          <div v-for="item in qualitySummaryCards" :key="item.label" class="art-quality-stat-card" :class="`tone-${item.tone}`">
            <div class="art-quality-stat-content">
              <p>{{ item.label }}</p>
              <strong>{{ item.value }}</strong>
              <span>{{ item.hint }}</span>
            </div>
            <div class="art-quality-stat-icon">
              <component :is="item.icon" />
            </div>
            <div class="art-quality-stat-arrow">
              <ArrowUpBold />
            </div>
          </div>
        </div>
        <el-card shadow="never" class="art-table-workspace art-table-card">
          <div class="art-table-toolbar art-table-header">
            <div class="art-table-header-main" :class="{ 'search-hidden': !isTableSearchVisible('quality') }">
              <div class="art-table-title">
                <h4><MagicStick />生图质量预设</h4>
                <span>Prompt 模板和默认参数</span>
              </div>
              <div class="art-table-meta">共 {{ activePresets.length }} 个预设，当前显示 {{ filteredPresets.length }} 个</div>
              <el-input v-show="isTableSearchVisible('quality')" v-model="tableSearch.quality" class="art-table-search-input" clearable placeholder="搜索预设、用途、模板" />
            </div>
            <div class="art-toolbar-actions">
              <div class="art-table-header-tools">
                <el-tooltip v-for="tool in tableHeaderTools" :key="tool.key" :content="tableHeaderToolLabel(tool.key)" placement="top">
                  <button type="button" class="art-table-tool-button" :class="{ active: tool.active }" @click="handleTableHeaderTool(tool.key)">
                    <component :is="tool.icon" />
                  </button>
                </el-tooltip>
              </div>
              <el-segmented v-model="tableDensity" :options="['default', 'comfortable', 'compact']" />
              <el-button type="primary" :icon="Plus" @click="addPreset">新增预设</el-button>
              <el-button :icon="Finished" @click="saveQualityPresets">保存质量预设</el-button>
            </div>
          </div>
          <div class="art-preset-grid">
            <el-card v-for="preset in paginatedPresets" :key="preset.id" shadow="never" class="art-preset-card">
              <div class="preset-card-header">
                <div class="preset-card-icon"><MagicStick /></div>
                <div class="preset-card-title">
                  <h4>{{ preset.name }}</h4>
                  <span>{{ preset.id }}</span>
                </div>
                <el-tag :type="preset.promptEnhance ? 'success' : 'info'">{{ preset.promptEnhance ? '增强' : '模板' }}</el-tag>
              </div>
              <div class="preset-card-body">
                <p>{{ preset.useCase }}</p>
                <div class="preset-card-meta">
                  <span><strong>{{ preset.quality }}</strong>质量</span>
                  <span><strong>{{ preset.size }}</strong>尺寸</span>
                  <span><strong>{{ preset.outputFormat }}</strong>格式</span>
                </div>
              </div>
              <div class="preset-card-footer">
                <span>{{ preset.promptEnhance ? 'Prompt 自动增强已启用' : '保留用户核心意图' }}</span>
                <div class="art-table-actions">
                  <el-tooltip content="编辑预设" placement="top">
                    <button type="button" class="art-table-action-button action-edit" aria-label="编辑质量预设" @click="openDrawer('quality', rowIndex(activePresets, preset))">
                      <Edit />
                    </button>
                  </el-tooltip>
                  <el-tooltip content="删除预设" placement="top">
                    <button type="button" class="art-table-action-button action-danger" aria-label="删除质量预设" @click="removeItem('quality', rowIndex(activePresets, preset))">
                      <Delete />
                    </button>
                  </el-tooltip>
                </div>
              </div>
            </el-card>
          </div>
          <el-table :data="paginatedPresets" :size="tableSize" class="preset-list-table">
            <template #empty>
              <div class="art-empty-state">
                <MagicStick />
                <strong>{{ emptyState('quality').title }}</strong>
                <span>{{ emptyState('quality').description }}</span>
                <el-button type="primary" :icon="Plus" @click="addPreset">新增预设</el-button>
              </div>
            </template>
            <el-table-column v-if="isTableColumnVisible('quality', 'id')" prop="id" label="预设 ID" min-width="180" />
            <el-table-column v-if="isTableColumnVisible('quality', 'name')" prop="name" label="名称" min-width="160" />
            <el-table-column v-if="isTableColumnVisible('quality', 'quality')" prop="quality" label="质量" width="100" />
            <el-table-column v-if="isTableColumnVisible('quality', 'size')" prop="size" label="尺寸" min-width="130" />
            <el-table-column v-if="isTableColumnVisible('quality', 'outputFormat')" prop="outputFormat" label="格式" width="90" />
            <el-table-column v-if="isTableColumnVisible('quality', 'promptEnhance')" prop="promptEnhance" label="增强" width="100">
              <template #default="{ row }"><el-tag :type="row.promptEnhance ? 'success' : 'info'">{{ row.promptEnhance ? '开启' : '关闭' }}</el-tag></template>
            </el-table-column>
            <el-table-column v-if="isTableColumnVisible('quality', 'useCase')" prop="useCase" label="用途" min-width="220" show-overflow-tooltip />
            <el-table-column label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <div class="art-table-actions">
                  <el-tooltip content="编辑预设" placement="top">
                    <button type="button" class="art-table-action-button action-edit" aria-label="编辑质量预设" @click="openDrawer('quality', rowIndex(activePresets, row))">
                      <Edit />
                    </button>
                  </el-tooltip>
                  <el-tooltip content="删除预设" placement="top">
                    <button type="button" class="art-table-action-button action-danger" aria-label="删除质量预设" @click="removeItem('quality', rowIndex(activePresets, row))">
                      <Delete />
                    </button>
                  </el-tooltip>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="filteredPresets.length" class="art-table-pagination art-table-custom-pagination right">
            <el-pagination
              background
              :page-sizes="tablePageSizes"
              layout="total, prev, pager, next, sizes, jumper"
              :total="filteredPresets.length"
              :page-size="tablePagination.quality.pageSize"
              :current-page="tableEffectiveCurrentPage('quality', filteredPresets.length)"
              @size-change="handleTablePageSizeChange('quality', $event)"
              @current-change="handleTableCurrentPageChange('quality', $event)"
            />
          </div>
        </el-card>
        <el-card shadow="never" class="art-quality-case-panel">
          <template #header>
            <div class="quality-case-panel-header">
              <div class="quality-case-panel-title">
                <h4><Document />质量案例库</h4>
                <p>沉淀优秀样例和质量差案例，用于继续优化 Prompt 模板。</p>
              </div>
              <div class="quality-case-panel-tools">
                <span class="quality-case-panel-badge">总计 {{ qualityCases.length }}</span>
                <span class="quality-case-panel-badge danger">差例 {{ poorQualityCases.length }}</span>
                <span class="quality-case-panel-badge success">优秀 {{ excellentQualityCases.length }}</span>
                <button type="button" class="art-console-panel-action" @click="refreshAll">刷新案例</button>
              </div>
            </div>
          </template>
          <el-table :data="qualityCases" height="360" empty-text="暂无质量案例">
            <template #empty>
              <div class="art-empty-state">
                <Document />
                <strong>{{ emptyState('qualityCases').title }}</strong>
                <span>{{ emptyState('qualityCases').description }}</span>
                <el-button :icon="Refresh" @click="refreshAll">刷新案例</el-button>
              </div>
            </template>
            <el-table-column prop="createdAt" label="时间" min-width="160">
              <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
            </el-table-column>
            <el-table-column prop="label" label="标签" width="100">
              <template #default="{ row }">
                <el-tag :type="row.label === 'poor' ? 'danger' : 'success'">{{ qualityCaseLabel(row.label) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="model" label="模型" min-width="130" />
            <el-table-column prop="interfaceId" label="接口" min-width="110" />
            <el-table-column prop="upstreamId" label="上游" min-width="110" />
            <el-table-column prop="durationMs" label="耗时" width="100">
              <template #default="{ row }">{{ formatDuration(row.durationMs) }}</template>
            </el-table-column>
            <el-table-column prop="errorSummary" label="错误摘要" min-width="220" show-overflow-tooltip />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <div class="art-table-actions">
                  <el-tooltip content="查看日志" placement="top">
                    <button type="button" class="art-table-action-button action-view" aria-label="查看质量案例日志" @click="openQualityCaseLog(row)">
                      <View />
                    </button>
                  </el-tooltip>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </section>

      <section v-if="activeView === 'logs'" class="view-stack">
        <el-card shadow="never" class="log-workspace">
          <div class="log-summary-grid">
            <button v-for="item in logSummaryCards" :key="item.label" :class="item.type">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <small>{{ item.hint }}</small>
            </button>
          </div>
          <div class="query-panel art-search-bar art-card-xs art-log-panel log-query-panel" :class="{ 'is-expanded': logSearchExpanded }">
            <div class="query-panel-heading log-panel-header">
              <div class="log-panel-title">
                <h4><Document />日志查询</h4>
                <p>按接口、上游、模型、状态、耗时和请求 ID 组合筛选。</p>
              </div>
              <div class="log-panel-meta">
                <span>{{ visibleLogSearchFields.length }} 个条件</span>
              </div>
            </div>
            <div class="art-search-form-grid log-panel-body">
              <div
                v-for="field in visibleLogSearchFields"
                :key="field.key"
                class="search-form-item"
                :class="{ 'is-wide': field.span === 'wide' }"
              >
                <label>{{ field.label }}</label>
                <el-input v-if="field.key === 'keyword'" v-model="logFilter.keyword" placeholder="搜索请求 ID、模型、错误摘要" clearable />
                <el-select v-else-if="field.key === 'status'" v-model="logFilter.status" placeholder="全部状态" clearable>
                  <el-option label="success" value="success" />
                  <el-option label="failed" value="failed" />
                </el-select>
                <el-select v-else-if="field.key === 'interfaceId'" v-model="logFilter.interfaceId" placeholder="全部接口" clearable>
                  <el-option v-for="item in activeInterfaces" :key="item.id" :label="item.name" :value="item.id" />
                </el-select>
                <el-select v-else-if="field.key === 'upstreamId'" v-model="logFilter.upstreamId" placeholder="全部上游" clearable>
                  <el-option v-for="item in activeUpstreams" :key="item.id" :label="item.name" :value="item.id" />
                </el-select>
                <el-input v-else-if="field.key === 'model'" v-model="logFilter.model" placeholder="模型 ID" clearable />
                <el-input v-else-if="field.key === 'endpoint'" v-model="logFilter.endpoint" placeholder="/v1/images/..." clearable />
                <el-input v-else-if="field.key === 'requestId'" v-model="logFilter.requestId" placeholder="请求 ID" clearable />
                <el-date-picker v-else-if="field.key === 'from'" v-model="logFilter.from" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" placeholder="选择开始时间" />
                <el-date-picker v-else-if="field.key === 'to'" v-model="logFilter.to" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" placeholder="选择结束时间" />
                <el-input-number v-else-if="field.key === 'statusMin'" v-model="logFilter.statusMin" :min="100" :max="599" placeholder="状态≥" controls-position="right" />
                <el-input-number v-else-if="field.key === 'statusMax'" v-model="logFilter.statusMax" :min="100" :max="599" placeholder="状态≤" controls-position="right" />
                <el-input-number v-else-if="field.key === 'minDurationMs'" v-model="logFilter.minDurationMs" :min="0" placeholder="耗时≥ms" controls-position="right" />
                <el-input-number v-else-if="field.key === 'maxDurationMs'" v-model="logFilter.maxDurationMs" :min="0" placeholder="耗时≤ms" controls-position="right" />
              </div>
              <div class="art-search-action-column">
                <div class="art-search-action-stack">
                  <div class="art-search-form-buttons">
                    <el-button class="art-search-reset-button" @click="resetLogFilters">重置</el-button>
                    <el-button class="art-search-submit-button" type="primary" :icon="Refresh" @click="refreshLogsOnly">查询</el-button>
                  </div>
                  <button v-if="hiddenLogSearchFieldCount || logSearchExpanded" type="button" class="art-search-filter-toggle" @click="toggleLogSearchExpanded">
                    <span>{{ logSearchExpanded ? '收起筛选' : `展开 ${hiddenLogSearchFieldCount} 项` }}</span>
                    <el-icon>
                      <ArrowUpBold v-if="logSearchExpanded" />
                      <ArrowDownBold v-else />
                    </el-icon>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div class="art-log-panel log-result-panel">
            <div class="result-toolbar log-panel-header">
              <div class="log-panel-title">
                <h4><DataAnalysis />日志结果</h4>
                <p>查看调用明细、质量标记、导出文件和脱敏重放命令。</p>
              </div>
              <div class="log-panel-meta art-toolbar-actions">
                <span>生图 {{ filteredGenerationLogs.length }} / API {{ filteredApiLogs.length }}</span>
                <el-segmented v-model="tableDensity" :options="['default', 'comfortable', 'compact']" />
                <el-button :icon="Refresh" @click="refreshLogsOnly">刷新日志</el-button>
                <el-button :icon="Download" @click="exportLogs('jsonl')">导出 JSONL</el-button>
                <el-button :icon="Download" @click="exportLogs('csv')">导出 CSV</el-button>
              </div>
            </div>
            <div class="log-panel-body">
              <el-tabs v-model="activeLogTab">
                <el-tab-pane label="生图日志" name="generations">
                  <el-table :data="filteredGenerationLogs" :size="tableSize" height="520">
                    <template #empty>
                      <div class="art-empty-state">
                        <Document />
                        <strong>{{ emptyState('generationLogs').title }}</strong>
                        <span>{{ emptyState('generationLogs').description }}</span>
                        <el-button :icon="Refresh" @click="refreshLogsOnly">刷新日志</el-button>
                      </div>
                    </template>
                    <el-table-column prop="createdAt" label="时间" min-width="160"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
                    <el-table-column prop="id" label="请求 ID" min-width="220" show-overflow-tooltip />
                    <el-table-column prop="interfaceId" label="接口" min-width="120" />
                    <el-table-column prop="upstreamId" label="上游" min-width="120" />
                    <el-table-column prop="model" label="模型" min-width="140" />
                    <el-table-column prop="status" label="状态" width="110"><template #default="{ row }"><el-tag :type="row.status === 'success' ? 'success' : 'danger'">{{ row.status }}</el-tag></template></el-table-column>
                    <el-table-column prop="durationMs" label="耗时" width="100"><template #default="{ row }">{{ formatDuration(row.durationMs) }}</template></el-table-column>
                    <el-table-column label="质量标记" width="220">
                      <template #default="{ row }">
                        <el-button size="small" :type="qualityCaseTag(row.id, 'poor') ? 'danger' : 'default'" @click="markQualityCase(row, 'poor')">质量差案例</el-button>
                        <el-button size="small" :type="qualityCaseTag(row.id, 'excellent') ? 'success' : 'default'" @click="markQualityCase(row, 'excellent')">优秀案例</el-button>
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="170" fixed="right">
                      <template #default="{ row }">
                        <el-button size="small" :icon="View" @click="openLogDetail(row)">详情</el-button>
                        <el-button size="small" @click="copySanitizedCurl(row)">curl</el-button>
                      </template>
                    </el-table-column>
                  </el-table>
                </el-tab-pane>
                <el-tab-pane label="后台 API" name="api">
                  <el-table :data="filteredApiLogs" :size="tableSize" height="520">
                    <template #empty>
                      <div class="art-empty-state">
                        <Document />
                        <strong>{{ emptyState('apiLogs').title }}</strong>
                        <span>{{ emptyState('apiLogs').description }}</span>
                        <el-button :icon="Refresh" @click="refreshLogsOnly">刷新日志</el-button>
                      </div>
                    </template>
                    <el-table-column prop="createdAt" label="时间" min-width="160"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
                    <el-table-column prop="method" label="方法" width="90" />
                    <el-table-column prop="path" label="路径" min-width="220" />
                    <el-table-column prop="authKind" label="身份" width="100" />
                    <el-table-column prop="status" label="状态" width="100" />
                    <el-table-column prop="durationMs" label="耗时" width="100"><template #default="{ row }">{{ formatDuration(row.durationMs) }}</template></el-table-column>
                  </el-table>
                </el-tab-pane>
              </el-tabs>
            </div>
          </div>
        </el-card>
      </section>

      <section v-if="activeView === 'usage'" class="view-stack usage-workspace">
        <div class="usage-summary-grid">
          <button v-for="item in usageSummaryCards" :key="item.label" :class="item.type" type="button">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.hint }}</small>
          </button>
        </div>
        <div class="usage-analytics-grid">
          <el-card shadow="never" class="usage-trend-workspace art-usage-panel">
            <template #header>
              <div class="usage-panel-header">
                <div class="usage-panel-title">
                  <h4><DataAnalysis />近 7 日消耗趋势</h4>
                  <p>观察近期生成量波动和峰值日期。</p>
                </div>
                <div class="usage-panel-meta">
                  <span>{{ usageTrendBars.length }} 天</span>
                </div>
              </div>
            </template>
            <div class="usage-panel-body">
              <div class="art-trend-chart" aria-label="近 7 日用量趋势">
                <div v-for="item in usageTrendBars" :key="item.name" class="art-trend-bar">
                  <span>{{ item.total }}</span>
                  <i :style="{ height: item.height + '%' }"></i>
                  <small>{{ item.shortName }}</small>
                </div>
                <div v-if="!usageTrendBars.length" class="art-chart-empty">暂无用量数据</div>
              </div>
            </div>
          </el-card>
          <el-card shadow="never" class="usage-cost-workspace art-usage-panel">
            <template #header>
              <div class="usage-panel-header">
                <div class="usage-panel-title">
                  <h4><Timer />成本排行</h4>
                  <p>按模型、接口和上游聚合估算支出。</p>
                </div>
                <div class="usage-panel-meta">
                  <span>Top {{ usageCostLeaders.length }}</span>
                </div>
              </div>
            </template>
            <div class="usage-panel-body">
              <div class="usage-leader-list">
                <div v-for="item in usageCostLeaders" :key="item.scope + item.name" class="usage-leader-row">
                  <div>
                    <span>{{ item.scope }}</span>
                    <strong>{{ item.name }}</strong>
                  </div>
                  <p>{{ formatCost(item.estimatedCostUSD) }}</p>
                  <small>{{ item.imageCount }} 张 / {{ item.total }} 次</small>
                </div>
                <div v-if="!usageCostLeaders.length" class="art-chart-empty">暂无成本数据</div>
              </div>
            </div>
          </el-card>
          <el-card shadow="never" class="usage-efficiency-workspace art-usage-panel">
            <template #header>
              <div class="usage-panel-header">
                <div class="usage-panel-title">
                  <h4><Monitor />效率诊断</h4>
                  <p>按成功率和平均耗时定位慢路径。</p>
                </div>
                <div class="usage-panel-meta">
                  <span>{{ usageEfficiencyRows.length }} 项</span>
                </div>
              </div>
            </template>
            <div class="usage-panel-body">
              <div class="usage-efficiency-list">
                <div v-for="item in usageEfficiencyRows" :key="item.name" class="usage-efficiency-row">
                  <div>
                    <strong>{{ item.name }}</strong>
                    <span>{{ formatDuration(item.averageDurationMs) }} 平均耗时</span>
                  </div>
                  <el-tag :type="item.healthType">{{ item.healthLabel }}</el-tag>
                  <small>{{ formatPercent(item.successRate) }}</small>
                </div>
                <div v-if="!usageEfficiencyRows.length" class="art-chart-empty">暂无效率数据</div>
              </div>
            </div>
          </el-card>
        </div>
        <el-card shadow="never" class="usage-breakdown-workspace art-usage-panel usage-breakdown-panel">
          <template #header>
            <div class="result-toolbar usage-panel-header">
              <div class="usage-panel-title">
                <h4><DataAnalysis />用量明细</h4>
                <p>按日期、接口、模型和上游拆分调用量、成功率、耗时与估算成本。</p>
              </div>
              <div class="usage-panel-meta art-toolbar-actions">
                <el-segmented v-model="tableDensity" :options="[
                  { label: '默认', value: 'default' },
                  { label: '舒适', value: 'comfortable' },
                  { label: '紧凑', value: 'compact' }
                ]" />
                <el-button :icon="Refresh" @click="refreshAll">刷新用量</el-button>
              </div>
            </div>
          </template>
          <el-tabs>
            <el-tab-pane label="按日期">
              <el-table :data="usageDateRows" :size="tableSize" height="420" empty-text="暂无日期用量">
                <el-table-column prop="name" label="日期" min-width="130" />
                <el-table-column prop="total" label="调用" width="90" />
                <el-table-column prop="imageCount" label="图片" width="90" />
                <el-table-column prop="successRate" label="成功率" width="110"><template #default="{ row }">{{ formatPercent(row.successRate) }}</template></el-table-column>
                <el-table-column prop="estimatedCostUSD" label="估算成本" width="130"><template #default="{ row }">{{ formatCost(row.estimatedCostUSD) }}</template></el-table-column>
                <el-table-column prop="averageDurationMs" label="平均耗时" width="120"><template #default="{ row }">{{ formatDuration(row.averageDurationMs) }}</template></el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="按接口">
              <el-table :data="usageInterfaceRows" :size="tableSize" height="420" empty-text="暂无接口用量">
                <el-table-column prop="name" label="接口" min-width="140" />
                <el-table-column prop="total" label="调用" width="90" />
                <el-table-column prop="success" label="成功" width="90" />
                <el-table-column prop="failed" label="失败" width="90" />
                <el-table-column prop="imageCount" label="图片" width="90" />
                <el-table-column prop="estimatedCostUSD" label="估算成本" width="130"><template #default="{ row }">{{ formatCost(row.estimatedCostUSD) }}</template></el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="按模型">
              <el-table :data="usageModelRows" :size="tableSize" height="420" empty-text="暂无模型用量">
                <el-table-column prop="name" label="模型" min-width="160" />
                <el-table-column prop="total" label="调用" width="90" />
                <el-table-column prop="imageCount" label="图片" width="90" />
                <el-table-column prop="successRate" label="成功率" width="110"><template #default="{ row }">{{ formatPercent(row.successRate) }}</template></el-table-column>
                <el-table-column prop="estimatedCostUSD" label="估算成本" width="130"><template #default="{ row }">{{ formatCost(row.estimatedCostUSD) }}</template></el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="按上游">
              <el-table :data="usageUpstreamRows" :size="tableSize" height="420" empty-text="暂无上游用量">
                <el-table-column prop="name" label="上游" min-width="140" />
                <el-table-column prop="total" label="调用" width="90" />
                <el-table-column prop="success" label="成功" width="90" />
                <el-table-column prop="failed" label="失败" width="90" />
                <el-table-column prop="successRate" label="成功率" width="110"><template #default="{ row }">{{ formatPercent(row.successRate) }}</template></el-table-column>
                <el-table-column prop="estimatedCostUSD" label="估算成本" width="130"><template #default="{ row }">{{ formatCost(row.estimatedCostUSD) }}</template></el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </section>

      <section v-if="activeView === 'alerts'" class="view-stack alerts-workspace">
        <div class="alerts-summary-grid">
          <button v-for="item in alertSummaryCards" :key="item.label" :class="item.type === 'critical' ? 'critical' : item.type === 'success' ? 'success' : item.type === 'warning' ? 'warning' : 'info'" type="button">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.hint }}</small>
          </button>
        </div>
        <div class="alerts-workspace-grid">
          <el-card shadow="never" class="alert-queue-workspace art-alert-panel alert-queue-panel">
            <template #header>
              <div class="alert-panel-header">
                <div class="alert-panel-title">
                  <h4><Bell />当前告警</h4>
                  <p>集中查看活跃风险、确认状态和处理入口。</p>
                </div>
                <div class="alert-panel-actions">
                  <el-tag :type="pendingAlertCount ? 'danger' : 'success'">待处理 {{ pendingAlertCount }}</el-tag>
                  <el-button class="alert-panel-action" :icon="Refresh" @click="refreshAll">刷新</el-button>
                </div>
              </div>
            </template>
            <div class="alert-panel-body">
              <el-table :data="activeAlerts" :size="tableSize" height="420" empty-text="暂无活跃告警">
                <template #empty>
                  <div class="art-empty-state">
                    <Bell />
                    <strong>{{ emptyState('alerts').title }}</strong>
                    <span>{{ emptyState('alerts').description }}</span>
                    <el-button :icon="Refresh" @click="refreshAll">刷新告警</el-button>
                  </div>
                </template>
                <el-table-column prop="severity" label="级别" width="110">
                  <template #default="{ row }"><el-tag :type="alertTagType(row.severity)">{{ row.severity }}</el-tag></template>
                </el-table-column>
                <el-table-column prop="title" label="告警" min-width="180" />
                <el-table-column prop="message" label="说明" min-width="360" show-overflow-tooltip />
                <el-table-column prop="acknowledged" label="状态" width="110">
                  <template #default="{ row }"><el-tag :type="row.acknowledged ? 'info' : 'danger'">{{ row.acknowledged ? '已确认' : '待处理' }}</el-tag></template>
                </el-table-column>
                <el-table-column label="操作" width="120">
                  <template #default="{ row }"><el-button size="small" class="alert-panel-action" :disabled="row.acknowledged" @click="acknowledgeAlert(row.id)">确认</el-button></template>
                </el-table-column>
              </el-table>
            </div>
          </el-card>
          <div class="alerts-side-stack">
            <el-card shadow="never" class="notification-workspace art-alert-panel alert-notification-panel">
              <template #header>
                <div class="alert-panel-header">
                  <div class="alert-panel-title">
                    <h4><Bell />通知状态</h4>
                    <p>检查 webhook 通知是否启用，以及最近发送结果。</p>
                  </div>
                </div>
              </template>
              <div class="alert-panel-body">
                <div class="art-alert-status-list">
                  <div><span>Webhook</span><strong>{{ config?.alerts.webhookEnabled ? '已启用' : '未启用' }}</strong></div>
                  <div><span>最近发送</span><strong>{{ notificationLabel(alertNotification.status) }}</strong></div>
                  <div><span>HTTP 状态</span><strong>{{ alertNotification.webhookStatus || '-' }}</strong></div>
                  <div><span>通知条数</span><strong>{{ alertNotification.alertCount || 0 }}</strong></div>
                </div>
              </div>
            </el-card>
            <el-card shadow="never" class="alert-rules-workspace art-alert-panel alert-rules-panel">
              <template #header>
                <div class="alert-panel-header">
                  <div class="alert-panel-title">
                    <h4><Operation />告警规则</h4>
                    <p>配置成功率、延迟、上游失败和 webhook 触发条件。</p>
                  </div>
                </div>
              </template>
              <div class="alert-panel-body">
                <el-form v-if="config" :model="alertsForm" label-width="150px" class="art-alert-form">
                  <el-form-item label="Webhook 通知"><el-switch v-model="config.alerts.webhookEnabled" /></el-form-item>
                  <el-form-item label="Webhook URL"><el-input v-model="config.alerts.webhookURL" placeholder="https://hooks.example/a" /></el-form-item>
                  <el-form-item label="上游失败阈值"><el-input-number v-model="config.alerts.upstreamFailureThreshold" :min="1" /></el-form-item>
                  <el-form-item label="成功率阈值"><el-input-number v-model="config.alerts.successRateThreshold" :min="1" :max="100" /></el-form-item>
                  <el-form-item label="P95 阈值 ms"><el-input-number v-model="config.alerts.p95LatencyMsThreshold" :min="100" /></el-form-item>
                  <el-form-item><el-button type="primary" class="alert-panel-action" @click="saveAlerts">保存告警配置</el-button></el-form-item>
                </el-form>
              </div>
            </el-card>
          </div>
        </div>
      </section>

      <section v-if="activeView === 'security'" class="view-stack security-workspace">
        <div class="security-overview">
          <el-card shadow="never" class="security-score-card">
            <div class="score-shell">
              <div>
                <span>安全评分</span>
                <strong>{{ securityScore }}</strong>
                <small>{{ securityScore >= 85 ? '策略完整' : securityScore >= 65 ? '仍有加固空间' : '需要优先处理' }}</small>
              </div>
              <el-progress type="dashboard" :percentage="securityScore" :width="116" :stroke-width="10" />
            </div>
            <div class="score-hints">
              <el-tag :type="securityForm.totpEnabled ? 'success' : 'warning'">TOTP {{ securityForm.totpEnabled ? '已启用' : '未启用' }}</el-tag>
              <el-tag :type="securityForm.failedLoginLockoutEnabled ? 'success' : 'danger'">失败锁定 {{ securityForm.failedLoginLockoutEnabled ? '开启' : '关闭' }}</el-tag>
              <el-tag :type="securityForm.ipAllowlist.length ? 'success' : 'info'">白名单 {{ securityForm.ipAllowlist.length }} 条</el-tag>
            </div>
          </el-card>
          <div class="security-summary-grid">
            <button v-for="item in securitySummaryCards" :key="item.label" :class="item.type === 'success' ? 'success' : item.type === 'warning' ? 'warning' : 'info'" type="button">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <small>{{ item.hint }}</small>
            </button>
          </div>
        </div>
        <div class="security-policy-grid">
          <el-card shadow="never" class="art-security-panel security-account-panel">
            <template #header>
              <div class="security-panel-header">
                <div class="security-panel-title">
                  <h4><Lock />账号与安全</h4>
                  <p>限制后台入口来源，并保持失败登录自动锁定。</p>
                </div>
              </div>
            </template>
            <div class="security-panel-body">
              <el-form v-if="config" label-width="140px" class="art-security-form">
                <el-form-item label="IP 白名单"><el-input :model-value="securityForm.ipAllowlist.join('\n')" type="textarea" :rows="5" placeholder="每行一个 IP，例如 203.0.113.10" @update:model-value="(value: string) => config && (config.security.ipAllowlist = value.split('\n').map((item) => item.trim()).filter(Boolean))" /></el-form-item>
                <el-form-item label="失败登录锁定"><el-switch v-model="config.security.failedLoginLockoutEnabled" /></el-form-item>
                <el-form-item><el-button type="primary" class="security-panel-action" @click="saveConfig('安全配置已保存')">保存安全配置</el-button></el-form-item>
              </el-form>
            </div>
          </el-card>
          <el-card shadow="never" class="art-security-panel security-totp-panel">
            <template #header>
              <div class="security-panel-header">
                <div class="security-panel-title">
                  <h4><Key />TOTP 二次验证</h4>
                  <p>用认证器验证码保护后台登录。</p>
                </div>
                <el-tag :type="securityForm.totpEnabled ? 'success' : 'info'">{{ securityForm.totpEnabled ? '已启用' : '未启用' }}</el-tag>
              </div>
            </template>
            <div class="security-panel-body totp-panel">
              <div class="art-security-status-row">
                <span>当前状态</span>
                <el-tag :type="securityForm.totpEnabled ? 'success' : 'info'">{{ securityForm.totpEnabled ? '已启用' : '未启用' }}</el-tag>
                <el-tag v-if="securityForm.totpConfigured && !securityForm.totpEnabled" type="warning">待验证</el-tag>
              </div>
              <el-alert v-if="!securityForm.totpEnabled" title="生成密钥后，用认证器添加 otpauth URI 或手动输入密钥，再提交 6 位验证码完成启用。" type="info" show-icon :closable="false" />
              <el-form label-width="120px" class="art-security-form">
                <template v-if="totpSetup">
                  <el-form-item label="手动密钥"><el-input :model-value="totpSetup.secret" readonly /></el-form-item>
                  <el-form-item label="otpauth URI"><el-input :model-value="totpSetup.otpauthURL" type="textarea" :rows="3" readonly /></el-form-item>
                </template>
                <el-form-item label="验证码">
                  <el-input v-model="totpCode" maxlength="6" placeholder="认证器中的 6 位验证码" />
                </el-form-item>
                <el-form-item>
                  <el-button v-if="!securityForm.totpEnabled" class="security-panel-action" @click="setupTOTP">生成 TOTP 密钥</el-button>
                  <el-button v-if="!securityForm.totpEnabled" type="primary" class="security-panel-action" :disabled="!securityForm.totpConfigured && !totpSetup" @click="enableTOTP">启用 TOTP</el-button>
                  <el-button v-else type="danger" plain class="security-panel-action" @click="disableTOTP">禁用 TOTP</el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-card>
          <el-card shadow="never" class="art-security-panel security-password-panel">
            <template #header>
              <div class="security-panel-header">
                <div class="security-panel-title">
                  <h4><Key />修改账号密码</h4>
                  <p>更新管理员账号和后台登录密码。</p>
                </div>
              </div>
            </template>
            <div class="security-panel-body">
              <el-form :model="accountForm" label-width="120px" class="art-security-form">
                <el-form-item label="账号"><el-input v-model="accountForm.username" /></el-form-item>
                <el-form-item label="当前密码"><el-input v-model="accountForm.currentPassword" type="password" show-password /></el-form-item>
                <el-form-item label="新密码"><el-input v-model="accountForm.newPassword" type="password" show-password /></el-form-item>
                <el-form-item><el-button type="primary" class="security-panel-action" @click="saveAccount">保存账号</el-button></el-form-item>
              </el-form>
            </div>
          </el-card>
        </div>
        <div class="session-workspace">
          <el-card shadow="never" class="art-security-panel session-list-panel">
            <template #header>
              <div class="security-panel-header">
                <div class="security-panel-title">
                  <h4><Collection />当前会话</h4>
                  <p>查看当前登录会话并清理其他设备。</p>
                </div>
                <el-button size="small" type="warning" plain class="security-panel-action" @click="revokeOtherSessions">退出其他会话</el-button>
              </div>
            </template>
            <div class="security-panel-body">
              <el-table :data="sessions" :size="tableSize">
                <template #empty>
                  <div class="art-empty-state">
                    <Collection />
                    <strong>{{ emptyState('sessions').title }}</strong>
                    <span>{{ emptyState('sessions').description }}</span>
                    <el-button :icon="Refresh" @click="refreshAll">刷新会话</el-button>
                  </div>
                </template>
                <el-table-column prop="username" label="账号" />
                <el-table-column prop="createdAt" label="登录时间"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
                <el-table-column prop="current" label="当前" width="90"><template #default="{ row }"><el-tag v-if="row.current" type="success">当前</el-tag></template></el-table-column>
                <el-table-column label="操作" width="100"><template #default="{ row }"><el-button v-if="!row.current" size="small" @click="revokeSession(row.id)">退出</el-button></template></el-table-column>
              </el-table>
            </div>
          </el-card>
          <el-card shadow="never" class="art-security-panel login-history-panel">
            <template #header>
              <div class="security-panel-header">
                <div class="security-panel-title">
                  <h4><Document />登录历史</h4>
                  <p>最近后台认证事件，用于排查异常登录。</p>
                </div>
              </div>
            </template>
            <div class="security-panel-body">
              <el-table :data="loginHistoryRows" :size="tableSize" height="280">
                <el-table-column prop="createdAt" label="时间"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
                <el-table-column prop="username" label="账号" />
                <el-table-column prop="action" label="动作" />
              </el-table>
            </div>
          </el-card>
        </div>
        <el-card shadow="never" class="audit-workspace art-security-panel audit-log-panel">
          <template #header>
            <div class="audit-panel-header">
              <div class="audit-panel-title">
                <h4><Document />审计日志</h4>
                <p>记录登录、配置保存、密钥查看、恢复配置等关键操作。</p>
              </div>
              <el-button size="small" class="audit-panel-action" :icon="Refresh" @click="refreshAll">刷新审计</el-button>
            </div>
          </template>
          <div class="audit-panel-body">
            <el-table :data="auditLogs" :size="tableSize" height="360">
              <template #empty>
                <div class="art-empty-state">
                  <Document />
                  <strong>{{ emptyState('audit').title }}</strong>
                  <span>{{ emptyState('audit').description }}</span>
                  <el-button :icon="Refresh" @click="refreshAll">刷新审计</el-button>
                </div>
              </template>
              <el-table-column prop="createdAt" label="时间" min-width="160"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
              <el-table-column prop="username" label="操作者" width="120" />
              <el-table-column prop="action" label="动作" min-width="160" />
              <el-table-column prop="details" label="详情" min-width="260"><template #default="{ row }">{{ JSON.stringify(row.details || {}) }}</template></el-table-column>
            </el-table>
          </div>
        </el-card>
      </section>

      <section v-if="activeView === 'system'" class="view-stack system-workspace">
        <div class="system-summary-grid">
          <button v-for="item in systemSummaryCards" :key="item.label" :class="item.type === 'success' ? 'success' : item.type === 'warning' ? 'warning' : 'info'" type="button">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.hint }}</small>
          </button>
        </div>
        <div class="system-workspace-grid">
          <el-card shadow="never" class="backup-workspace art-system-panel system-backup-panel">
            <template #header>
              <div class="system-panel-header">
                <div class="system-panel-title">
                  <h4><Download />备份恢复</h4>
                  <p>下载配置快照，上传备份文件恢复到指定版本。</p>
                </div>
                <div class="system-panel-actions">
                  <el-button type="primary" class="system-panel-action" :icon="Download" @click="createBackup">一键备份</el-button>
                  <el-button class="system-panel-action" :icon="Upload" @click="openRestorePicker">上传恢复</el-button>
                </div>
              </div>
            </template>
            <div class="system-panel-body">
              <div class="art-system-backup-status">
                <input ref="backupFileInput" class="art-system-file-input" type="file" accept="application/json,.json" @change="restoreFromFile" />
                <span>{{ backupStatus || '自动保留最近配置快照，恢复前请确认版本。' }}</span>
              </div>
              <el-table :data="backups" :size="tableSize" height="320" empty-text="暂无备份">
                <template #empty>
                  <div class="art-empty-state">
                    <Download />
                    <strong>{{ emptyState('backups').title }}</strong>
                    <span>{{ emptyState('backups').description }}</span>
                    <el-button type="primary" :icon="Download" @click="createBackup">一键备份</el-button>
                  </div>
                </template>
                <el-table-column prop="createdAt" label="备份时间" min-width="160"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
                <el-table-column prop="username" label="操作者" width="120" />
                <el-table-column prop="summary" label="摘要" min-width="180" />
                <el-table-column label="操作" width="180">
                  <template #default="{ row }">
                    <el-button size="small" class="system-panel-action" @click="downloadBackup(row)">下载</el-button>
                    <el-button size="small" type="warning" plain class="system-panel-action" @click="restoreBackup(row.id)">恢复</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-card>
          <el-card shadow="never" class="version-workspace art-system-panel system-version-panel">
            <template #header>
              <div class="system-panel-header">
                <div class="system-panel-title">
                  <h4><Document />配置版本历史</h4>
                  <p>每次保存前生成快照，可按时间点恢复配置。</p>
                </div>
              </div>
            </template>
            <div class="system-panel-body">
              <el-table :data="versions" :size="tableSize" height="320" empty-text="暂无配置版本">
                <template #empty>
                  <div class="art-empty-state">
                    <Document />
                    <strong>{{ emptyState('versions').title }}</strong>
                    <span>{{ emptyState('versions').description }}</span>
                    <el-button :icon="Finished" class="system-panel-action" @click="saveConfig()">保存配置生成快照</el-button>
                  </div>
                </template>
                <el-table-column prop="createdAt" label="时间" min-width="160"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
                <el-table-column prop="username" label="操作者" width="120" />
                <el-table-column prop="summary" label="摘要" min-width="200" />
                <el-table-column label="操作" width="120"><template #default="{ row }"><el-button size="small" class="system-panel-action" @click="restoreVersion(row.id)">恢复</el-button></template></el-table-column>
              </el-table>
            </div>
          </el-card>
          <el-card shadow="never" class="update-workspace art-system-panel system-update-panel">
            <template #header>
              <div class="system-panel-header">
                <div class="system-panel-title">
                  <h4><Cpu />版本更新</h4>
                  <p>查看当前版本、远端发布状态和回滚入口。</p>
                </div>
                <el-tag :type="updateInfo.status === 'outdated' ? 'warning' : updateInfo.status === 'current' ? 'success' : 'info'">{{ updateInfo.status || 'unknown' }}</el-tag>
              </div>
            </template>
            <div class="system-panel-body">
              <div class="art-system-status-list">
                <div><span>当前版本</span><strong>{{ updateInfo.currentVersion || 'dev' }}</strong></div>
                <div><span>当前 Commit</span><strong>{{ updateInfo.currentCommit || '未知' }}</strong></div>
                <div><span>Docker Tag</span><strong>{{ updateInfo.dockerImageTag || 'latest' }}</strong></div>
                <div><span>最新版本</span><strong>{{ updateInfo.latestVersion || '未知' }}</strong></div>
                <div><span>状态</span><strong>{{ updateInfo.status || 'unknown' }}</strong></div>
                <div><span>来源</span><strong>{{ updateInfo.source || 'release' }}</strong></div>
              </div>
              <div class="art-system-update-actions system-panel-actions">
                <el-button type="primary" class="system-panel-action" :icon="Download" @click="createBackup">更新前备份</el-button>
                <el-button class="system-panel-action" :disabled="!updateInfo.changelogURL && !updateInfo.releaseURL" @click="openUpdateLink">查看 Changelog</el-button>
                <el-button class="system-panel-action" :disabled="!updateInfo.rollbackCommand" @click="copyRollbackCommand">复制回滚命令</el-button>
              </div>
              <div v-if="updateInfo.changelog" class="changelog-preview">
                <strong>Changelog</strong>
                <pre>{{ updateInfo.changelog }}</pre>
              </div>
              <div v-if="updateInfo.rollbackCommand" class="rollback-command">
                <span>回滚入口</span>
                <code>{{ updateInfo.rollbackCommand }}</code>
              </div>
            </div>
          </el-card>
        </div>
            </section>
          </div>
        </Transition>
        <div v-show="showPageTransitionMask" class="page-transition-mask"></div>
      </div>
    </main>

    <el-popover
      v-model:visible="tableColumnSettingsVisible"
      placement="bottom-end"
      trigger="manual"
      width="260"
      popper-class="art-column-settings-popover"
    >
      <div class="art-column-settings-panel">
        <div class="art-column-settings-head">
          <strong>列设置</strong>
          <el-button link type="primary" @click="resetTableColumns">恢复默认</el-button>
        </div>
        <div class="art-column-option-list">
          <div v-for="item in visibleTableColumnOptions" :key="item.key" class="art-column-option-row" :class="{ 'fixed-column': item.fixed }">
            <span class="art-column-drag-icon">⋮⋮</span>
            <el-checkbox
              :model-value="isTableColumnVisible(activeTableModule, item.key)"
              :disabled="item.fixed"
              @update:model-value="(value: boolean | string | number) => toggleTableColumn(item.key, value)"
            >
              {{ item.label }}
            </el-checkbox>
          </div>
        </div>
      </div>
      <template #reference>
        <span class="art-column-settings-anchor" aria-hidden="true"></span>
      </template>
    </el-popover>

    <div v-if="notificationPanelVisible" class="art-notification-panel" @click.stop>
      <div class="notification-panel-head">
        <div>
          <span>Notification</span>
          <strong>运维通知</strong>
        </div>
        <el-button text @click="viewAllNotifications">查看全部</el-button>
      </div>
      <div class="notification-tab-bar">
        <button
          v-for="tab in notificationTabs"
          :key="tab.key"
          type="button"
          :class="{ active: activeNotificationTab === tab.key }"
          @click="activeNotificationTab = tab.key"
        >
          {{ tab.label }} ({{ tab.count }})
        </button>
      </div>
      <div class="notification-list">
        <button
          v-for="item in notificationPreviewItems"
          :key="item.id"
          type="button"
          :class="item.type"
          @click="viewAllNotifications"
        >
          <i></i>
          <span>{{ item.title }}</span>
          <small>{{ item.time }}</small>
          <p>{{ item.meta }}</p>
        </button>
        <div v-if="!notificationPreviewItems.length" class="notification-empty">
          <Bell />
          <span>当前没有{{ notificationTabs.find((item) => item.key === activeNotificationTab)?.label || '通知' }}</span>
        </div>
      </div>
      <el-button class="notification-view-all" @click="viewAllNotifications">进入告警中心</el-button>
    </div>

    <el-dialog v-model="globalSearchVisible" width="620px" :show-close="false" class="global-search-command" @closed="closeGlobalSearch">
      <div class="command-search-input">
        <el-input
          ref="globalSearchInputRef"
          v-model="headerSearchKeyword"
          :prefix-icon="Search"
          clearable
          placeholder="搜索页面、配置、日志"
        />
      </div>
      <div class="command-result-list">
        <button
          v-for="(item, index) in headerSearchResults"
          :key="item.key"
          type="button"
          :class="{ active: highlightedSearchIndex === index }"
          @click="selectHeaderSearch(item.key)"
          @mouseenter="highlightedSearchIndex = index"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
          <small>{{ item.hint }}</small>
        </button>
        <div v-if="!headerSearchResults.length" class="global-search-empty">没有匹配的模块</div>
      </div>
      <template #footer>
        <div class="command-shortcuts">
          <span><kbd>Enter</kbd> 进入</span>
          <span><kbd>↑ ↓</kbd> 切换</span>
          <span><kbd>Esc</kbd> 退出</span>
        </div>
      </template>
    </el-dialog>

    <el-drawer v-model="settingsPanelVisible" title="" size="420px" destroy-on-close class="art-settings-panel">
      <div class="setting-panel-header">
        <div>
          <span>Art Design Pro</span>
          <h3>后台外观设置</h3>
          <p>调整主题、菜单布局和表格密度，保持当前运维上下文不跳页。</p>
        </div>
        <el-button :icon="Close" circle @click="closeSettingsPanel" />
      </div>

      <section class="setting-section">
        <div class="setting-section-title"><Sunny /><span>主题风格</span></div>
        <el-segmented v-model="themeMode" :options="[
          { label: '浅色', value: 'light' },
          { label: '深色', value: 'dark' },
        ]" @change="persistSettings" />
        <div class="setting-option-grid">
          <button
            v-for="item in settingsOptions.theme"
            :key="item.value"
            type="button"
            :class="{ active: themeMode === item.value }"
            @click="applySettingsPreset('theme', item.value)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <strong>{{ item.label }}</strong>
            <span>{{ item.hint }}</span>
          </button>
        </div>
      </section>

      <section class="setting-section">
        <div class="setting-section-title"><Operation /><span>菜单布局</span></div>
        <div class="setting-option-grid">
          <button
            v-for="item in settingsOptions.layout"
            :key="item.value"
            type="button"
            :class="{ active: layoutMode === item.value }"
            @click="applySettingsPreset('layout', item.value)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <strong>{{ item.label }}</strong>
            <span>{{ item.hint }}</span>
          </button>
        </div>
      </section>

      <section class="setting-section">
        <div class="setting-section-title"><MagicStick /><span>菜单风格</span></div>
        <div class="setting-option-grid">
          <button
            v-for="item in settingsOptions.menuStyle"
            :key="item.value"
            type="button"
            :class="{ active: menuStyleMode === item.value }"
            @click="applySettingsPreset('menuStyle', item.value)"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <strong>{{ item.label }}</strong>
            <span>{{ item.hint }}</span>
          </button>
        </div>
      </section>

      <section class="setting-section">
        <div class="setting-section-title"><Collection /><span>表格密度</span></div>
        <el-segmented v-model="tableDensity" :options="[
          { label: '默认', value: 'default' },
          { label: '舒适', value: 'comfortable' },
          { label: '紧凑', value: 'compact' },
        ]" @change="persistSettings" />
        <div class="setting-density-preview">
          <span>当前模式</span>
          <strong>{{ tableDensity }}</strong>
          <small>接口、上游、日志、成本等表格会同步使用这个密度。</small>
        </div>
      </section>

      <template #footer>
        <div class="setting-actions">
          <el-button @click="resetSettingsPanel">恢复默认</el-button>
          <el-button type="primary" @click="closeSettingsPanel">完成</el-button>
        </div>
      </template>
    </el-drawer>

    <el-drawer v-model="drawerVisible" :title="drawerTitle()" size="620px" destroy-on-close class="config-drawer">
      <div v-if="drawerContext" class="art-drawer-overview">
        <div>
          <span>{{ drawerContext.eyebrow }}</span>
          <h3>{{ drawerContext.title }}</h3>
          <p>{{ drawerContext.description }}</p>
        </div>
        <el-tag :type="drawerContext.enabled ? 'success' : 'warning'">{{ drawerContext.enabled ? '启用' : '停用' }}</el-tag>
      </div>
      <div class="art-drawer-status-grid">
        <div v-for="item in drawerStatusCards" :key="item.label" :class="item.type">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
      <template v-if="config && drawerMode === 'interface' && config.interfaces[drawerIndex]">
        <el-form :model="config.interfaces[drawerIndex]" label-position="top" class="art-drawer-form">
          <section class="art-drawer-section">
            <div class="art-drawer-section-title"><Connection /><span>基础信息</span></div>
            <div class="art-drawer-form-grid">
              <el-form-item label="接口 ID"><el-input v-model="config.interfaces[drawerIndex].id" /></el-form-item>
              <el-form-item label="名称"><el-input v-model="config.interfaces[drawerIndex].name" /></el-form-item>
              <el-form-item label="启用"><el-switch v-model="config.interfaces[drawerIndex].enabled" /></el-form-item>
              <el-form-item label="最后使用"><el-input :model-value="formatTime(config.interfaces[drawerIndex].lastUsedAt)" readonly /></el-form-item>
            </div>
          </section>
          <section class="art-drawer-section">
            <div class="art-drawer-section-title"><Key /><span>密钥与路由</span></div>
            <div class="art-drawer-form-grid">
              <el-form-item label="Skill 调用 Key" class="art-drawer-form-wide">
                <div class="art-secret-line">
                  <el-input v-model="config.interfaces[drawerIndex].apiToken" :placeholder="config.interfaces[drawerIndex].apiTokenSet ? '已保存，留空保持不变' : '请输入 Key'" />
                  <el-button :icon="secretValues[`interface:${config.interfaces[drawerIndex].id}`] ? Hide : View" @click="revealSecret('interface', config.interfaces[drawerIndex].id)">显示</el-button>
                  <el-button :icon="Key" @click="copySecret('interface', config.interfaces[drawerIndex].id)">复制</el-button>
                </div>
                <el-input v-if="secretValues[`interface:${config.interfaces[drawerIndex].id}`]" :model-value="secretValues[`interface:${config.interfaces[drawerIndex].id}`]" readonly />
              </el-form-item>
              <el-form-item label="上游绑定" class="art-drawer-form-wide"><el-select v-model="config.interfaces[drawerIndex].upstreamIds" multiple><el-option v-for="item in activeUpstreams" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
            </div>
          </section>
          <section class="art-drawer-section">
            <div class="art-drawer-section-title"><MagicStick /><span>默认出图参数</span></div>
            <div class="art-drawer-form-grid">
              <el-form-item label="默认模型"><el-input v-model="config.interfaces[drawerIndex].defaultImageModel" /></el-form-item>
              <el-form-item label="尺寸"><el-input v-model="config.interfaces[drawerIndex].defaultSize" /></el-form-item>
              <el-form-item label="质量"><el-select v-model="config.interfaces[drawerIndex].defaultQuality"><el-option value="high" label="high" /><el-option value="medium" label="medium" /><el-option value="low" label="low" /><el-option value="auto" label="auto" /></el-select></el-form-item>
              <el-form-item label="输出格式"><el-input v-model="config.interfaces[drawerIndex].defaultOutputFormat" /></el-form-item>
              <el-form-item label="质量预设" class="art-drawer-form-wide"><el-select v-model="config.interfaces[drawerIndex].qualityPresetId"><el-option v-for="item in activePresets" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
            </div>
          </section>
          <section class="art-drawer-section">
            <div class="art-drawer-section-title"><Timer /><span>请求策略</span></div>
            <div class="art-drawer-form-grid">
              <el-form-item label="超时秒数"><el-input-number v-model="config.interfaces[drawerIndex].requestTimeoutSeconds" :min="10" :max="900" /></el-form-item>
              <el-form-item label="并发上限"><el-input-number v-model="config.interfaces[drawerIndex].maxConcurrentRequests" :min="1" :max="10" /></el-form-item>
              <el-form-item label="每分钟限流"><el-input-number v-model="config.interfaces[drawerIndex].rateLimitPerMinute" :min="1" :max="600" /></el-form-item>
            </div>
          </section>
        </el-form>
      </template>

      <template v-if="config && drawerMode === 'upstream' && config.upstreams[drawerIndex]">
        <el-form :model="config.upstreams[drawerIndex]" label-position="top" class="art-drawer-form">
          <section class="art-drawer-section">
            <div class="art-drawer-section-title"><Link /><span>基础信息</span></div>
            <div class="art-drawer-form-grid">
              <el-form-item label="上游 ID"><el-input v-model="config.upstreams[drawerIndex].id" /></el-form-item>
              <el-form-item label="名称"><el-input v-model="config.upstreams[drawerIndex].name" /></el-form-item>
              <el-form-item label="Base URL" class="art-drawer-form-wide"><el-input v-model="config.upstreams[drawerIndex].baseURL" /></el-form-item>
            </div>
          </section>
          <section class="art-drawer-section">
            <div class="art-drawer-section-title"><Key /><span>认证密钥</span></div>
            <el-form-item label="上游 API Key">
              <div class="art-secret-line">
                <el-input v-model="config.upstreams[drawerIndex].apiKey" :placeholder="config.upstreams[drawerIndex].apiKeySet ? '已保存，留空保持不变' : '请输入 Key'" />
                <el-button :icon="secretValues[`upstream:${config.upstreams[drawerIndex].id}`] ? Hide : View" @click="revealSecret('upstream', config.upstreams[drawerIndex].id)">显示</el-button>
                <el-button :icon="Key" @click="copySecret('upstream', config.upstreams[drawerIndex].id)">复制</el-button>
              </div>
              <el-input v-if="secretValues[`upstream:${config.upstreams[drawerIndex].id}`]" :model-value="secretValues[`upstream:${config.upstreams[drawerIndex].id}`]" readonly />
            </el-form-item>
          </section>
          <section class="art-drawer-section">
            <div class="art-drawer-section-title"><Operation /><span>调度策略</span></div>
            <div class="art-drawer-form-grid">
              <el-form-item label="优先级"><el-input-number v-model="config.upstreams[drawerIndex].priority" :min="1" :max="1000" /></el-form-item>
              <el-form-item label="权重"><el-input-number v-model="config.upstreams[drawerIndex].weight" :min="1" :max="100" /></el-form-item>
              <el-form-item label="参与故障转移"><el-switch v-model="config.upstreams[drawerIndex].enabled" /></el-form-item>
              <el-form-item label="健康检查"><el-switch v-model="config.upstreams[drawerIndex].healthCheckEnabled" /></el-form-item>
            </div>
          </section>
        </el-form>
      </template>

      <template v-if="config && drawerMode === 'model' && config.models[drawerIndex]">
        <el-form :model="config.models[drawerIndex]" label-position="top" class="art-drawer-form">
          <section class="art-drawer-section">
            <div class="art-drawer-section-title"><Box /><span>模型信息</span></div>
            <div class="art-drawer-form-grid">
              <el-form-item label="模型 ID"><el-input v-model="config.models[drawerIndex].id" /></el-form-item>
              <el-form-item label="名称"><el-input v-model="config.models[drawerIndex].name" /></el-form-item>
              <el-form-item label="启用"><el-switch v-model="config.models[drawerIndex].enabled" /></el-form-item>
              <el-form-item label="默认输出格式"><el-select v-model="config.models[drawerIndex].defaultOutputFormat" allow-create filterable><el-option value="png" label="png" /><el-option value="jpeg" label="jpeg" /><el-option value="webp" label="webp" /></el-select></el-form-item>
            </div>
          </section>
          <section class="art-drawer-section">
            <div class="art-drawer-section-title"><MagicStick /><span>能力目录</span></div>
            <div class="art-drawer-form-grid">
              <el-form-item label="能力"><el-select v-model="config.models[drawerIndex].capabilities" multiple allow-create filterable><el-option value="generate" label="generate" /><el-option value="edit" label="edit" /></el-select></el-form-item>
              <el-form-item label="尺寸"><el-select v-model="config.models[drawerIndex].sizes" multiple allow-create filterable><el-option value="1024x1024" label="1024x1024" /><el-option value="1536x1024" label="1536x1024" /><el-option value="1024x1536" label="1024x1536" /></el-select></el-form-item>
              <el-form-item label="质量"><el-select v-model="config.models[drawerIndex].qualities" multiple allow-create filterable><el-option value="high" label="high" /><el-option value="medium" label="medium" /><el-option value="low" label="low" /><el-option value="auto" label="auto" /></el-select></el-form-item>
              <el-form-item label="绑定上游"><el-select v-model="config.models[drawerIndex].upstreamIds" multiple filterable><el-option v-for="item in activeUpstreams" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
            </div>
          </section>
          <section class="art-drawer-section">
            <div class="art-drawer-section-title"><Document /><span>推荐用途</span></div>
            <el-form-item label="推荐用途"><el-input v-model="config.models[drawerIndex].recommendedUse" type="textarea" :rows="3" /></el-form-item>
          </section>
        </el-form>
      </template>

      <template v-if="config && drawerMode === 'quality' && config.qualityPresets[drawerIndex]">
        <el-form :model="config.qualityPresets[drawerIndex]" label-position="top" class="art-drawer-form">
          <section class="art-drawer-section">
            <div class="art-drawer-section-title"><MagicStick /><span>预设信息</span></div>
            <div class="art-drawer-form-grid">
              <el-form-item label="预设 ID"><el-input v-model="config.qualityPresets[drawerIndex].id" /></el-form-item>
              <el-form-item label="名称"><el-input v-model="config.qualityPresets[drawerIndex].name" /></el-form-item>
              <el-form-item label="质量"><el-select v-model="config.qualityPresets[drawerIndex].quality"><el-option value="high" label="high" /><el-option value="medium" label="medium" /><el-option value="low" label="low" /><el-option value="auto" label="auto" /></el-select></el-form-item>
              <el-form-item label="尺寸"><el-input v-model="config.qualityPresets[drawerIndex].size" /></el-form-item>
              <el-form-item label="输出格式"><el-input v-model="config.qualityPresets[drawerIndex].outputFormat" /></el-form-item>
              <el-form-item label="Prompt 自动增强"><el-switch v-model="config.qualityPresets[drawerIndex].promptEnhance" /></el-form-item>
              <el-form-item label="用途" class="art-drawer-form-wide"><el-input v-model="config.qualityPresets[drawerIndex].useCase" /></el-form-item>
            </div>
          </section>
          <section class="art-drawer-section">
            <div class="art-drawer-section-title"><Document /><span>Prompt 模板</span></div>
            <el-form-item label="Prompt 模板"><el-input v-model="config.qualityPresets[drawerIndex].template" type="textarea" :rows="6" /></el-form-item>
          </section>
        </el-form>
      </template>

      <template #footer>
        <div class="art-drawer-footer-actions">
          <div>
            <strong>{{ drawerContext?.title || drawerTitle() }}</strong>
            <span>{{ drawerContext?.id || '未选择' }} · {{ drawerContext?.meta || '等待配置' }}</span>
          </div>
          <div>
            <el-button @click="closeDrawer">取消</el-button>
            <el-button type="primary" :icon="Finished" @click="saveDrawer">保存</el-button>
          </div>
        </div>
      </template>
    </el-drawer>

    <el-drawer v-model="logDetailVisible" title="请求详情" size="620px" destroy-on-close class="log-detail-drawer">
      <template v-if="selectedLog">
        <div class="art-detail-stack">
          <div class="art-detail-overview">
            <div>
              <span>{{ selectedLog.endpoint || selectedLog.path || '请求详情' }}</span>
              <h3>{{ selectedLog.id }}</h3>
              <p>{{ formatTime(selectedLog.createdAt) }} · {{ selectedLog.method || 'POST' }}</p>
            </div>
            <el-tag :type="selectedLog.status === 'failed' || Number(selectedLog.status) >= 400 ? 'danger' : 'success'">{{ selectedLog.status }}</el-tag>
          </div>
          <div class="art-detail-summary-grid">
            <div v-for="item in logDetailSummaryCards" :key="item.label" :class="item.type">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
              <small>{{ item.hint }}</small>
            </div>
          </div>
          <el-card shadow="never" class="detail-route-card art-detail-panel route-detail-panel">
            <template #header>
              <div class="detail-panel-header">
                <div class="detail-panel-title">
                  <h4><Connection />故障转移链路</h4>
                  <p>展示本次请求经过的上游路由和重试路径。</p>
                </div>
                <div class="detail-panel-meta">
                  <span>{{ logDetailRouteSteps.length }} 步</span>
                </div>
              </div>
            </template>
            <div class="detail-panel-body">
              <div class="detail-route-steps">
                <div v-for="item in logDetailRouteSteps" :key="item.index + item.name" :class="{ active: item.active }">
                  <i>{{ item.index }}</i>
                  <span>{{ item.name }}</span>
                  <small>{{ item.hint }}</small>
                </div>
              </div>
            </div>
          </el-card>
          <el-card shadow="never" class="detail-diagnostic-card art-detail-panel diagnostic-detail-panel">
            <template #header>
              <div class="detail-panel-header">
                <div class="detail-panel-title">
                  <h4><Document />错误摘要</h4>
                  <p>保留脱敏后的失败原因，便于复盘和告警判断。</p>
                </div>
                <div class="detail-panel-meta">
                  <span>{{ selectedLog.errorSummary ? '已记录' : '无错误' }}</span>
                </div>
              </div>
            </template>
            <div class="detail-panel-body">
              <p class="detail-text">{{ selectedLog.errorSummary || '无错误摘要' }}</p>
            </div>
          </el-card>
          <el-card shadow="never" class="detail-curl-card art-detail-panel curl-detail-panel">
            <template #header>
              <div class="detail-panel-header">
                <div class="detail-panel-title">
                  <h4><Document />脱敏 curl</h4>
                  <p>用于本地重放请求，敏感 Token 已统一隐藏。</p>
                </div>
                <div class="detail-panel-meta">
                  <span>可复制</span>
                </div>
              </div>
            </template>
            <div class="detail-panel-body">
              <pre class="curl-block">{{ sanitizedCurl(selectedLog) }}</pre>
            </div>
          </el-card>
        </div>
      </template>
      <template #footer>
        <div class="art-detail-action-bar">
          <div>
            <strong>{{ selectedLog?.id || '请求详情' }}</strong>
            <span>{{ selectedLog?.model || '未记录模型' }} · {{ formatDuration(selectedLog?.durationMs) }}</span>
          </div>
          <div>
            <el-button v-if="selectedLog" @click="copySanitizedCurl(selectedLog)">复制脱敏 curl</el-button>
            <el-button v-if="selectedLog" type="danger" plain @click="markQualityCase(selectedLog, 'poor')">质量差案例</el-button>
            <el-button v-if="selectedLog" type="success" plain @click="markQualityCase(selectedLog, 'excellent')">优秀案例</el-button>
          </div>
        </div>
      </template>
    </el-drawer>
  </div>
</template>
