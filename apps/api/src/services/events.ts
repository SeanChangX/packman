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

// True if the user is allowed to access the active event. Admin role bypasses
// the check; an event with zero members is treated as unrestricted; no active
// event also means unrestricted.
export async function isUserAllowedInActiveEvent(userId: string, userRole: string): Promise<boolean> {
  if (userRole === 'ADMIN') return true
  const activeEventId = await prisma.systemSetting.findUnique({ where: { key: 'activeEventId' } })
    .then((s) => s?.value ?? null)
  if (!activeEventId) return true
  const memberCount = await prisma.eventMember.count({ where: { eventId: activeEventId } })
  if (memberCount === 0) return true
  const isMember = await prisma.eventMember.findUnique({
    where: { eventId_userId: { eventId: activeEventId, userId } },
    select: { eventId: true },
  })
  return isMember !== null
}
