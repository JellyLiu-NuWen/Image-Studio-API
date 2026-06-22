import type {
  AdminConfig,
  AdminSession,
  ActiveAlert,
  AlertSummary,
  AlertNotification,
  AlertsConfig,
  AuditRecord,
  BackupRecord,
  ConfigVersion,
  LogClearResponse,
  LogClearTarget,
  LogRecord,
  MetricsResponse,
  NoCostHealthResponse,
  QualityCase,
  QualityPreset,
  SessionRecord,
  StudioModel,
  UpstreamHealthRecord,
  UpdateInfo,
  UsageResponse
} from './types'

const API_PREFIX = '/api'

export type LogQuery = Record<string, string | number | undefined>

function queryString(params: LogQuery = {}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

async function requestJSON<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...(init.headers || {})
    },
    ...init
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}
  if (!response.ok) {
    throw new Error(data?.error?.message || `HTTP ${response.status}`)
  }
  return data as T
}

export const adminApi = {
  session: () => requestJSON<AdminSession>('/session'),
  login: (username: string, password: string, totpCode = '') => requestJSON<{ ok: boolean; account: { username: string } }>('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, totpCode })
  }),
  logout: () => requestJSON<{ ok: boolean }>('/logout', { method: 'POST', body: '{}' }),
  config: () => requestJSON<{ config: AdminConfig }>('/config'),
  saveConfig: (config: Partial<AdminConfig>) => requestJSON<{ ok: boolean; config: AdminConfig }>('/config', {
    method: 'POST',
    body: JSON.stringify(config)
  }),
  secret: (kind: 'interface' | 'upstream', id: string) => requestJSON<{ secret: { value: string } }>(`/config/secrets?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`),
  metrics: () => requestJSON<MetricsResponse>('/metrics'),
  logs: (type: 'generations' | 'api', filters: LogQuery = {}) => requestJSON<{ records: LogRecord[] }>(`/logs${queryString({ type, ...filters })}`),
  clearLogs: (targets: LogClearTarget[], confirm: string) => requestJSON<LogClearResponse>('/logs/clear', {
    method: 'POST',
    body: JSON.stringify({ targets, confirm })
  }),
  usage: () => requestJSON<UsageResponse>('/usage'),
  versions: () => requestJSON<{ versions: ConfigVersion[] }>('/config/versions'),
  restoreVersion: (id: string) => requestJSON<{ ok: boolean; config: AdminConfig }>(`/config/versions/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    body: '{}'
  }),
  auditLogs: () => requestJSON<{ records: AuditRecord[] }>('/audit-logs'),
  sessions: () => requestJSON<{ sessions: SessionRecord[] }>('/sessions'),
  account: (body: { username: string; currentPassword: string; newPassword: string }) => requestJSON<{ ok: boolean; account: { username: string } }>('/account', {
    method: 'POST',
    body: JSON.stringify(body)
  }),
  totpSetup: () => requestJSON<{ ok: boolean; totp: { secret: string; otpauthURL: string }; security: AdminConfig['security'] }>('/security/totp/setup', {
    method: 'POST',
    body: '{}'
  }),
  totpEnable: (code: string) => requestJSON<{ ok: boolean; security: AdminConfig['security'] }>('/security/totp/enable', {
    method: 'POST',
    body: JSON.stringify({ code })
  }),
  totpDisable: (code: string) => requestJSON<{ ok: boolean; security: AdminConfig['security'] }>('/security/totp/disable', {
    method: 'POST',
    body: JSON.stringify({ code })
  }),
  revokeSession: (payload: { id?: string; others?: boolean }) => requestJSON<{ ok: boolean; revoked: number; sessions: SessionRecord[] }>('/sessions/revoke', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  rotateInterfaceKey: (id: string) => requestJSON<{ ok: boolean; apiToken: string; config: AdminConfig }>(`/interfaces/${encodeURIComponent(id)}/rotate-key`, {
    method: 'POST',
    body: '{}'
  }),
  cloneInterface: (id: string, cloneId: string, name: string) => requestJSON<{ ok: boolean; config: AdminConfig }>(`/interfaces/${encodeURIComponent(id)}/clone`, {
    method: 'POST',
    body: JSON.stringify({ id: cloneId, name })
  }),
  testInterface: (id: string) => requestJSON<{ ok: boolean; message: string }>(`/interfaces/${encodeURIComponent(id)}/test`, {
    method: 'POST',
    body: '{}'
  }),
  testUpstream: (id: string) => requestJSON<{ ok: boolean; upstream: { message: string; status: string; durationMs: number } }>(`/upstreams/${encodeURIComponent(id)}/test`, {
    method: 'POST',
    body: '{}'
  }),
  upstreamHealth: () => requestJSON<{ upstreams: UpstreamHealthRecord[] }>('/upstreams/health'),
  saveModels: (models: StudioModel[]) => requestJSON<{ ok: boolean; models: StudioModel[]; config: AdminConfig }>('/models', {
    method: 'PUT',
    body: JSON.stringify({ models })
  }),
  saveQualityPresets: (qualityPresets: QualityPreset[]) => requestJSON<{ ok: boolean; qualityPresets: QualityPreset[]; config: AdminConfig }>('/quality-presets', {
    method: 'PUT',
    body: JSON.stringify({ qualityPresets })
  }),
  qualityCases: () => requestJSON<{ qualityCases: QualityCase[] }>('/quality-cases'),
  markQualityCase: (recordId: string, label: 'poor' | 'excellent', note = '') => requestJSON<{ ok: boolean; case: QualityCase; qualityCases: QualityCase[]; config: AdminConfig }>('/quality-cases', {
    method: 'POST',
    body: JSON.stringify({ recordId, label, note })
  }),
  alerts: () => requestJSON<{ alerts: AlertsConfig }>('/alerts'),
  saveAlerts: (alerts: AlertsConfig) => requestJSON<{ ok: boolean; alerts: AlertsConfig; config: AdminConfig }>('/alerts', {
    method: 'PUT',
    body: JSON.stringify({ alerts })
  }),
  activeAlerts: () => requestJSON<{ alerts: ActiveAlert[]; summary: AlertSummary; notification: AlertNotification }>('/alerts/active'),
  acknowledgeAlert: (id: string) => requestJSON<{ ok: boolean; alert: ActiveAlert; alerts: ActiveAlert[]; summary: AlertSummary; notification: AlertNotification }>(`/alerts/${encodeURIComponent(id)}/ack`, {
    method: 'POST',
    body: '{}'
  }),
  backups: () => requestJSON<{ backups: BackupRecord[] }>('/backup'),
  backup: () => requestJSON<{ ok: boolean; backup: BackupRecord }>('/backup', {
    method: 'POST',
    body: '{}'
  }),
  restore: (backup: { backupId: string } | { config: AdminConfig } | { backup: BackupRecord }) => requestJSON<{ ok: boolean; config: AdminConfig }>('/restore', {
    method: 'POST',
    body: JSON.stringify(backup)
  }),
  updateCheck: () => requestJSON<{ update: UpdateInfo }>('/update/check'),
  noCostHealth: () => requestJSON<NoCostHealthResponse>('/health/no-cost')
}
