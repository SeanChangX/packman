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

  console.log('Seed complete.')
}

if (require.main === module) {
  seedDefaultData()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
}
