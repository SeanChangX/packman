export type Role = 'ADMIN' | 'MEMBER'
export type ShippingMethod = 'CHECKED' | 'CARRY_ON'
export type PackingStatus = 'NOT_PACKED' | 'PACKED' | 'SEALED'
export type AiTagStatus = 'NONE' | 'PENDING' | 'DONE' | 'FAILED'
export type SelectOptionType = 'SHIPPING_METHOD' | 'USE_CATEGORY' | 'BATTERY_TYPE'

export interface SelectOption {
  id: string
  type: SelectOptionType
  value: string
  label: string
  sortOrder: number
  createdAt: string
}

export interface Group {
  id: string
  name: string
  color: string
  createdAt: string
}

export interface User {
  id: string
  slackId: string
  name: string
  email?: string
  avatarUrl?: string
  role: Role
  groupId?: string
  group?: Group
  createdAt: string
}

export interface Box {
  id: string
  label: string
  shippingMethod: ShippingMethod
  ownerId?: string
  owner?: User
  status: PackingStatus
  notes?: string
  priority?: number
  items?: Item[]
  itemCount?: number
  createdAt: string
}

export interface Item {
  id: string
  name: string
  ownerId?: string
  owner?: User
  createdById?: string
  createdBy?: User
  shippingMethod?: string
  groupId?: string
  group?: Group
  quantity: number
  status: PackingStatus
  notes?: string
  boxId?: string
  box?: Box
  useCategory?: string
  tags: string[]
  specialNotes?: string
  photoUrl?: string
  aiTagStatus: AiTagStatus
  createdAt: string
}

export interface Battery {
  id: string
  batteryId: string
  ownerId?: string
  owner?: User
  notes?: string
  batteryType: string
  createdAt: string
}

export interface BatteryRegulation {
  id: string
  title: string
  content: string
  sortOrder: number
  createdAt: string
}

export interface OllamaEndpoint {
  id: string
  baseUrl: string
  enabled: boolean
  avgLatencyMs?: number | null
  lastLatencyMs?: number | null
  requestCount: number
  failureCount: number
  lastSuccessAt?: string | null
  lastErrorAt?: string | null
  lastError?: string | null
  healthAvgLatencyMs?: number | null
  healthLastLatencyMs?: number | null
  healthCheckCount: number
  healthFailureCount: number
  healthLastSuccessAt?: string | null
  healthLastErrorAt?: string | null
  healthLastError?: string | null
  createdAt: string
  updatedAt: string
}

export interface OllamaEndpointStatus extends OllamaEndpoint {
  ok: boolean
  models: string[]
  message?: string
}

export interface OllamaConfig {
  activeModel: string
  models: string[]
  endpoints: OllamaEndpointStatus[]
  aiTagJobs?: {
    queued: number
    running: number
    done: number
    failed: number
    cancelled: number
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface ApiError {
  message: string
  code?: string
}
