<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  Aim,
  Bell,
  Box,
  Collection,
  Connection,
  Cpu,
  DataAnalysis,
  Document,
  Download,
  Edit,
  Finished,
  Hide,
  Key,
  Link,
  Lock,
  MagicStick,
  Monitor,
  More,
  Plus,
  Refresh,
  SwitchButton,
  Timer,
  Upload,
  View
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminApi } from '@/api/client'
import type {
  AdminConfig,
  AlertsConfig,
  AuditRecord,
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
const loginForm = reactive({ username: 'admin', password: '' })
const accountForm = reactive({ username: '', currentPassword: '', newPassword: '' })
const config = ref<AdminConfig | null>(null)
const lastSavedConfig = ref('')
const metrics = ref<MetricsResponse['metrics'] | null>(null)
const generationLogs = ref<LogRecord[]>([])
const apiLogs = ref<LogRecord[]>([])
const qualityCases = ref<QualityCase[]>([])
const upstreamHealth = ref<UpstreamHealthRecord[]>([])
const usage = ref<UsageResponse['usage'] | null>(null)
const versions = ref<ConfigVersion[]>([])
const auditLogs = ref<AuditRecord[]>([])
const sessions = ref<SessionRecord[]>([])
const updateInfo = ref<Record<string, string>>({})
const backupStatus = ref('')
const backupFileInput = ref<HTMLInputElement | null>(null)
const drawerVisible = ref(false)
const drawerMode = ref<DrawerMode>(null)
const drawerIndex = ref(-1)
const logDetailVisible = ref(false)
const selectedLog = ref<LogRecord | null>(null)
const secretValues = reactive<Record<string, string>>({})
const logFilter = reactive({ keyword: '', status: '', interfaceId: '', upstreamId: '', model: '' })

const currentTitle = computed(() => navGroups.flatMap((group) => group.items).find((item) => item.key === activeView.value)?.label || '仪表盘')
const activeInterfaces = computed(() => config.value?.interfaces || [])
const activeUpstreams = computed(() => config.value?.upstreams || [])
const activeModels = computed(() => config.value?.models || [])
const activePresets = computed(() => config.value?.qualityPresets || [])
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
  failedLoginLockoutEnabled: true
})
const filteredGenerationLogs = computed(() => filterLogs(generationLogs.value))
const filteredApiLogs = computed(() => filterLogs(apiLogs.value))
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

function metricValue(value?: number) {
  return Number.isFinite(Number(value)) ? String(value) : '0'
}

function qualityCaseTag(recordId: string, label: 'poor' | 'excellent') {
  return qualityCaseByRecordId.value.get(recordId)?.some((item) => item.label === label) || false
}

function upstreamHealthFor(id?: string) {
  return upstreamHealth.value.find((item) => item.id === id)
}

function filterLogs(records: LogRecord[]) {
  const keyword = logFilter.keyword.trim().toLowerCase()
  return records.filter((record) => {
    const matchesKeyword = !keyword || JSON.stringify(record).toLowerCase().includes(keyword)
    const matchesStatus = !logFilter.status || String(record.status) === logFilter.status
    const matchesInterface = !logFilter.interfaceId || record.interfaceId === logFilter.interfaceId
    const matchesUpstream = !logFilter.upstreamId || record.upstreamId === logFilter.upstreamId
    const matchesModel = !logFilter.model || record.model === logFilter.model
    return matchesKeyword && matchesStatus && matchesInterface && matchesUpstream && matchesModel
  })
}

function setConfig(next: AdminConfig) {
  config.value = structuredClone(next)
  lastSavedConfig.value = JSON.stringify(config.value)
  accountForm.username = next.adminUsername || username.value
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
    const [configData, metricData, generationData, apiData, usageData, versionData, auditData, sessionData, updateData, qualityCaseData, upstreamHealthData] = await Promise.all([
      adminApi.config(),
      adminApi.metrics(),
      adminApi.logs('generations'),
      adminApi.logs('api'),
      adminApi.usage().catch(() => ({ usage: null })),
      adminApi.versions().catch(() => ({ versions: [] })),
      adminApi.auditLogs().catch(() => ({ records: [] })),
      adminApi.sessions().catch(() => ({ sessions: [] })),
      adminApi.updateCheck().catch(() => ({ update: {} })),
      adminApi.qualityCases().catch(() => ({ qualityCases: [] })),
      adminApi.upstreamHealth().catch(() => ({ upstreams: [] }))
    ])
    setConfig(configData.config)
    metrics.value = metricData.metrics
    generationLogs.value = generationData.records
    apiLogs.value = apiData.records
    usage.value = usageData.usage
    versions.value = versionData.versions
    auditLogs.value = auditData.records
    sessions.value = sessionData.sessions
    updateInfo.value = updateData.update
    qualityCases.value = qualityCaseData.qualityCases
    upstreamHealth.value = upstreamHealthData.upstreams
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '刷新失败')
  } finally {
    loading.value = false
  }
}

async function login() {
  loading.value = true
  try {
    const result = await adminApi.login(loginForm.username, loginForm.password)
    authenticated.value = true
    username.value = result.account.username
    loginForm.password = ''
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

async function revealSecret(kind: 'interface' | 'upstream', id: string) {
  const key = `${kind}:${id}`
  if (secretValues[key]) {
    secretValues[key] = ''
    return
  }
  const data = await adminApi.secret(kind, id)
  secretValues[key] = data.secret.value
}

async function rotateKey(item: StudioInterface) {
  await ElMessageBox.confirm('重新生成后旧 Key 会立即失效，确定继续吗？', '重新生成 Key', { type: 'warning' })
  const data = await adminApi.rotateInterfaceKey(item.id)
  setConfig(data.config)
  ElMessage.success('接口 Key 已重新生成')
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
  ElMessage.success('告警配置已保存')
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
  downloadJSON(`image-studio-backup-${Date.now()}.json`, result.backup)
  ElMessage.success('备份已生成')
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
  window.location.href = `/api/logs/export?type=generations&format=${format}`
}

function openLogDetail(record: LogRecord) {
  selectedLog.value = record
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
  await navigator.clipboard?.writeText(sanitizedCurl(record))
  ElMessage.success('已复制脱敏 curl')
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

async function revokeSession(id: string) {
  await adminApi.revokeSession(id)
  sessions.value = (await adminApi.sessions()).sessions
  ElMessage.success('会话已退出')
}

function copySnippet(item: StudioInterface) {
  const snippet = [
    `IMAGE_STUDIO_ENDPOINT=${window.location.origin}`,
    'IMAGE_STUDIO_API_TOKEN=<点击显示已保存 Key 后填写>',
    `IMAGE_STUDIO_DEFAULT_MODEL=${item.defaultImageModel}`,
    `IMAGE_STUDIO_DEFAULT_SIZE=${item.defaultSize}`,
    `IMAGE_STUDIO_DEFAULT_QUALITY=${item.defaultQuality}`
  ].join('\n')
  navigator.clipboard?.writeText(snippet)
  ElMessage.success('已复制 Skill/Codex 配置片段')
}

onMounted(bootstrap)

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
        <el-button type="primary" size="large" class="full-button" :loading="loading" @click="login">登录</el-button>
      </el-form>
    </el-card>
  </div>

  <div v-else class="admin-shell" v-loading="loading">
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
          <button v-for="item in group.items" :key="item.key" :class="{ active: activeView === item.key }" @click="activeView = item.key">
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
          <span class="eyebrow">Image Studio API</span>
          <h1>{{ currentTitle }}</h1>
          <small v-if="config && JSON.stringify(config) !== lastSavedConfig" class="dirty-hint">有未保存的配置变更</small>
        </div>
        <div class="topbar-actions">
          <el-button :icon="Refresh" @click="refreshAll">刷新</el-button>
          <el-button :icon="SwitchButton" type="danger" plain @click="logout">退出登录</el-button>
        </div>
      </header>

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
        <div class="section-actions">
          <el-button type="primary" :icon="Plus" @click="addInterface">新增接口</el-button>
          <el-button :icon="Finished" @click="saveConfig()">保存接口配置</el-button>
        </div>
        <el-card shadow="never">
          <el-table :data="activeInterfaces" row-key="id">
            <el-table-column prop="name" label="名称" min-width="150" />
            <el-table-column prop="apiTokenSet" label="API Key" width="120">
              <template #default="{ row }"><el-tag :type="row.apiTokenSet ? 'success' : 'danger'">{{ row.apiTokenSet ? '已配置' : '未配置' }}</el-tag></template>
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
              <template #default="{ row, $index }">
                <el-button size="small" :icon="Edit" @click="openDrawer('interface', $index)">编辑</el-button>
                <el-button size="small" :icon="Key" @click="rotateKey(row)">重置 Key</el-button>
                <el-dropdown>
                  <el-button size="small" :icon="More">更多</el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item @click="testInterface(row)">测试接口</el-dropdown-item>
                      <el-dropdown-item @click="cloneInterface(row)">克隆</el-dropdown-item>
                      <el-dropdown-item @click="copySnippet(row)">复制 Skill/Codex 配置</el-dropdown-item>
                      <el-dropdown-item divided @click="removeItem('interface', $index)">删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </section>

      <section v-if="activeView === 'upstreams'" class="view-stack">
        <div class="section-actions">
          <el-button type="primary" :icon="Plus" @click="addUpstream">新增上游</el-button>
          <el-button :icon="Finished" @click="saveConfig()">保存上游配置</el-button>
        </div>
        <el-card shadow="never">
          <el-table :data="activeUpstreams" row-key="id">
            <el-table-column prop="name" label="名称" min-width="160" />
            <el-table-column prop="baseURL" label="Base URL" min-width="260" show-overflow-tooltip />
            <el-table-column prop="apiKeySet" label="API Key" width="120">
              <template #default="{ row }"><el-tag :type="row.apiKeySet ? 'success' : 'danger'">{{ row.apiKeySet ? '已配置' : '未配置' }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="priority" label="优先级" width="90" />
            <el-table-column prop="weight" label="权重" width="80" />
            <el-table-column label="健康" min-width="210">
              <template #default="{ row }">
                <div class="health-inline">
                  <el-tag :type="(upstreamHealthFor(row.id)?.metrics.successRate || 0) >= 90 ? 'success' : 'warning'">
                    {{ upstreamHealthFor(row.id)?.metrics.successRate || 0 }}%
                  </el-tag>
                  <span>P95 {{ formatDuration(upstreamHealthFor(row.id)?.metrics.p95DurationMs) }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="healthCheckEnabled" label="健康检查" width="110">
              <template #default="{ row }"><el-switch v-model="row.healthCheckEnabled" /></template>
            </el-table-column>
            <el-table-column prop="enabled" label="状态" width="100">
              <template #default="{ row }"><el-switch v-model="row.enabled" /></template>
            </el-table-column>
            <el-table-column label="操作" width="260" fixed="right">
              <template #default="{ row, $index }">
                <el-button size="small" :icon="Edit" @click="openDrawer('upstream', $index)">编辑</el-button>
                <el-button size="small" :icon="Aim" @click="testUpstream(row)">测试</el-button>
                <el-button size="small" type="danger" plain @click="removeItem('upstream', $index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </section>

      <section v-if="activeView === 'models'" class="view-stack">
        <div class="section-actions">
          <el-button type="primary" :icon="Plus" @click="addModel">新增模型</el-button>
          <el-button :icon="Finished" @click="saveModels">保存模型目录</el-button>
        </div>
        <el-card shadow="never">
          <el-table :data="activeModels" row-key="id">
            <el-table-column prop="id" label="模型 ID" min-width="160" />
            <el-table-column prop="name" label="名称" min-width="140" />
            <el-table-column prop="capabilities" label="能力" min-width="160">
              <template #default="{ row }">{{ row.capabilities.join(', ') }}</template>
            </el-table-column>
            <el-table-column prop="sizes" label="尺寸" min-width="220">
              <template #default="{ row }">{{ row.sizes.join(', ') }}</template>
            </el-table-column>
            <el-table-column prop="enabled" label="启用" width="90">
              <template #default="{ row }"><el-switch v-model="row.enabled" /></template>
            </el-table-column>
            <el-table-column label="操作" width="170">
              <template #default="{ $index }">
                <el-button size="small" :icon="Edit" @click="openDrawer('model', $index)">编辑</el-button>
                <el-button size="small" type="danger" plain @click="removeItem('model', $index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </section>

      <section v-if="activeView === 'quality'" class="view-stack">
        <div class="section-actions">
          <el-button type="primary" :icon="Plus" @click="addPreset">新增预设</el-button>
          <el-button :icon="Finished" @click="saveQualityPresets">保存质量预设</el-button>
        </div>
        <div class="preset-grid">
          <el-card v-for="(preset, index) in activePresets" :key="preset.id" shadow="never" class="preset-card">
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
              <el-button size="small" :icon="Edit" @click="openDrawer('quality', index)">编辑</el-button>
              <el-button size="small" type="danger" plain @click="removeItem('quality', index)">删除</el-button>
            </div>
          </el-card>
        </div>
      </section>

      <section v-if="activeView === 'logs'" class="view-stack">
        <el-card shadow="never">
          <div class="section-actions log-actions">
            <el-button :icon="Download" @click="exportLogs('jsonl')">导出 JSONL</el-button>
            <el-button :icon="Download" @click="exportLogs('csv')">导出 CSV</el-button>
          </div>
          <div class="filter-bar">
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
          </div>
          <el-tabs>
            <el-tab-pane label="生图日志">
              <el-table :data="filteredGenerationLogs" height="520">
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
            <el-tab-pane label="后台 API">
              <el-table :data="filteredApiLogs" height="520">
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
          <el-card shadow="never" class="metric-card"><span>失败</span><strong>{{ usage?.total.failed || 0 }}</strong><small>估算成本后续接入</small></el-card>
          <el-card shadow="never" class="metric-card"><span>累计耗时</span><strong>{{ formatDuration(usage?.total.durationMs) }}</strong><small>按日志统计</small></el-card>
          <el-card shadow="never" class="metric-card"><span>模型数</span><strong>{{ Object.keys(usage?.byModel || {}).length }}</strong><small>已使用模型</small></el-card>
        </div>
        <el-card shadow="never">
          <el-tabs>
            <el-tab-pane label="按接口"><el-table :data="Object.entries(usage?.byInterface || {}).map(([name, value]) => ({ name, ...value }))"><el-table-column prop="name" label="接口" /><el-table-column prop="total" label="调用" /><el-table-column prop="success" label="成功" /><el-table-column prop="failed" label="失败" /></el-table></el-tab-pane>
            <el-tab-pane label="按模型"><el-table :data="Object.entries(usage?.byModel || {}).map(([name, value]) => ({ name, ...value }))"><el-table-column prop="name" label="模型" /><el-table-column prop="total" label="调用" /><el-table-column prop="success" label="成功" /><el-table-column prop="failed" label="失败" /></el-table></el-tab-pane>
            <el-tab-pane label="按上游"><el-table :data="Object.entries(usage?.byUpstream || {}).map(([name, value]) => ({ name, ...value }))"><el-table-column prop="name" label="上游" /><el-table-column prop="total" label="调用" /><el-table-column prop="success" label="成功" /><el-table-column prop="failed" label="失败" /></el-table></el-tab-pane>
          </el-tabs>
        </el-card>
      </section>

      <section v-if="activeView === 'alerts'" class="view-stack">
        <el-card shadow="never">
          <template #header><div class="card-title"><Bell />告警中心</div></template>
          <el-form v-if="config" :model="alertsForm" label-width="150px" class="narrow-form">
            <el-form-item label="Webhook 通知"><el-switch v-model="config.alerts.webhookEnabled" /></el-form-item>
            <el-form-item label="Webhook URL"><el-input v-model="config.alerts.webhookURL" placeholder="https://hooks.example/a" /></el-form-item>
            <el-form-item label="上游失败阈值"><el-input-number v-model="config.alerts.upstreamFailureThreshold" :min="1" /></el-form-item>
            <el-form-item label="成功率阈值"><el-input-number v-model="config.alerts.successRateThreshold" :min="1" :max="100" /></el-form-item>
            <el-form-item label="P95 阈值 ms"><el-input-number v-model="config.alerts.p95LatencyMsThreshold" :min="100" /></el-form-item>
            <el-form-item><el-button type="primary" @click="saveAlerts">保存告警配置</el-button></el-form-item>
          </el-form>
        </el-card>
      </section>

      <section v-if="activeView === 'security'" class="view-stack">
        <div class="content-grid">
          <el-card shadow="never">
            <template #header><div class="card-title"><Lock />账号与安全</div></template>
            <el-form v-if="config" label-width="140px" class="narrow-form">
              <el-form-item label="IP 白名单"><el-input :model-value="securityForm.ipAllowlist.join('\n')" type="textarea" :rows="5" placeholder="每行一个 IP" @update:model-value="(value: string) => config && (config.security.ipAllowlist = value.split('\n').map((item) => item.trim()).filter(Boolean))" /></el-form-item>
              <el-form-item label="失败登录锁定"><el-switch v-model="config.security.failedLoginLockoutEnabled" /></el-form-item>
              <el-form-item label="TOTP 二次验证"><el-switch v-model="config.security.totpEnabled" /></el-form-item>
              <el-form-item><el-button type="primary" @click="saveConfig('安全配置已保存')">保存安全配置</el-button></el-form-item>
            </el-form>
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
        <div class="content-grid">
          <el-card shadow="never">
            <template #header><div class="card-title"><Collection />当前会话</div></template>
            <el-table :data="sessions">
              <el-table-column prop="username" label="账号" />
              <el-table-column prop="createdAt" label="登录时间"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
              <el-table-column prop="current" label="当前" width="90"><template #default="{ row }"><el-tag v-if="row.current" type="success">当前</el-tag></template></el-table-column>
              <el-table-column label="操作" width="100"><template #default="{ row }"><el-button v-if="!row.current" size="small" @click="revokeSession(row.id)">退出</el-button></template></el-table-column>
            </el-table>
          </el-card>
          <el-card shadow="never">
            <template #header><div class="card-title"><Document />登录历史</div></template>
            <el-table :data="auditLogs.filter((item) => item.action === 'auth.login').slice(0, 8)" height="280">
              <el-table-column prop="createdAt" label="时间"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
              <el-table-column prop="username" label="账号" />
            </el-table>
          </el-card>
        </div>
        <el-card shadow="never">
          <template #header><div class="card-title"><Document />审计日志</div></template>
          <el-table :data="auditLogs" height="360">
            <el-table-column prop="createdAt" label="时间" min-width="160"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
            <el-table-column prop="username" label="操作者" width="120" />
            <el-table-column prop="action" label="动作" min-width="160" />
            <el-table-column prop="details" label="详情" min-width="260"><template #default="{ row }">{{ JSON.stringify(row.details || {}) }}</template></el-table-column>
          </el-table>
        </el-card>
      </section>

      <section v-if="activeView === 'system'" class="view-stack">
        <div class="content-grid">
          <el-card shadow="never">
            <template #header><div class="card-title"><Download />备份恢复</div></template>
            <div class="system-actions">
              <el-button type="primary" :icon="Download" @click="createBackup">一键备份</el-button>
              <el-button :icon="Upload" @click="openRestorePicker">上传恢复</el-button>
              <input ref="backupFileInput" class="hidden-file" type="file" accept="application/json,.json" @change="restoreFromFile" />
              <span>{{ backupStatus || '自动保留最近配置快照，恢复前请确认版本。' }}</span>
            </div>
            <el-table :data="versions" height="360">
              <el-table-column prop="createdAt" label="时间" min-width="160"><template #default="{ row }">{{ formatTime(row.createdAt) }}</template></el-table-column>
              <el-table-column prop="username" label="操作者" width="120" />
              <el-table-column prop="summary" label="摘要" min-width="200" />
              <el-table-column label="操作" width="120"><template #default="{ row }"><el-button size="small" @click="restoreVersion(row.id)">恢复</el-button></template></el-table-column>
            </el-table>
          </el-card>
          <el-card shadow="never">
            <template #header><div class="card-title"><Cpu />版本更新</div></template>
            <div class="status-list">
              <div><span>当前版本</span><strong>{{ updateInfo.currentVersion || 'dev' }}</strong></div>
              <div><span>最新版本</span><strong>{{ updateInfo.latestVersion || '未知' }}</strong></div>
              <div><span>状态</span><strong>{{ updateInfo.status || 'unknown' }}</strong></div>
              <div><span>来源</span><strong>{{ updateInfo.source || 'release' }}</strong></div>
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
          <el-form-item label="推荐用途"><el-input v-model="config.models[drawerIndex].recommendedUse" type="textarea" /></el-form-item>
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
