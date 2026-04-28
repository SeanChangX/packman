import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAuth } from '../plugins/auth'
import { cached } from '../services/cache'

const OPTIONS_TTL_MS = 5 * 60_000 // 5 minutes (rarely changes)

export async function optionRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const q = request.query as Record<string, string>
    const cacheKey = q.type ? `selectOptions:${q.type}` : 'selectOptions:all'
    return cached(cacheKey, OPTIONS_TTL_MS, () =>
      prisma.selectOption.findMany({
        where: q.type ? { type: q.type as any } : {},
        orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
      })
    )
  })
}
