import { prisma } from '../plugins/prisma'

export async function getActiveEventId(): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'activeEventId' } })
  if (!setting?.value) throw new Error('尚未設定使用中的 Event，請至管理介面建立並啟用一個 Event')
  return setting.value
}

export async function getActiveEvent() {
  const id = await getActiveEventId()
  return prisma.event.findUnique({ where: { id } })
}
