import type { Prisma, PrismaClient } from '@prisma/client'
import type { Request } from 'express'
import { prisma } from './prisma.js'

type Db = PrismaClient | Prisma.TransactionClient

type AuditEntry = {
  actorId?: string | null
  action: string
  entity: string
  entityId?: string | null
  details?: Prisma.InputJsonValue
  request?: Request
}

// Pass a transaction client so the audit row commits or rolls back with the change.
export async function writeAudit(entry: AuditEntry, db: Db = prisma) {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        details: entry.details,
        ip: entry.request?.ip ?? null,
      },
    })
  } catch (error) {
    // Audit failures must not block the primary action outside a transaction.
    if (db !== prisma) throw error
    console.error('Audit write failed', error)
  }
}
