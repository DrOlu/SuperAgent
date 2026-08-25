import { agentService } from '@data/services/AgentService'
import { agentSessionService } from '@data/services/AgentSessionService'
import { CHERRY_SUPPORT_AGENT_ID } from '@shared/ai/builtinAgent'

import type { DbType, ISeeder } from '../../types'

/**
 * SuperAgent: the builtin Cherry Support agent is not part of the product.
 * Removes any row a previous version created; fresh installs never seed one.
 */
export class CherrySupportSeeder implements ISeeder {
  readonly name = 'cherrySupport'
  readonly description = 'Remove the builtin Cherry Support agent from every agent library'
  readonly executionPolicy = 'run-on-change' as const
  readonly version = '4'

  run(db: DbType): void {
    db.transaction((tx) => {
      agentSessionService.prepareForAgentDeletionTx(tx, CHERRY_SUPPORT_AGENT_ID, { deleteSessions: true })
      agentService.deleteAgentTx(tx, CHERRY_SUPPORT_AGENT_ID)
    })
  }
}
