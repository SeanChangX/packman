import { prisma } from '../plugins/prisma'
import { LocalizedError } from '../lib/i18n'

export async function getActiveEventId(): Promise<string> {
  const setting = await prisma.systemSetting.findUnique({ where: { key: 'activeEventId' } })
  if (!setting?.value) throw new LocalizedError('events.error.noActiveSetting', 400)
  return setting.value
}

export async function getActiveEvent() {
  const id = await getActiveEventId()
  return prisma.event.findUnique({ where: { id } })
}
