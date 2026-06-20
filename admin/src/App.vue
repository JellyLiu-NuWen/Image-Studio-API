<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  Aim,
  Bell,
  Box,
  Close,
  Collection,
  Connection,
  Cpu,
  DataAnalysis,
  Document,
  Download,
  Edit,
  Finished,
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
  Refresh,
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
const pageTabs = ref<ViewKey[]>(['dashboard'])
const themeMode = ref<'light' | 'dark'>('light')
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
const drawerVisible = ref(false)
const drawerMode = ref<DrawerMode>(null)
const drawerIndex = ref(-1)
const logDetailVisible = ref(false)
const selectedLog = ref<LogRecord | null>(null)
const activeLogTab = ref<'generations' | 'api'>('generations')
const secretValues = reactive<Record<string, string>>({})
const tableSearch = reactive<Record<'interfaces' | 'upstreams' | 'models' | 'quality', string>>({
  interfaces: '',
  upstreams: '',
  models: '',
  quality: ''
})
const tableDensity = ref<'default' | 'comfortable' | 'compact'>('comfortable')
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
  .filter(Boolean) as Array<{ key: ViewKey; label: string; icon: unknown; group: string }>)
const activeInterfaces = computed(() => config.value?.interfaces || [])
const activeUpstreams = computed(() => config.value?.upstreams || [])
const activeModels = computed(() => config.value?.models || [])
const activePresets = computed(() => config.value?.qualityPresets || [])
const tableSize = computed(() => {
  if (tableDensity.value === 'compact') return 'small'
  if (tableDensity.value === 'default') return 'large'
  return 'default'
})
const filteredInterfaces = computed(() => filterTableRows(activeInterfaces.value, tableSearch.interfaces))
const filteredUpstreams = computed(() => filterTableRows(activeUpstreams.value, tableSearch.upstreams))
const filteredModels = computed(() => filterTableRows(activeModels.value, tableSearch.models))
const filteredPresets = computed(() => filterTableRows(activePresets.value, tableSearch.quality))
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
const usageInterfaceRows = computed(() => usageRows(usage.value?.byInterface))
const usageModelRows = computed(() => usageRows(usage.value?.byModel))
const usageUpstreamRows = computed(() => usageRows(usage.value?.byUpstream))
const usageDateRows = computed(() => usageRows(usage.value?.byDate).sort((left, right) => right.name.localeCompare(left.name)))
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
    pageTabs.value = [...pageTabs.value, key].slice(-8)
  }
}

function closePageTab(key: ViewKey) {
  if (key === 'dashboard') return
  const nextTabs = pageTabs.value.filter((item) => item !== key)
  pageTabs.value = nextTabs.length ? nextTabs : ['dashboard']
  if (activeView.value === key) {
    activeView.value = pageTabs.value[pageTabs.value.length - 1] || 'dashboard'
  }
}

function loadThemeMode() {
  if (typeof window === 'undefined') return
  const stored = window.localStorage.getItem('image-studio-admin-theme')
  themeMode.value = stored === 'dark' ? 'dark' : 'light'
}

function toggleTheme() {
  themeMode.value = themeMode.value === 'dark' ? 'light' : 'dark'
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('image-studio-admin-theme', themeMode.value)
  }
}

function filterLogs(records: LogRecord[]) {
  const keyword = logFilter.keyword.trim().toLowerCase()
  return records.filter((record) => {
    const matchesKeyword = !keyword || JSON.stringify(record).toLowerCase().includes(keyword)
    return matchesKeyword
  })
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
  bootstrap()
})

window.addEventListener('beforeunload', (event) => {
  if (!config.value || JSON.stringify(config.value) === lastSavedConfig.value) return
  event.preventDefault()
  event.returnValue = ''
})
</script>

<template>
  <div v-if="!authenticated" class="login-page" v-loading="loading">
    <section class="login-visual">
      <div class="brand-orbit">
        <div class="brand-logo">IS</div>
        <div>
          <strong>Image Studio API</strong>
          <span>Self-hosted operations console</span>
        </div>
      </div>
      <h1>用 Art Design Pro 重构的运维后台</h1>
      <p>集中管理接口、上游、模型、质量预设、日志、成本、安全和版本更新。</p>
      <div class="login-metrics">
        <span>GPT Image 2</span>
        <span>Upstream failover</span>
        <span>Audit ready</span>
      </div>
    </section>
    <el-card class="login-card" shadow="never">
      <template #header>
        <div>
          <h2>账号密码登录</h2>
          <p>登录后进入管理后台</p>
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
    </el-card>
  </div>

  <div v-else class="admin-shell" :data-theme="themeMode" v-loading="loading">
    <aside class="admin-sidebar">
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
        <div class="topbar-actions">
          <el-button :icon="themeMode === 'dark' ? Sunny : Moon" @click="toggleTheme">
            {{ themeMode === 'dark' ? '浅色主题' : '深色主题' }}
          </el-button>
          <el-button :icon="Refresh" @click="refreshAll">刷新</el-button>
          <el-button :icon="SwitchButton" type="danger" plain @click="logout">退出登录</el-button>
        </div>
      </header>

      <nav class="page-tabs" aria-label="打开的模块">
        <button
          v-for="tab in openedPageTabs"
          :key="tab.key"
          :class="{ active: activeView === tab.key }"
          @click="navigateTo(tab.key)"
        >
          <el-icon><component :is="tab.icon" /></el-icon>
          <span>{{ tab.label }}</span>
          <el-icon v-if="tab.key !== 'dashboard'" class="tab-close" @click.stop="closePageTab(tab.key)"><Close /></el-icon>
        </button>
      </nav>

      <section class="operations-panel" aria-label="后台快捷操作">
        <div>
          <div class="panel-heading">
            <el-icon><Operation /></el-icon>
            <span>运维快捷动作</span>
          </div>
          <div class="quick-actions">
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
        <div class="risk-board">
          <button v-for="item in riskItems" :key="item.label" :class="riskClass(item.severity)" @click="navigateTo(item.target)">
            <el-icon><WarningFilled /></el-icon>
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <small>{{ item.hint }}</small>
          </button>
        </div>
      </section>

      <section v-if="activeView === 'dashboard'" class="view-stack">
        <div class="metric-grid">
          <el-card shadow="never" class="metric-card">
            <span>今日生图</span>
            <strong>{{ metricValue(metrics?.generations.today) }}</strong>
            <small>成功率 {{ metricValue(metrics?.generations.successRate) }}%</small>
          </el-card>
          <el-card shadow="never" class="metric-card">
            <span>错误率</span>
            <strong>{{ metricValue(metrics?.generations.errorRate) }}%</strong>
            <small>失败 {{ metricValue(metrics?.generations.failed) }}</small>
          </el-card>
          <el-card shadow="never" class="metric-card">
            <span>P95</span>
            <strong>{{ formatDuration(metrics?.generations.p95DurationMs) }}</strong>
            <small>P99 {{ formatDuration(metrics?.generations.p99DurationMs) }}</small>
          </el-card>
          <el-card shadow="never" class="metric-card">
            <span>当前并发</span>
            <strong>{{ metricValue(metrics?.activeRequests) }}</strong>
            <small>接口上限 {{ config?.maxConcurrentRequests || 0 }}</small>
          </el-card>
        </div>
        <div class="content-grid dashboard-visual-grid">
          <el-card shadow="never">
            <template #header><div class="card-title"><DataAnalysis />近 7 日用量趋势</div></template>
            <div class="usage-trend" aria-label="近 7 日用量趋势">
              <div v-for="item in usageTrendBars" :key="item.name" class="trend-bar">
                <span>{{ item.total }}</span>
                <i :style="{ height: `${item.height}%` }"></i>
                <small>{{ item.shortName }}</small>
              </div>
              <div v-if="!usageTrendBars.length" class="empty-visual">暂无用量数据</div>
            </div>
          </el-card>
          <el-card shadow="never">
            <template #header><div class="card-title"><Monitor />任务状态分布</div></template>
            <div class="status-distribution" aria-label="任务状态分布">
              <div v-for="item in statusDistribution" :key="item.label" class="distribution-row">
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
        <div class="content-grid">
          <el-card shadow="never">
            <template #header><div class="card-title"><Monitor />服务状态</div></template>
            <div class="status-list">
              <div><span>接口数量</span><strong>{{ activeInterfaces.length }}</strong></div>
              <div><span>上游数量</span><strong>{{ activeUpstreams.length }}</strong></div>
              <div><span>默认模型</span><strong>{{ config?.defaultImageModel }}</strong></div>
              <div><span>版本状态</span><strong>{{ updateInfo.status || 'unknown' }}</strong></div>
            </div>
          </el-card>
          <el-card shadow="never">
            <template #header><div class="card-title"><Timer />最近失败</div></template>
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
        <el-card shadow="never" class="table-workspace">
          <div class="table-toolbar">
            <div>
              <div class="card-title"><Connection />接口管理</div>
              <div class="toolbar-meta">共 {{ activeInterfaces.length }} 个接口，当前显示 {{ filteredInterfaces.length }} 个</div>
            </div>
            <div class="toolbar-actions">
              <el-input v-model="tableSearch.interfaces" clearable placeholder="搜索接口、模型、上游" />
              <el-segmented v-model="tableDensity" :options="['default', 'comfortable', 'compact']" />
              <el-button :icon="Refresh" @click="refreshAll">刷新</el-button>
              <el-button type="primary" :icon="Plus" @click="addInterface">新增接口</el-button>
              <el-button :icon="Finished" @click="saveConfig()">保存接口配置</el-button>
            </div>
          </div>
          <el-table :data="filteredInterfaces" :size="tableSize" row-key="id">
            <el-table-column prop="name" label="名称" min-width="150" />
            <el-table-column prop="apiTokenSet" label="API Key" width="150">
              <template #default="{ row }">
                <div class="key-preview">
                  <el-tag :type="row.apiTokenSet ? 'success' : 'danger'">{{ row.apiTokenSet ? '已配置' : '未配置' }}</el-tag>
                  <span v-if="row.apiTokenPreview">{{ row.apiTokenPreview }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="defaultImageModel" label="模型" min-width="140" />
            <el-table-column label="尺寸/质量" min-width="150">
              <template #default="{ row }">{{ row.defaultSize }} · {{ row.defaultQuality }}</template>
            </el-table-column>
            <el-table-column prop="upstreamIds" label="绑定上游" min-width="160">
              <template #default="{ row }">{{ row.upstreamIds.join(', ') || '-' }}</template>
            </el-table-column>
            <el-table-column prop="rateLimitPerMinute" label="限流" width="90" />
            <el-table-column prop="enabled" label="状态" width="100">
              <template #default="{ row }"><el-switch v-model="row.enabled" /></template>
            </el-table-column>
            <el-table-column prop="lastUsedAt" label="最后使用" min-width="160">
              <template #default="{ row }">{{ formatTime(row.lastUsedAt) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="360" fixed="right">
              <template #default="{ row }">
                <el-button size="small" :icon="Edit" @click="openDrawer('interface', rowIndex(activeInterfaces, row))">编辑</el-button>
                <el-button size="small" :icon="Key" @click="rotateKey(row)">重置 Key</el-button>
                <el-dropdown>
                  <el-button size="small" :icon="More">更多</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="testInterface(row)">测试接口</el-dropdown-item>
                      <el-dropdown-item @click="copySecret('interface', row.id)">复制 Key</el-dropdown-item>
                      <el-dropdown-item @click="cloneInterface(row)">克隆</el-dropdown-item>
                      <el-dropdown-item @click="copySnippet(row)">复制 Skill/Codex 配置</el-dropdown-item>
                      <el-dropdown-item divided @click="removeItem('interface', rowIndex(activeInterfaces, row))">删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </section>

      <section v-if="activeView === 'upstreams'" class="view-stack">
        <el-card shadow="never" class="table-workspace">
          <div class="table-toolbar">
            <div>
              <div class="card-title"><Link />上游管理</div>
              <div class="toolbar-meta">共 {{ activeUpstreams.length }} 个上游，当前显示 {{ filteredUpstreams.length }} 个</div>
            </div>
            <div class="toolbar-actions">
              <el-input v-model="tableSearch.upstreams" clearable placeholder="搜索上游、URL、失败原因" />
              <el-segmented v-model="tableDensity" :options="['default', 'comfortable', 'compact']" />
              <el-button :icon="Refresh" @click="refreshAll">刷新</el-button>
              <el-button type="primary" :icon="Plus" @click="addUpstream">新增上游</el-button>
              <el-button :icon="Finished" @click="saveConfig()">保存上游配置</el-button>
            </div>
          </div>
          <el-table :data="filteredUpstreams" :size="tableSize" row-key="id">
            <el-table-column prop="name" label="名称" min-width="160" />
            <el-table-column prop="baseURL" label="Base URL" min-width="260" show-overflow-tooltip />
            <el-table-column prop="apiKeySet" label="API Key" width="150">
              <template #default="{ row }">
                <div class="key-preview">
                  <el-tag :type="row.apiKeySet ? 'success' : 'danger'">{{ row.apiKeySet ? '已配置' : '未配置' }}</el-tag>
                  <span v-if="row.apiKeyPreview">{{ row.apiKeyPreview }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="priority" label="优先级" width="90" />
            <el-table-column prop="weight" label="权重" width="80" />
            <el-table-column label="健康" min-width="210">
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
            <el-table-column label="最近检测" min-width="160">
              <template #default="{ row }">{{ formatTime(upstreamHealthFor(row.id)?.metrics.lastCheckedAt) }}</template>
            </el-table-column>
            <el-table-column label="最近失败原因" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">{{ upstreamHealthFor(row.id)?.metrics.lastFailureReason || '-' }}</template>
            </el-table-column>
            <el-table-column prop="healthCheckEnabled" label="健康检查" width="110">
              <template #default="{ row }"><el-switch v-model="row.healthCheckEnabled" /></template>
            </el-table-column>
            <el-table-column prop="enabled" label="状态" width="100">
              <template #default="{ row }"><el-switch v-model="row.enabled" /></template>
            </el-table-column>
            <el-table-column label="操作" width="260" fixed="right">
              <template #default="{ row }">
                <el-button size="small" :icon="Edit" @click="openDrawer('upstream', rowIndex(activeUpstreams, row))">编辑</el-button>
                <el-button size="small" :icon="Aim" @click="testUpstream(row)">测试</el-button>
                <el-button size="small" type="danger" plain @click="removeItem('upstream', rowIndex(activeUpstreams, row))">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </section>

      <section v-if="activeView === 'models'" class="view-stack">
        <el-card shadow="never" class="table-workspace">
          <div class="table-toolbar">
            <div>
              <div class="card-title"><Box />模型目录</div>
              <div class="toolbar-meta">共 {{ activeModels.length }} 个模型，当前显示 {{ filteredModels.length }} 个</div>
            </div>
            <div class="toolbar-actions">
              <el-input v-model="tableSearch.models" clearable placeholder="搜索模型、能力、用途" />
              <el-segmented v-model="tableDensity" :options="['default', 'comfortable', 'compact']" />
              <el-button :icon="Refresh" @click="refreshAll">刷新</el-button>
              <el-button type="primary" :icon="Plus" @click="addModel">新增模型</el-button>
              <el-button :icon="Finished" @click="saveModels">保存模型目录</el-button>
            </div>
          </div>
          <el-table :data="filteredModels" :size="tableSize" row-key="id">
            <el-table-column prop="id" label="模型 ID" min-width="160" />
            <el-table-column prop="name" label="名称" min-width="140" />
            <el-table-column prop="capabilities" label="能力" min-width="160">
              <template #default="{ row }">
                <div class="compact-tags">
                  <el-tag v-for="item in row.capabilities" :key="item" size="small">{{ item }}</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="sizes" label="尺寸" min-width="190" show-overflow-tooltip>
              <template #default="{ row }">{{ row.sizes.join(', ') || '-' }}</template>
            </el-table-column>
            <el-table-column prop="qualities" label="质量" min-width="150">
              <template #default="{ row }">
                <div class="compact-tags">
                  <el-tag v-for="item in row.qualities" :key="item" size="small" type="info">{{ item }}</el-tag>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="defaultOutputFormat" label="默认格式" width="110" />
            <el-table-column prop="upstreamIds" label="绑定上游" min-width="170" show-overflow-tooltip>
              <template #default="{ row }">{{ upstreamNames(row.upstreamIds) }}</template>
            </el-table-column>
            <el-table-column prop="recommendedUse" label="推荐用途" min-width="220" show-overflow-tooltip />
            <el-table-column prop="enabled" label="启用" width="90">
              <template #default="{ row }"><el-switch v-model="row.enabled" /></template>
            </el-table-column>
            <el-table-column label="操作" width="170" fixed="right">
              <template #default="{ row }">
                <el-button size="small" :icon="Edit" @click="openDrawer('model', rowIndex(activeModels, row))">编辑</el-button>
                <el-button size="small" type="danger" plain @click="removeItem('model', rowIndex(activeModels, row))">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </section>

      <section v-if="activeView === 'quality'" class="view-stack">
        <div class="metric-grid">
          <el-card shadow="never" class="metric-card">
            <span>质量预设</span>
            <strong>{{ activePresets.length }}</strong>
            <small>可绑定到接口默认参数</small>
          </el-card>
          <el-card shadow="never" class="metric-card">
            <span>质量差案例</span>
            <strong>{{ poorQualityCases.length }}</strong>
            <small>用于修正模板与参数</small>
          </el-card>
          <el-card shadow="never" class="metric-card">
            <span>优秀案例</span>
            <strong>{{ excellentQualityCases.length }}</strong>
            <small>用于沉淀高质量提示词</small>
          </el-card>
          <el-card shadow="never" class="metric-card">
            <span>增强开关</span>
            <strong>{{ activePresets.filter((item) => item.promptEnhance).length }}</strong>
            <small>默认关闭，按预设启用</small>
          </el-card>
        </div>
        <el-card shadow="never" class="table-workspace">
          <div class="table-toolbar">
            <div>
              <div class="card-title"><MagicStick />生图质量预设</div>
              <div class="toolbar-meta">共 {{ activePresets.length }} 个预设，当前显示 {{ filteredPresets.length }} 个</div>
            </div>
            <div class="toolbar-actions">
              <el-input v-model="tableSearch.quality" clearable placeholder="搜索预设、用途、模板" />
              <el-segmented v-model="tableDensity" :options="['default', 'comfortable', 'compact']" />
              <el-button :icon="Refresh" @click="refreshAll">刷新</el-button>
              <el-button type="primary" :icon="Plus" @click="addPreset">新增预设</el-button>
              <el-button :icon="Finished" @click="saveQualityPresets">保存质量预设</el-button>
            </div>
          </div>
          <div class="preset-grid">
            <el-card v-for="preset in filteredPresets" :key="preset.id" shadow="never" class="preset-card">
              <template #header>
                <div class="card-title">
                  <MagicStick />
                  <span>{{ preset.name }}</span>
                </div>
              </template>
              <p>{{ preset.useCase }}</p>
              <div class="tag-row">
                <el-tag>{{ preset.quality }}</el-tag>
                <el-tag type="info">{{ preset.size }}</el-tag>
                <el-tag :type="preset.promptEnhance ? 'success' : 'info'">{{ preset.promptEnhance ? '增强开启' : '增强关闭' }}</el-tag>
              </div>
              <div class="card-actions">
                <el-button size="small" :icon="Edit" @click="openDrawer('quality', rowIndex(activePresets, preset))">编辑</el-button>
                <el-button size="small" type="danger" plain @click="removeItem('quality', rowIndex(activePresets, preset))">删除</el-button>
              </div>
            </el-card>
          </div>
          <el-table :data="filteredPresets" :size="tableSize" class="preset-list-table">
            <el-table-column prop="id" label="预设 ID" min-width="180" />
            <el-table-column prop="name" label="名称" min-width="160" />
            <el-table-column prop="quality" label="质量" width="100" />
            <el-table-column prop="size" label="尺寸" min-width="130" />
            <el-table-column prop="outputFormat" label="格式" width="90" />
            <el-table-column prop="promptEnhance" label="增强" width="100">
              <template #default="{ row }"><el-tag :type="row.promptEnhance ? 'success' : 'info'">{{ row.promptEnhance ? '开启' : '关闭' }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="useCase" label="用途" min-width="220" show-overflow-tooltip />
            <el-table-column label="操作" width="170" fixed="right">
              <template #default="{ row }">
                <el-button size="small" :icon="Edit" @click="openDrawer('quality', rowIndex(activePresets, row))">编辑</el-button>
                <el-button size="small" type="danger" plain @click="removeItem('quality', rowIndex(activePresets, row))">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
        <el-card shadow="never">
          <template #header>
            <div class="section-actions">
              <div class="card-title"><Document />质量案例库</div>
              <el-button size="small" :icon="Refresh" @click="refreshAll">刷新案例</el-button>
            </div>
          </template>
          <el-table :data="qualityCases" height="360" empty-text="暂无质量案例">
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
                <el-button size="small" :icon="View" @click="openQualityCaseLog(row)">日志</el-button>
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
          <div class="query-panel">
            <div class="query-panel-heading">
              <div class="card-title"><Document />日志查询</div>
              <span>按接口、上游、模型、状态、耗时和请求 ID 组合筛选</span>
            </div>
            <div class="query-grid">
              <el-input v-model="logFilter.keyword" placeholder="搜索请求 ID、模型、错误摘要" clearable />
              <el-select v-model="logFilter.status" placeholder="状态" clearable>
                <el-option label="success" value="success" />
                <el-option label="failed" value="failed" />
              </el-select>
              <el-select v-model="logFilter.interfaceId" placeholder="接口" clearable>
                <el-option v-for="item in activeInterfaces" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
              <el-select v-model="logFilter.upstreamId" placeholder="上游" clearable>
                <el-option v-for="item in activeUpstreams" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
              <el-input v-model="logFilter.model" placeholder="模型" clearable />
              <el-input v-model="logFilter.endpoint" placeholder="Endpoint" clearable />
              <el-input v-model="logFilter.requestId" placeholder="请求 ID" clearable />
              <el-date-picker v-model="logFilter.from" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" placeholder="开始时间" />
              <el-date-picker v-model="logFilter.to" type="datetime" value-format="YYYY-MM-DDTHH:mm:ss.SSSZ" placeholder="结束时间" />
              <el-input-number v-model="logFilter.statusMin" :min="100" :max="599" placeholder="状态≥" controls-position="right" />
              <el-input-number v-model="logFilter.statusMax" :min="100" :max="599" placeholder="状态≤" controls-position="right" />
              <el-input-number v-model="logFilter.minDurationMs" :min="0" placeholder="耗时≥ms" controls-position="right" />
              <el-input-number v-model="logFilter.maxDurationMs" :min="0" placeholder="耗时≤ms" controls-position="right" />
            </div>
            <div class="query-actions">
              <el-button type="primary" :icon="Refresh" @click="refreshLogsOnly">应用筛选</el-button>
              <el-button @click="resetLogFilters">重置</el-button>
            </div>
          </div>
          <div class="result-toolbar">
            <div>
              <div class="card-title"><DataAnalysis />日志结果</div>
              <div class="toolbar-meta">生图 {{ filteredGenerationLogs.length }} 条 / API {{ filteredApiLogs.length }} 条</div>
            </div>
            <div class="toolbar-actions">
              <el-segmented v-model="tableDensity" :options="['default', 'comfortable', 'compact']" />
              <el-button :icon="Refresh" @click="refreshLogsOnly">刷新日志</el-button>
              <el-button :icon="Download" @click="exportLogs('jsonl')">导出 JSONL</el-button>
              <el-button :icon="Download" @click="exportLogs('csv')">导出 CSV</el-button>
            </div>
          </div>
          <el-tabs v-model="activeLogTab">
            <el-tab-pane label="生图日志" name="generations">
              <el-table :data="filteredGenerationLogs" :size="tableSize" height="520">
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
                <el-table-column prop="createdAt" label="时间" min-width="160"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
                <el-table-column prop="method" label="方法" width="90" />
                <el-table-column prop="path" label="路径" min-width="220" />
                <el-table-column prop="authKind" label="身份" width="100" />
                <el-table-column prop="status" label="状态" width="100" />
                <el-table-column prop="durationMs" label="耗时" width="100"><template #default="{ row }">{{ formatDuration(row.durationMs) }}</template></el-table-column>
              </el-table>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </section>

      <section v-if="activeView === 'usage'" class="view-stack">
        <div class="metric-grid">
          <el-card shadow="never" class="metric-card"><span>总调用</span><strong>{{ usage?.total.total || 0 }}</strong><small>成功 {{ usage?.total.success || 0 }}</small></el-card>
          <el-card shadow="never" class="metric-card"><span>估算成本</span><strong>{{ formatCost(usage?.total.estimatedCostUSD) }}</strong><small>图片 {{ usage?.total.imageCount || 0 }} 张</small></el-card>
          <el-card shadow="never" class="metric-card"><span>成功率</span><strong>{{ formatPercent(usage?.total.successRate) }}</strong><small>失败 {{ usage?.total.failed || 0 }}</small></el-card>
          <el-card shadow="never" class="metric-card"><span>平均耗时</span><strong>{{ formatDuration(usage?.total.averageDurationMs) }}</strong><small>累计 {{ formatDuration(usage?.total.durationMs) }}</small></el-card>
        </div>
        <el-card shadow="never">
          <template #header>
            <div class="section-actions">
              <div class="card-title"><DataAnalysis />用量明细</div>
              <el-button :icon="Refresh" @click="refreshAll">刷新</el-button>
            </div>
          </template>
          <el-tabs>
            <el-tab-pane label="按日期">
              <el-table :data="usageDateRows" empty-text="暂无日期用量">
                <el-table-column prop="name" label="日期" min-width="130" />
                <el-table-column prop="total" label="调用" width="90" />
                <el-table-column prop="imageCount" label="图片" width="90" />
                <el-table-column prop="successRate" label="成功率" width="110"><template #default="{ row }">{{ formatPercent(row.successRate) }}</template></el-table-column>
                <el-table-column prop="estimatedCostUSD" label="估算成本" width="130"><template #default="{ row }">{{ formatCost(row.estimatedCostUSD) }}</template></el-table-column>
                <el-table-column prop="averageDurationMs" label="平均耗时" width="120"><template #default="{ row }">{{ formatDuration(row.averageDurationMs) }}</template></el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="按接口">
              <el-table :data="usageInterfaceRows" empty-text="暂无接口用量">
                <el-table-column prop="name" label="接口" min-width="140" />
                <el-table-column prop="total" label="调用" width="90" />
                <el-table-column prop="success" label="成功" width="90" />
                <el-table-column prop="failed" label="失败" width="90" />
                <el-table-column prop="imageCount" label="图片" width="90" />
                <el-table-column prop="estimatedCostUSD" label="估算成本" width="130"><template #default="{ row }">{{ formatCost(row.estimatedCostUSD) }}</template></el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="按模型">
              <el-table :data="usageModelRows" empty-text="暂无模型用量">
                <el-table-column prop="name" label="模型" min-width="160" />
                <el-table-column prop="total" label="调用" width="90" />
                <el-table-column prop="imageCount" label="图片" width="90" />
                <el-table-column prop="successRate" label="成功率" width="110"><template #default="{ row }">{{ formatPercent(row.successRate) }}</template></el-table-column>
                <el-table-column prop="estimatedCostUSD" label="估算成本" width="130"><template #default="{ row }">{{ formatCost(row.estimatedCostUSD) }}</template></el-table-column>
              </el-table>
            </el-tab-pane>
            <el-tab-pane label="按上游">
              <el-table :data="usageUpstreamRows" empty-text="暂无上游用量">
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
        <el-card shadow="never" class="alert-queue-workspace">
          <template #header>
            <div class="section-actions">
              <div class="card-title"><Bell />当前告警</div>
              <div class="card-actions">
                <el-tag :type="pendingAlertCount ? 'danger' : 'success'">待处理 {{ pendingAlertCount }}</el-tag>
                <el-button :icon="Refresh" @click="refreshAll">刷新</el-button>
              </div>
            </div>
          </template>
          <el-table :data="activeAlerts" :size="tableSize" height="420" empty-text="暂无活跃告警">
            <el-table-column prop="severity" label="级别" width="110">
              <template #default="{ row }"><el-tag :type="alertTagType(row.severity)">{{ row.severity }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="title" label="告警" min-width="180" />
            <el-table-column prop="message" label="说明" min-width="360" show-overflow-tooltip />
            <el-table-column prop="acknowledged" label="状态" width="110">
              <template #default="{ row }"><el-tag :type="row.acknowledged ? 'info' : 'danger'">{{ row.acknowledged ? '已确认' : '待处理' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row }"><el-button size="small" :disabled="row.acknowledged" @click="acknowledgeAlert(row.id)">确认</el-button></template>
            </el-table-column>
          </el-table>
        </el-card>
          <div class="alerts-side-stack">
            <el-card shadow="never" class="notification-workspace">
              <template #header><div class="card-title"><Bell />通知状态</div></template>
              <div class="status-list">
                <div><span>Webhook</span><strong>{{ config?.alerts.webhookEnabled ? '已启用' : '未启用' }}</strong></div>
                <div><span>最近发送</span><strong>{{ notificationLabel(alertNotification.status) }}</strong></div>
                <div><span>HTTP 状态</span><strong>{{ alertNotification.webhookStatus || '-' }}</strong></div>
                <div><span>通知条数</span><strong>{{ alertNotification.alertCount || 0 }}</strong></div>
              </div>
            </el-card>
            <el-card shadow="never" class="alert-rules-workspace">
              <template #header><div class="card-title"><Operation />告警规则</div></template>
              <el-form v-if="config" :model="alertsForm" label-width="150px" class="narrow-form">
                <el-form-item label="Webhook 通知"><el-switch v-model="config.alerts.webhookEnabled" /></el-form-item>
                <el-form-item label="Webhook URL"><el-input v-model="config.alerts.webhookURL" placeholder="https://hooks.example/a" /></el-form-item>
                <el-form-item label="上游失败阈值"><el-input-number v-model="config.alerts.upstreamFailureThreshold" :min="1" /></el-form-item>
                <el-form-item label="成功率阈值"><el-input-number v-model="config.alerts.successRateThreshold" :min="1" :max="100" /></el-form-item>
                <el-form-item label="P95 阈值 ms"><el-input-number v-model="config.alerts.p95LatencyMsThreshold" :min="100" /></el-form-item>
                <el-form-item><el-button type="primary" @click="saveAlerts">保存告警配置</el-button></el-form-item>
              </el-form>
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
          <el-card shadow="never">
            <template #header><div class="card-title"><Lock />账号与安全</div></template>
            <el-form v-if="config" label-width="140px" class="narrow-form">
              <el-form-item label="IP 白名单"><el-input :model-value="securityForm.ipAllowlist.join('\n')" type="textarea" :rows="5" placeholder="每行一个 IP，例如 203.0.113.10" @update:model-value="(value: string) => config && (config.security.ipAllowlist = value.split('\n').map((item) => item.trim()).filter(Boolean))" /></el-form-item>
              <el-form-item label="失败登录锁定"><el-switch v-model="config.security.failedLoginLockoutEnabled" /></el-form-item>
              <el-form-item><el-button type="primary" @click="saveConfig('安全配置已保存')">保存安全配置</el-button></el-form-item>
            </el-form>
          </el-card>
          <el-card shadow="never">
            <template #header><div class="card-title"><Key />TOTP 二次验证</div></template>
            <div class="totp-panel">
              <div class="status-row">
                <span>当前状态</span>
                <el-tag :type="securityForm.totpEnabled ? 'success' : 'info'">{{ securityForm.totpEnabled ? '已启用' : '未启用' }}</el-tag>
                <el-tag v-if="securityForm.totpConfigured && !securityForm.totpEnabled" type="warning">待验证</el-tag>
              </div>
              <el-alert v-if="!securityForm.totpEnabled" title="生成密钥后，用认证器添加 otpauth URI 或手动输入密钥，再提交 6 位验证码完成启用。" type="info" show-icon :closable="false" />
              <el-form label-width="120px" class="narrow-form">
                <template v-if="totpSetup">
                  <el-form-item label="手动密钥"><el-input :model-value="totpSetup.secret" readonly /></el-form-item>
                  <el-form-item label="otpauth URI"><el-input :model-value="totpSetup.otpauthURL" type="textarea" :rows="3" readonly /></el-form-item>
                </template>
                <el-form-item label="验证码">
                  <el-input v-model="totpCode" maxlength="6" placeholder="认证器中的 6 位验证码" />
                </el-form-item>
                <el-form-item>
                  <el-button v-if="!securityForm.totpEnabled" @click="setupTOTP">生成 TOTP 密钥</el-button>
                  <el-button v-if="!securityForm.totpEnabled" type="primary" :disabled="!securityForm.totpConfigured && !totpSetup" @click="enableTOTP">启用 TOTP</el-button>
                  <el-button v-else type="danger" plain @click="disableTOTP">禁用 TOTP</el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-card>
          <el-card shadow="never">
            <template #header><div class="card-title"><Key />修改账号密码</div></template>
            <el-form :model="accountForm" label-width="120px" class="narrow-form">
              <el-form-item label="账号"><el-input v-model="accountForm.username" /></el-form-item>
              <el-form-item label="当前密码"><el-input v-model="accountForm.currentPassword" type="password" show-password /></el-form-item>
              <el-form-item label="新密码"><el-input v-model="accountForm.newPassword" type="password" show-password /></el-form-item>
              <el-form-item><el-button type="primary" @click="saveAccount">保存账号</el-button></el-form-item>
            </el-form>
          </el-card>
        </div>
        <div class="session-workspace">
          <el-card shadow="never">
            <template #header>
              <div class="section-actions">
                <div class="card-title"><Collection />当前会话</div>
                <el-button size="small" type="warning" plain @click="revokeOtherSessions">退出其他会话</el-button>
              </div>
            </template>
            <el-table :data="sessions" :size="tableSize">
              <el-table-column prop="username" label="账号" />
              <el-table-column prop="createdAt" label="登录时间"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
              <el-table-column prop="current" label="当前" width="90"><template #default="{ row }"><el-tag v-if="row.current" type="success">当前</el-tag></template></el-table-column>
              <el-table-column label="操作" width="100"><template #default="{ row }"><el-button v-if="!row.current" size="small" @click="revokeSession(row.id)">退出</el-button></template></el-table-column>
            </el-table>
          </el-card>
          <el-card shadow="never">
            <template #header><div class="card-title"><Document />登录历史</div></template>
            <el-table :data="loginHistoryRows" :size="tableSize" height="280">
              <el-table-column prop="createdAt" label="时间"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
              <el-table-column prop="username" label="账号" />
              <el-table-column prop="action" label="动作" />
            </el-table>
          </el-card>
        </div>
        <el-card shadow="never" class="audit-workspace">
          <template #header><div class="card-title"><Document />审计日志</div></template>
          <el-table :data="auditLogs" :size="tableSize" height="360">
            <el-table-column prop="createdAt" label="时间" min-width="160"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
            <el-table-column prop="username" label="操作者" width="120" />
            <el-table-column prop="action" label="动作" min-width="160" />
            <el-table-column prop="details" label="详情" min-width="260"><template #default="{ row }">{{ JSON.stringify(row.details || {}) }}</template></el-table-column>
          </el-table>
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
          <el-card shadow="never" class="backup-workspace">
            <template #header>
              <div class="section-actions">
                <div class="card-title"><Download />备份恢复</div>
                <div class="card-actions">
                  <el-button type="primary" :icon="Download" @click="createBackup">一键备份</el-button>
                  <el-button :icon="Upload" @click="openRestorePicker">上传恢复</el-button>
                </div>
              </div>
            </template>
            <div class="system-actions">
              <input ref="backupFileInput" class="hidden-file" type="file" accept="application/json,.json" @change="restoreFromFile" />
              <span>{{ backupStatus || '自动保留最近配置快照，恢复前请确认版本。' }}</span>
            </div>
            <el-table :data="backups" :size="tableSize" height="320" empty-text="暂无备份">
              <el-table-column prop="createdAt" label="备份时间" min-width="160"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
              <el-table-column prop="username" label="操作者" width="120" />
              <el-table-column prop="summary" label="摘要" min-width="180" />
              <el-table-column label="操作" width="180">
                <template #default="{ row }">
                  <el-button size="small" @click="downloadBackup(row)">下载</el-button>
                  <el-button size="small" type="warning" plain @click="restoreBackup(row.id)">恢复</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
          <el-card shadow="never" class="version-workspace">
            <template #header><div class="card-title"><Document />配置版本历史</div></template>
            <el-table :data="versions" :size="tableSize" height="320" empty-text="暂无配置版本">
              <el-table-column prop="createdAt" label="时间" min-width="160"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
              <el-table-column prop="username" label="操作者" width="120" />
              <el-table-column prop="summary" label="摘要" min-width="200" />
              <el-table-column label="操作" width="120"><template #default="{ row }"><el-button size="small" @click="restoreVersion(row.id)">恢复</el-button></template></el-table-column>
            </el-table>
          </el-card>
          <el-card shadow="never" class="update-workspace">
            <template #header>
              <div class="section-actions">
                <div class="card-title"><Cpu />版本更新</div>
                <el-tag :type="updateInfo.status === 'outdated' ? 'warning' : updateInfo.status === 'current' ? 'success' : 'info'">{{ updateInfo.status || 'unknown' }}</el-tag>
              </div>
            </template>
            <div class="status-list">
              <div><span>当前版本</span><strong>{{ updateInfo.currentVersion || 'dev' }}</strong></div>
              <div><span>当前 Commit</span><strong>{{ updateInfo.currentCommit || '未知' }}</strong></div>
              <div><span>Docker Tag</span><strong>{{ updateInfo.dockerImageTag || 'latest' }}</strong></div>
              <div><span>最新版本</span><strong>{{ updateInfo.latestVersion || '未知' }}</strong></div>
              <div><span>状态</span><strong>{{ updateInfo.status || 'unknown' }}</strong></div>
              <div><span>来源</span><strong>{{ updateInfo.source || 'release' }}</strong></div>
            </div>
            <div class="update-actions">
              <el-button type="primary" :icon="Download" @click="createBackup">更新前备份</el-button>
              <el-button :disabled="!updateInfo.changelogURL && !updateInfo.releaseURL" @click="openUpdateLink">查看 Changelog</el-button>
              <el-button :disabled="!updateInfo.rollbackCommand" @click="copyRollbackCommand">复制回滚命令</el-button>
            </div>
            <div v-if="updateInfo.changelog" class="changelog-preview">
              <strong>Changelog</strong>
              <pre>{{ updateInfo.changelog }}</pre>
            </div>
            <div v-if="updateInfo.rollbackCommand" class="rollback-command">
              <span>回滚入口</span>
              <code>{{ updateInfo.rollbackCommand }}</code>
            </div>
          </el-card>
        </div>
      </section>
    </main>

    <el-drawer v-model="drawerVisible" :title="drawerTitle()" size="520px" destroy-on-close>
      <template v-if="config && drawerMode === 'interface' && config.interfaces[drawerIndex]">
        <el-form :model="config.interfaces[drawerIndex]" label-position="top">
          <el-form-item label="接口 ID"><el-input v-model="config.interfaces[drawerIndex].id" /></el-form-item>
          <el-form-item label="名称"><el-input v-model="config.interfaces[drawerIndex].name" /></el-form-item>
          <el-form-item label="Skill 调用 Key">
            <div class="secret-line">
              <el-input v-model="config.interfaces[drawerIndex].apiToken" :placeholder="config.interfaces[drawerIndex].apiTokenSet ? '已保存，留空保持不变' : '请输入 Key'" />
              <el-button :icon="secretValues[`interface:${config.interfaces[drawerIndex].id}`] ? Hide : View" @click="revealSecret('interface', config.interfaces[drawerIndex].id)">显示</el-button>
              <el-button :icon="Key" @click="copySecret('interface', config.interfaces[drawerIndex].id)">复制</el-button>
            </div>
            <el-input v-if="secretValues[`interface:${config.interfaces[drawerIndex].id}`]" :model-value="secretValues[`interface:${config.interfaces[drawerIndex].id}`]" readonly />
          </el-form-item>
          <el-form-item label="上游绑定"><el-select v-model="config.interfaces[drawerIndex].upstreamIds" multiple><el-option v-for="item in activeUpstreams" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
          <el-form-item label="默认模型"><el-input v-model="config.interfaces[drawerIndex].defaultImageModel" /></el-form-item>
          <el-form-item label="尺寸"><el-input v-model="config.interfaces[drawerIndex].defaultSize" /></el-form-item>
          <el-form-item label="质量"><el-select v-model="config.interfaces[drawerIndex].defaultQuality"><el-option value="high" label="high" /><el-option value="medium" label="medium" /><el-option value="low" label="low" /><el-option value="auto" label="auto" /></el-select></el-form-item>
          <el-form-item label="输出格式"><el-input v-model="config.interfaces[drawerIndex].defaultOutputFormat" /></el-form-item>
          <el-form-item label="质量预设"><el-select v-model="config.interfaces[drawerIndex].qualityPresetId"><el-option v-for="item in activePresets" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
          <el-form-item label="超时秒数"><el-input-number v-model="config.interfaces[drawerIndex].requestTimeoutSeconds" :min="10" :max="900" /></el-form-item>
          <el-form-item label="并发上限"><el-input-number v-model="config.interfaces[drawerIndex].maxConcurrentRequests" :min="1" :max="10" /></el-form-item>
          <el-form-item label="每分钟限流"><el-input-number v-model="config.interfaces[drawerIndex].rateLimitPerMinute" :min="1" :max="600" /></el-form-item>
        </el-form>
      </template>

      <template v-if="config && drawerMode === 'upstream' && config.upstreams[drawerIndex]">
        <el-form :model="config.upstreams[drawerIndex]" label-position="top">
          <el-form-item label="上游 ID"><el-input v-model="config.upstreams[drawerIndex].id" /></el-form-item>
          <el-form-item label="名称"><el-input v-model="config.upstreams[drawerIndex].name" /></el-form-item>
          <el-form-item label="Base URL"><el-input v-model="config.upstreams[drawerIndex].baseURL" /></el-form-item>
          <el-form-item label="上游 API Key">
            <div class="secret-line">
              <el-input v-model="config.upstreams[drawerIndex].apiKey" :placeholder="config.upstreams[drawerIndex].apiKeySet ? '已保存，留空保持不变' : '请输入 Key'" />
              <el-button :icon="secretValues[`upstream:${config.upstreams[drawerIndex].id}`] ? Hide : View" @click="revealSecret('upstream', config.upstreams[drawerIndex].id)">显示</el-button>
              <el-button :icon="Key" @click="copySecret('upstream', config.upstreams[drawerIndex].id)">复制</el-button>
            </div>
            <el-input v-if="secretValues[`upstream:${config.upstreams[drawerIndex].id}`]" :model-value="secretValues[`upstream:${config.upstreams[drawerIndex].id}`]" readonly />
          </el-form-item>
          <el-form-item label="优先级"><el-input-number v-model="config.upstreams[drawerIndex].priority" :min="1" :max="1000" /></el-form-item>
          <el-form-item label="权重"><el-input-number v-model="config.upstreams[drawerIndex].weight" :min="1" :max="100" /></el-form-item>
          <el-form-item label="参与故障转移"><el-switch v-model="config.upstreams[drawerIndex].enabled" /></el-form-item>
          <el-form-item label="健康检查"><el-switch v-model="config.upstreams[drawerIndex].healthCheckEnabled" /></el-form-item>
        </el-form>
      </template>

      <template v-if="config && drawerMode === 'model' && config.models[drawerIndex]">
        <el-form :model="config.models[drawerIndex]" label-position="top">
          <el-form-item label="模型 ID"><el-input v-model="config.models[drawerIndex].id" /></el-form-item>
          <el-form-item label="名称"><el-input v-model="config.models[drawerIndex].name" /></el-form-item>
          <el-form-item label="能力"><el-select v-model="config.models[drawerIndex].capabilities" multiple allow-create filterable><el-option value="generate" label="generate" /><el-option value="edit" label="edit" /></el-select></el-form-item>
          <el-form-item label="尺寸"><el-select v-model="config.models[drawerIndex].sizes" multiple allow-create filterable><el-option value="1024x1024" label="1024x1024" /><el-option value="1536x1024" label="1536x1024" /><el-option value="1024x1536" label="1024x1536" /></el-select></el-form-item>
          <el-form-item label="质量"><el-select v-model="config.models[drawerIndex].qualities" multiple allow-create filterable><el-option value="high" label="high" /><el-option value="medium" label="medium" /><el-option value="low" label="low" /><el-option value="auto" label="auto" /></el-select></el-form-item>
          <el-form-item label="默认输出格式"><el-select v-model="config.models[drawerIndex].defaultOutputFormat" allow-create filterable><el-option value="png" label="png" /><el-option value="jpeg" label="jpeg" /><el-option value="webp" label="webp" /></el-select></el-form-item>
          <el-form-item label="绑定上游"><el-select v-model="config.models[drawerIndex].upstreamIds" multiple filterable><el-option v-for="item in activeUpstreams" :key="item.id" :label="item.name" :value="item.id" /></el-select></el-form-item>
          <el-form-item label="推荐用途"><el-input v-model="config.models[drawerIndex].recommendedUse" type="textarea" :rows="3" /></el-form-item>
          <el-form-item label="启用"><el-switch v-model="config.models[drawerIndex].enabled" /></el-form-item>
        </el-form>
      </template>

      <template v-if="config && drawerMode === 'quality' && config.qualityPresets[drawerIndex]">
        <el-form :model="config.qualityPresets[drawerIndex]" label-position="top">
          <el-form-item label="预设 ID"><el-input v-model="config.qualityPresets[drawerIndex].id" /></el-form-item>
          <el-form-item label="名称"><el-input v-model="config.qualityPresets[drawerIndex].name" /></el-form-item>
          <el-form-item label="质量"><el-select v-model="config.qualityPresets[drawerIndex].quality"><el-option value="high" label="high" /><el-option value="medium" label="medium" /><el-option value="low" label="low" /><el-option value="auto" label="auto" /></el-select></el-form-item>
          <el-form-item label="尺寸"><el-input v-model="config.qualityPresets[drawerIndex].size" /></el-form-item>
          <el-form-item label="输出格式"><el-input v-model="config.qualityPresets[drawerIndex].outputFormat" /></el-form-item>
          <el-form-item label="Prompt 自动增强"><el-switch v-model="config.qualityPresets[drawerIndex].promptEnhance" /></el-form-item>
          <el-form-item label="用途"><el-input v-model="config.qualityPresets[drawerIndex].useCase" /></el-form-item>
          <el-form-item label="Prompt 模板"><el-input v-model="config.qualityPresets[drawerIndex].template" type="textarea" :rows="6" /></el-form-item>
        </el-form>
      </template>

      <template #footer>
        <el-button @click="closeDrawer">取消</el-button>
        <el-button type="primary" @click="saveDrawer">保存</el-button>
      </template>
    </el-drawer>

    <el-drawer v-model="logDetailVisible" title="请求详情" size="560px" destroy-on-close>
      <template v-if="selectedLog">
        <div class="detail-stack">
          <div class="status-list detail-status">
            <div><span>请求 ID</span><strong>{{ selectedLog.id }}</strong></div>
            <div><span>状态</span><strong>{{ selectedLog.status }}</strong></div>
            <div><span>接口</span><strong>{{ selectedLog.interfaceId || '-' }}</strong></div>
            <div><span>上游</span><strong>{{ selectedLog.upstreamId || '-' }}</strong></div>
            <div><span>模型</span><strong>{{ selectedLog.model || '-' }}</strong></div>
            <div><span>耗时</span><strong>{{ formatDuration(selectedLog.durationMs) }}</strong></div>
            <div><span>上游状态</span><strong>{{ selectedLog.upstreamStatus || '-' }}</strong></div>
            <div><span>重试次数</span><strong>{{ selectedLog.retryCount || 0 }}</strong></div>
          </div>
          <el-card shadow="never">
            <template #header><div class="card-title"><Connection />故障转移链路</div></template>
            <div class="tag-row">
              <el-tag v-for="item in selectedLog.failoverChain || []" :key="item">{{ item }}</el-tag>
              <span v-if="!(selectedLog.failoverChain || []).length" class="muted-text">没有记录故障转移链路</span>
            </div>
          </el-card>
          <el-card shadow="never">
            <template #header><div class="card-title"><Document />错误摘要</div></template>
            <p class="detail-text">{{ selectedLog.errorSummary || '无错误摘要' }}</p>
          </el-card>
          <el-card shadow="never">
            <template #header><div class="card-title"><Document />脱敏 curl</div></template>
            <pre class="curl-block">{{ sanitizedCurl(selectedLog) }}</pre>
          </el-card>
        </div>
      </template>
      <template #footer>
        <el-button v-if="selectedLog" @click="copySanitizedCurl(selectedLog)">复制脱敏 curl</el-button>
        <el-button v-if="selectedLog" type="danger" plain @click="markQualityCase(selectedLog, 'poor')">标记为质量差案例</el-button>
        <el-button v-if="selectedLog" type="success" plain @click="markQualityCase(selectedLog, 'excellent')">保存为优秀案例</el-button>
      </template>
    </el-drawer>
  </div>
</template>
