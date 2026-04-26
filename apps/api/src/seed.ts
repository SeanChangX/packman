import { prisma } from './plugins/prisma'

async function main() {
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

  // Create default boxes matching the Notion structure
  const boxData = [
    { label: '1', shippingMethod: 'CHECKED' as const },
    { label: '2', shippingMethod: 'CHECKED' as const },
    { label: '3', shippingMethod: 'CHECKED' as const },
    { label: '4', shippingMethod: 'CHECKED' as const },
    { label: '5', shippingMethod: 'CHECKED' as const },
    { label: '6', shippingMethod: 'CHECKED' as const },
    { label: '7', shippingMethod: 'CHECKED' as const },
    { label: '8', shippingMethod: 'CHECKED' as const },
    { label: '9', shippingMethod: 'CHECKED' as const },
    { label: 'A', shippingMethod: 'CARRY_ON' as const },
    { label: 'B', shippingMethod: 'CARRY_ON' as const },
    { label: 'C', shippingMethod: 'CARRY_ON' as const },
    { label: 'D', shippingMethod: 'CARRY_ON' as const },
    { label: 'E', shippingMethod: 'CARRY_ON' as const },
    { label: 'F', shippingMethod: 'CARRY_ON' as const },
    { label: '大機', shippingMethod: 'CARRY_ON' as const },
    { label: '推車1', shippingMethod: 'CHECKED' as const },
  ]

  for (const b of boxData) {
    await prisma.box.upsert({
      where: { label: b.label },
      update: {},
      create: b,
    })
  }

  console.log('Seed complete.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
