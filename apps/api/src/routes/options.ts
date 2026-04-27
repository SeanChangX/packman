import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAuth } from '../plugins/auth'

export async function optionRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: requireAuth }, async (request) => {
    const q = request.query as Record<string, string>
    const where = q.type ? { type: q.type as any } : {}
    return prisma.selectOption.findMany({
      where,
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    })
  })
}
