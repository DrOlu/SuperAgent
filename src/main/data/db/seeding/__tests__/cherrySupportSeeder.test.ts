import { setupTestDatabase } from '@test-helpers/db'
// Registering the message service is required: the deletion path consults the
// data-service registry even when the legacy agent has no sessions.
import '@data/services/AgentSessionMessageService'
import { eq, sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from 'electron'

import { agentTable } from '@data/db/schemas/agent'
import { agentSessionTable } from '@data/db/schemas/agentSession'
import { SuperAgentSeeder } from '@data/db/seeding/seeders/cherryAssistantSeeder'
import { CherrySupportSeeder } from '@data/db/seeding/seeders/cherrySupportSeeder'
import { BUILTIN_AGENT_ROLE, CHERRY_SUPPORT_AGENT_ID } from '@shared/ai/builtinAgent'

function builtinAgents(db: ReturnType<typeof setupTestDatabase>['db'], role: string) {
  return db
    .select()
    .from(agentTable)
    .where(sql`json_extract(${agentTable.configuration}, '$.builtin_role') = ${role}`)
    .all()
}

describe('CherrySupportSeeder', () => {
  const dbh = setupTestDatabase()

  beforeEach(() => {
    vi.mocked(app.getPreferredSystemLanguages).mockReturnValue(['en-US'])
  })

  it('removes a legacy Cherry Support agent and its sessions', () => {
    dbh.db
      .insert(agentTable)
      .values({
        id: CHERRY_SUPPORT_AGENT_ID,
        type: 'claude-code',
        name: 'Cherry Support',
        instructions: '',
        model: null,
        orderKey: 'a0',
        configuration: { avatar: '🧰', builtin_role: BUILTIN_AGENT_ROLE.SUPPORT }
      })
      .run()

    new CherrySupportSeeder().run(dbh.db)

    expect(dbh.db.select().from(agentTable).where(eq(agentTable.id, CHERRY_SUPPORT_AGENT_ID)).all()).toEqual([])
    expect(builtinAgents(dbh.db, BUILTIN_AGENT_ROLE.SUPPORT)).toEqual([])
    expect(dbh.db.select().from(agentSessionTable).where(eq(agentSessionTable.agentId, CHERRY_SUPPORT_AGENT_ID)).all()).toEqual([])
  })

  it('seeds nothing on a fresh install and stays idempotent', () => {
    new SuperAgentSeeder().run(dbh.db)

    new CherrySupportSeeder().run(dbh.db)
    new CherrySupportSeeder().run(dbh.db)

    expect(builtinAgents(dbh.db, BUILTIN_AGENT_ROLE.SUPPORT)).toEqual([])
    expect(dbh.db.select().from(agentTable).where(eq(agentTable.id, CHERRY_SUPPORT_AGENT_ID)).all()).toEqual([])
    expect(builtinAgents(dbh.db, BUILTIN_AGENT_ROLE.ASSISTANT)).toHaveLength(1)
    expect(
      dbh.db.select().from(agentSessionTable).where(eq(agentSessionTable.agentId, CHERRY_SUPPORT_AGENT_ID)).all()
    ).toEqual([])
  })

  it('preserves an ordinary Agent even when it carries a forged support role', () => {
    dbh.db
      .insert(agentTable)
      .values({
        id: 'ordinary-agent',
        type: 'claude-code',
        name: 'My Agent',
        instructions: 'Keep my instructions',
        model: null,
        orderKey: 'a0',
        configuration: { builtin_role: 'support', avatar: 'U', heartbeat_interval: 7 }
      })
      .run()

    new CherrySupportSeeder().run(dbh.db)

    const [ordinary] = dbh.db.select().from(agentTable).where(eq(agentTable.id, 'ordinary-agent')).all()
    expect(ordinary).toMatchObject({ name: 'My Agent', instructions: 'Keep my instructions' })
    expect(ordinary.configuration).toMatchObject({ avatar: 'U', heartbeat_interval: 7 })
    expect(builtinAgents(dbh.db, BUILTIN_AGENT_ROLE.SUPPORT)).toEqual([
      expect.objectContaining({ id: 'ordinary-agent' })
    ])
    expect(dbh.db.select().from(agentTable).where(eq(agentTable.id, CHERRY_SUPPORT_AGENT_ID)).all()).toEqual([])
  })
})
