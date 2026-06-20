import type {
  AdminConfig,
  AdminSession,
  AlertsConfig,
  AuditRecord,
  ConfigVersion,
  LogRecord,
  MetricsResponse,
  QualityPreset,
  SessionRecord,
  StudioModel,
  UsageResponse
} from './types'

const API_PREFIX = '/api'

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
  login: (username: string, password: string) => requestJSON<{ ok: boolean; account: { username: string } }>('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
  logout: () => requestJSON<{ ok: boolean }>('/logout', { method: 'POST', body: '{}' }),
  config: () => requestJSON<{ config: AdminConfig }>('/config'),
  saveConfig: (config: Partial<AdminConfig>) => requestJSON<{ ok: boolean; config: AdminConfig }>('/config', {
    method: 'POST',
    body: JSON.stringify(config)
  }),
  secret: (kind: 'interface' | 'upstream', id: string) => requestJSON<{ secret: { value: string } }>(`/config/secrets?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`),
  metrics: () => requestJSON<MetricsResponse>('/metrics'),
  logs: (type: 'generations' | 'api') => requestJSON<{ records: LogRecord[] }>(`/logs?type=${type}`),
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
  revokeSession: (id: string) => requestJSON<{ ok: boolean }>('/sessions/revoke', {
    method: 'POST',
    body: JSON.stringify({ id })
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
  upstreamHealth: () => requestJSON<{ upstreams: Array<Record<string, unknown>> }>('/upstreams/health'),
  saveModels: (models: StudioModel[]) => requestJSON<{ ok: boolean; models: StudioModel[]; config: AdminConfig }>('/models', {
    method: 'PUT',
    body: JSON.stringify({ models })
  }),
  saveQualityPresets: (qualityPresets: QualityPreset[]) => requestJSON<{ ok: boolean; qualityPresets: QualityPreset[]; config: AdminConfig }>('/quality-presets', {
    method: 'PUT',
    body: JSON.stringify({ qualityPresets })
  }),
  alerts: () => requestJSON<{ alerts: AlertsConfig }>('/alerts'),
  saveAlerts: (alerts: AlertsConfig) => requestJSON<{ ok: boolean; alerts: AlertsConfig; config: AdminConfig }>('/alerts', {
    method: 'PUT',
    body: JSON.stringify({ alerts })
  }),
  backup: () => requestJSON<{ ok: boolean; backup: { createdAt: string; config: AdminConfig } }>('/backup', {
    method: 'POST',
    body: '{}'
  }),
  restore: (backup: { config: AdminConfig } | { backup: { config: AdminConfig } }) => requestJSON<{ ok: boolean; config: AdminConfig }>('/restore', {
    method: 'POST',
    body: JSON.stringify(backup)
  }),
  updateCheck: () => requestJSON<{ update: Record<string, string> }>('/update/check')
}
