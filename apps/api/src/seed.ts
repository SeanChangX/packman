import { prisma } from './plugins/prisma'

const LEGACY_DEFAULT_BOX_LABELS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'E', 'F', '大機', '推車1',
]

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

  // Create default groups from the Notion screenshots
  const groupData = [
    { name: '行政組', color: '#f59e0b' },
    { name: '相機組', color: '#8b5cf6' },
    { name: '主程式組', color: '#6366f1' },
    { name: '共用工具設備', color: '#10b981' },
    { name: '共用電力設備', color: '#f97316' },
    { name: '定位組', color: '#3b82f6' },
    { name: '導航組', color: '#06b6d4' },
    { name: '宏組', color: '#ec4899' },
    { name: 'SIMA組', color: '#84cc16' },
    { name: '倫倫組', color: '#ef4444' },
    { name: '行李工具', color: '#78716c' },
  ]

  for (const g of groupData) {
    await prisma.group.upsert({
      where: { name: g.name },
      update: {},
      create: g,
    })
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

  console.log('Seed complete.')
}

if (require.main === module) {
  seedDefaultData()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
}
