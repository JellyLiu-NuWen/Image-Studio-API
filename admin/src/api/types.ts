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

export interface SecurityConfig {
  ipAllowlist: string[]
  totpEnabled: boolean
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
      p95DurationMs: number
      lastFailure: string
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
    p95DurationMs: number
    lastFailure: string
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
}

export interface UsageBucket {
  total: number
  success: number
  failed: number
  durationMs: number
}

export interface UsageResponse {
  usage: {
    total: UsageBucket
    byInterface: Record<string, UsageBucket>
    byUpstream: Record<string, UsageBucket>
    byModel: Record<string, UsageBucket>
  }
}

export interface ConfigVersion {
  id: string
  createdAt: string
  username: string
  summary: string
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
