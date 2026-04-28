import { prisma } from './plugins/prisma'
import { DEFAULT_TAG_PROMPT } from './services/ollama'

const LEGACY_DEFAULT_BOX_LABELS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'E', 'F', '大機', '推車1',
]

function defaultOllamaBaseUrls() {
  return (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434')
    .split(',')
    .map((url) => url.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

async function ensureExampleBox() {
  const boxCount = await prisma.box.count()

  if (boxCount > 0) {
    const legacyEmptyBoxes = await prisma.box.findMany({
      where: {
        label: { in: LEGACY_DEFAULT_BOX_LABELS },
        ownerId: null,
        notes: null,
        priority: null,
        items: { none: {} },
      },
      select: { id: true },
    })

    if (legacyEmptyBoxes.length === boxCount && boxCount > 1) {
      await prisma.box.deleteMany({
        where: { id: { in: legacyEmptyBoxes.map((box) => box.id) } },
      })
    } else {
      return
    }
  }

  await prisma.box.create({
    data: {
      label: '範例箱',
      shippingMethod: 'CHECKED',
      notes: '可由管理員改名或刪除',
    },
  })
}

export async function seedDefaultData() {
  console.log('Seeding database...')

  const groupCount = await prisma.group.count()
  if (groupCount === 0) {
    await prisma.group.create({ data: { name: '範例組別', color: '#6366F1' } })
  }

  await ensureExampleBox()

  const regulationCount = await prisma.batteryRegulation.count()
  if (regulationCount === 0) {
    await prisma.batteryRegulation.create({
      data: {
        title: '台灣出入境鋰電池規定',
        content: [
          '鋰電池禁止放置於託運行李',
          '行動電源需隨身攜帶登機',
          '≤100Wh：可隨身攜帶',
          '100-160Wh：每人限 2 個，需航空公司許可',
          '>160Wh：禁止攜帶',
          '電池端子需保護，避免短路',
        ].join('\n'),
        sortOrder: 0,
      },
    })
  }

  const defaultSelectOptions = [
    { type: 'SHIPPING_METHOD' as const, value: 'CHECKED',        label: '託運',       sortOrder: 0 },
    { type: 'SHIPPING_METHOD' as const, value: 'CARRY_ON',       label: '登機',       sortOrder: 1 },
    { type: 'USE_CATEGORY'    as const, value: 'HIGH_FREQ',      label: '高使用頻率', sortOrder: 0 },
    { type: 'USE_CATEGORY'    as const, value: 'RETURN_ONLY',    label: '往返物品',   sortOrder: 1 },
    { type: 'USE_CATEGORY'    as const, value: 'ONE_WAY',        label: '單程物品',   sortOrder: 2 },
    { type: 'USE_CATEGORY'    as const, value: 'LOW_FREQ',       label: '低使用頻率', sortOrder: 3 },
    { type: 'BATTERY_TYPE'    as const, value: 'POWER_TOOL',     label: '工具機電池', sortOrder: 0 },
    { type: 'BATTERY_TYPE'    as const, value: 'POWER_BANK', label: '行動電源', sortOrder: 1 },
    { type: 'BATTERY_TYPE'    as const, value: 'LIFEPO4',        label: '磁酸鋰鐵電池', sortOrder: 2 },
  ]
  for (const opt of defaultSelectOptions) {
    await prisma.selectOption.upsert({
      where: { type_value: { type: opt.type, value: opt.value } },
      update: {},
      create: opt,
    })
  }

  const endpointCount = await prisma.ollamaEndpoint.count()
  if (endpointCount === 0) {
    for (const baseUrl of defaultOllamaBaseUrls()) {
      await prisma.ollamaEndpoint.upsert({
        where: { baseUrl },
        update: {},
        create: { baseUrl },
      })
    }
  }

  await prisma.systemSetting.upsert({
    where: { key: 'ollama.visionModel' },
    update: {},
    create: {
      key: 'ollama.visionModel',
      value: process.env.OLLAMA_VISION_MODEL ?? 'llava',
    },
  })
  await prisma.systemSetting.upsert({
    where: { key: 'ollama.generateTimeoutMs' },
    update: {},
    create: { key: 'ollama.generateTimeoutMs', value: '60000' },
  })
  await prisma.systemSetting.upsert({
    where: { key: 'ollama.healthTimeoutMs' },
    update: {},
    create: { key: 'ollama.healthTimeoutMs', value: '5000' },
  })
  await prisma.systemSetting.upsert({
    where: { key: 'ollama.tagPrompt' },
    update: {},
    create: { key: 'ollama.tagPrompt', value: DEFAULT_TAG_PROMPT },
  })

  console.log('Seed complete.')
}

if (require.main === module) {
  seedDefaultData()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
}
