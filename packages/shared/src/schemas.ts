import { z } from 'zod'

export const CreateGroupSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
})

export const UpdateGroupSchema = CreateGroupSchema.partial()

export const CreateBoxSchema = z.object({
  label: z.string().min(1).max(20),
  shippingMethod: z.enum(['CHECKED', 'CARRY_ON']),
  ownerId: z.string().uuid().optional(),
  notes: z.string().optional(),
  priority: z.number().int().optional(),
})

export const UpdateBoxSchema = CreateBoxSchema.partial().extend({
  ownerId: z.string().uuid().nullable().optional(),
  status: z.enum(['NOT_PACKED', 'PACKED', 'SEALED']).optional(),
})

export const CreateItemSchema = z.object({
  name: z.string().min(1).max(200),
  ownerId: z.string().uuid().optional(),
  shippingMethod: z.string().optional(),
  groupId: z.string().uuid().optional(),
  quantity: z.number().int().min(1).max(9999).default(1),
  notes: z.string().optional(),
  boxId: z.string().uuid().optional(),
  useCategory: z.string().optional(),
  tags: z.array(z.string()).default([]),
  specialNotes: z.string().optional(),
})

export const UpdateItemSchema = CreateItemSchema.partial().extend({
  ownerId: z.string().uuid().nullable().optional(),
  shippingMethod: z.string().nullable().optional(),
  groupId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  boxId: z.string().uuid().nullable().optional(),
  useCategory: z.string().nullable().optional(),
  specialNotes: z.string().nullable().optional(),
  status: z.enum(['NOT_PACKED', 'PACKED', 'SEALED']).optional(),
})

export const CreateBatterySchema = z.object({
  batteryId: z.string().min(1).max(100),
  ownerId: z.string().uuid().optional(),
  notes: z.string().optional(),
  batteryType: z.string().min(1),
})

export const UpdateBatterySchema = CreateBatterySchema.partial().extend({
  ownerId: z.string().uuid().nullable().optional(),
})

export const CreateBatteryRegulationSchema = z.object({
  title: z.string().min(1).max(100),
  content: z.string().min(1).max(2000),
  sortOrder: z.number().int().default(0),
})

export const UpdateBatteryRegulationSchema = CreateBatteryRegulationSchema.partial()

export const UpdateUserSchema = z.object({
  groupId: z.string().uuid().nullable().optional(),
})

export const ItemsQuerySchema = z.object({
  groupId: z.string().uuid().optional(),
  boxId: z.string().uuid().optional(),
  status: z.enum(['NOT_PACKED', 'PACKED', 'SEALED']).optional(),
  shippingMethod: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export const StickerRequestSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  size: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'A4_SHEET']).default('MEDIUM'),
})

export const CreateSelectOptionSchema = z.object({
  type: z.enum(['SHIPPING_METHOD', 'USE_CATEGORY', 'BATTERY_TYPE']),
  value: z.string().min(1).max(50).optional(),
  label: z.string().min(1).max(50),
  sortOrder: z.number().int().default(0),
})

export const UpdateSelectOptionSchema = CreateSelectOptionSchema.partial().omit({ type: true, value: true })

export const UpdateOllamaConfigSchema = z.object({
  activeModel: z.string().min(1).max(100).optional(),
  generateTimeoutMs: z.number().int().min(5_000).max(600_000).optional(),
  healthTimeoutMs: z.number().int().min(1_000).max(60_000).optional(),
  tagPrompt: z.string().min(1).max(2000).optional(),
})

export const CreateOllamaEndpointSchema = z.object({
  baseUrl: z.string().url().max(300),
  enabled: z.boolean().default(true),
})

export const UpdateOllamaEndpointSchema = z.object({
  baseUrl: z.string().url().max(300).optional(),
  enabled: z.boolean().optional(),
})

export const UpdateAppSettingsSchema = z.object({
  appUrl: z.string().url().max(300),
  adminUrl: z.string().url().max(300),
  apiUrl: z.string().url().max(300),
})

export const UpdateSlackSettingsSchema = z.object({
  clientId: z.string().max(200),
  clientSecret: z.string().max(500).optional(),
  workspaceId: z.string().max(100),
  redirectUri: z.union([z.literal(''), z.string().url().max(300)]),
})

export const AdminAccountSchema = z.object({
  username: z.string().trim().min(3).max(80),
  password: z.string().min(12).max(128),
})

export const UpdateAdminAccountSchema = z.object({
  username: z.string().trim().min(3).max(80),
  password: z.string().min(12).max(128).optional(),
})

export type CreateSelectOptionInput = z.infer<typeof CreateSelectOptionSchema>
export type UpdateSelectOptionInput = z.infer<typeof UpdateSelectOptionSchema>
export type UpdateOllamaConfigInput = z.infer<typeof UpdateOllamaConfigSchema>
export type CreateOllamaEndpointInput = z.infer<typeof CreateOllamaEndpointSchema>
export type UpdateOllamaEndpointInput = z.infer<typeof UpdateOllamaEndpointSchema>
export type UpdateAppSettingsInput = z.infer<typeof UpdateAppSettingsSchema>
export type UpdateSlackSettingsInput = z.infer<typeof UpdateSlackSettingsSchema>
export type AdminAccountInput = z.infer<typeof AdminAccountSchema>
export type UpdateAdminAccountInput = z.infer<typeof UpdateAdminAccountSchema>

export type CreateGroupInput = z.infer<typeof CreateGroupSchema>
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>
export type CreateBoxInput = z.infer<typeof CreateBoxSchema>
export type UpdateBoxInput = z.infer<typeof UpdateBoxSchema>
export type CreateItemInput = z.infer<typeof CreateItemSchema>
export type UpdateItemInput = z.infer<typeof UpdateItemSchema>
export type CreateBatteryInput = z.infer<typeof CreateBatterySchema>
export type UpdateBatteryInput = z.infer<typeof UpdateBatterySchema>
export type CreateBatteryRegulationInput = z.infer<typeof CreateBatteryRegulationSchema>
export type UpdateBatteryRegulationInput = z.infer<typeof UpdateBatteryRegulationSchema>
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>
export type ItemsQuery = z.infer<typeof ItemsQuerySchema>
export type StickerRequest = z.infer<typeof StickerRequestSchema>
