export interface AdminSession {
  authenticated: boolean
  account?: {
    username: string
  }
}

export interface AdminConfig {
  adminUsername: string
  adminPasswordSet: boolean
  upstreamBaseURL: string
  upstreamApiKeySet: boolean
  imageApiTokenSet: boolean
  defaultImageModel: string
  defaultTextModel: string
  defaultSize: string
  defaultQuality: string
  defaultOutputFormat: string
  requestTimeoutSeconds: number
  maxConcurrentRequests: number
  rateLimitPerMinute: number
  interfaces: StudioInterface[]
  upstreams: StudioUpstream[]
  models: StudioModel[]
  qualityPresets: QualityPreset[]
  qualityCases: QualityCase[]
  alerts: AlertsConfig
  security: SecurityConfig
}

export interface StudioInterface {
  id: string
  name: string
  enabled: boolean
  apiTokenSet: boolean
  apiTokenPreview?: string
  apiToken?: string
  upstreamIds: string[]
  defaultImageModel: string
  defaultTextModel: string
  defaultSize: string
  defaultQuality: string
  defaultOutputFormat: string
  qualityPresetId: string
  requestTimeoutSeconds: number
  maxConcurrentRequests: number
  rateLimitPerMinute: number
  lastUsedAt: string
}

export interface StudioUpstream {
  id: string
  name: string
  enabled: boolean
  baseURL: string
  apiKeySet: boolean
  apiKeyPreview?: string
  apiKey?: string
  priority: number
  weight: number
  healthCheckEnabled: boolean
}

export interface StudioModel {
  id: string
  name: string
  enabled: boolean
  capabilities: string[]
  sizes: string[]
  qualities: string[]
  defaultOutputFormat: string
  recommendedUse: string
  upstreamIds: string[]
}

export interface QualityPreset {
  id: string
  name: string
  quality: string
  size: string
  outputFormat: string
  promptEnhance: boolean
  template: string
  useCase: string
}

export interface QualityCase {
  id: string
  recordId: string
  label: 'poor' | 'excellent'
  note: string
  createdAt: string
  username: string
  endpoint: string
  interfaceId: string
  upstreamId: string
  model: string
  durationMs: number
  status: string
  errorSummary: string
}

export interface AlertsConfig {
  webhookEnabled: boolean
  webhookURL?: string
  webhookURLSet?: boolean
  upstreamFailureThreshold: number
  successRateThreshold: number
  p95LatencyMsThreshold: number
}

export interface ActiveAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  details: Record<string, unknown>
  createdAt: string
  acknowledged: boolean
  acknowledgedAt?: string
}

export interface AlertSummary {
  total: number
  critical: number
  warning: number
  info: number
  acknowledged: number
}

export interface AlertNotification {
  status: 'idle' | 'sent' | 'failed'
  sentAt?: string
  webhookStatus?: number
  alertCount?: number
  errorSummary?: string
}

export interface SecurityConfig {
  ipAllowlist: string[]
  totpEnabled: boolean
  totpConfigured?: boolean
  failedLoginLockoutEnabled: boolean
}

export interface MetricsSummary {
  total: number
  success: number
  failed?: number
  error?: number
  successRate: number
  errorRate: number
  p50DurationMs: number
  p95DurationMs: number
  p99DurationMs: number
  today?: number
}

export interface MetricsResponse {
  metrics: {
    api: MetricsSummary
    generations: MetricsSummary
    upstreams: Record<string, {
      total: number
      success: number
      failed: number
      successRate: number
      averageDurationMs: number
      p95DurationMs: number
      lastCheckedAt: string
      lastFailure: string
      lastFailureReason: string
    }>
    activeRequests?: number
  }
}

export interface UpstreamHealthRecord {
  id: string
  name: string
  enabled: boolean
  healthCheckEnabled: boolean
  priority: number
  weight: number
  metrics: {
    total: number
    success: number
    failed: number
    successRate: number
    averageDurationMs: number
    p95DurationMs: number
    lastCheckedAt: string
    lastFailure: string
    lastFailureReason: string
  }
}

export interface LogRecord {
  id: string
  createdAt: string
  finishedAt?: string
  method?: string
  path?: string
  endpoint?: string
  authKind?: string
  status: string | number
  interfaceId?: string
  upstreamId?: string
  model?: string
  upstreamStatus?: number
  retryCount?: number
  failoverChain?: string[]
  durationMs: number
  errorSummary?: string
  stream?: GenerationStreamDiagnostics
}

export interface GenerationStreamDiagnostics {
  requested: boolean
  upstreamStarted: boolean
  upstreamStatus: number
  upstreamContentType: string
  finalState: string
  timeoutSeconds: number
  heartbeatCount: number
  upstreamChunkCount: number
  upstreamByteCount: number
  partialImageEvents: number
  completedEvents: number
  errorEvents: number
  clientAborted: boolean
  gatewayTimeout: boolean
  errorSummary: string
  events: string[]
  upstreamId: string
  finishedAt: string
}

export interface UsageBucket {
  total: number
  success: number
  failed: number
  durationMs: number
  imageCount: number
  estimatedCostUSD: number
  averageDurationMs: number
  successRate: number
}

export interface UsageResponse {
  usage: {
    total: UsageBucket
    byInterface: Record<string, UsageBucket>
    byUpstream: Record<string, UsageBucket>
    byModel: Record<string, UsageBucket>
    byDate: Record<string, UsageBucket>
  }
}

export type LogClearTarget = 'application' | 'api' | 'generations' | 'docker'

export interface LogClearResponse {
  ok: boolean
  targets: LogClearTarget[]
  result: {
    api: { cleared: boolean; count: number }
    generations: { cleared: boolean; count: number }
    docker: { cleared: boolean; status: string; message: string }
  }
}

export type NoCostHealthStatus = 'pass' | 'warn' | 'fail'

export interface NoCostHealthCheck {
  id: string
  label: string
  status: NoCostHealthStatus
  message: string
  details: Record<string, unknown>
}

export interface NoCostHealthResponse {
  ok: boolean
  checkedAt: string
  summary: {
    total: number
    passed: number
    warning: number
    failed: number
  }
  checks: NoCostHealthCheck[]
}

export interface UpdateInfo {
  currentVersion?: string
  currentCommit?: string
  dockerImageTag?: string
  latestVersion?: string
  status?: string
  source?: string
  releaseURL?: string
  changelogURL?: string
  changelog?: string
  rollbackCommand?: string
  deployment?: {
    status: string
    message: string
    currentCommit: string
    dockerImageTag: string
    mainCommit: string
    mainCommitURL: string
    commitStatus: string
    imageTagStatus: string
  }
}

export interface ConfigVersion {
  id: string
  createdAt: string
  username: string
  summary: string
}

export interface BackupRecord {
  id: string
  createdAt: string
  username: string
  summary: string
  config: AdminConfig
  rawConfig?: AdminConfig
}

export interface AuditRecord {
  id: string
  createdAt: string
  username: string
  action: string
  details: Record<string, unknown>
}

export interface SessionRecord {
  id: string
  username: string
  createdAt: string
  current: boolean
}
