import { and, eq, inArray } from 'drizzle-orm'

import { ENDPOINT_TYPE } from '@cherrystudio/provider-registry'
import { preferenceTable } from '@data/db/schemas/preference'
import type { InsertUserModelRow } from '@data/db/schemas/userModel'
import { userModelTable } from '@data/db/schemas/userModel'
import type { InsertUserProviderRow } from '@data/db/schemas/userProvider'
import { providerService } from '@data/services/ProviderService'
import { userProviderTable } from '@data/db/schemas/userProvider'
import { insertManyWithOrderKey } from '@data/services/utils/orderKey'
import { loggerService } from '@logger'
import {
  CHERRY_CLOUD_PROVIDER_ID,
  CHERRYAI_API_BASE_URL,
  CHERRYAI_DEFAULT_MODEL_GROUP,
  CHERRYAI_DEFAULT_MODEL_ID,
  CHERRYAI_DEFAULT_MODEL_NAME,
  CHERRYAI_DEFAULT_UNIQUE_MODEL_ID,
  CHERRYAI_PROVIDER_ID,
  CHERRYAI_PROVIDER_NAME
} from '@shared/data/presets/cherryai'
import { SystemProviderIds } from '@shared/utils/systemProviderId'
import { createUniqueModelId } from '@shared/data/types/model'
import type { ModelCapability } from '@shared/data/types/model'

import type { DbType, ISeeder } from '../../types'
import { hashObject } from '../hashObject'

const logger = loggerService.withContext('CherryAiDefaultModelSeeder')

const DEFAULT_MODEL_PREFERENCE_SCOPE = 'default' as const
/**
 * Pre-2.1.9 default model id. The api.superagent.ng gateway now serves an
 * OpenRouter-style catalog where bare ids like "qwen" do not exist — requests
 * with the legacy id are rejected with 403 Forbidden. The seeder migrates
 * installs that still reference it.
 */
const CHERRYAI_LEGACY_MODEL_IDS = ['qwen'] as const
export const DEFAULT_MODEL_PREFERENCE_KEYS = [
  'chat.default_model_id',
  'feature.quick_assistant.model_id',
  'feature.translate.model_id'
] as const

type TxLike = Pick<DbType, 'select' | 'insert' | 'update' | 'delete'>
type ManagedCherryProviderRow = Omit<InsertUserProviderRow, 'orderKey'>
type CherryAiDefaultModelRow = Omit<InsertUserModelRow, 'orderKey'>
type DefaultModelPreferenceRow = {
  scope: typeof DEFAULT_MODEL_PREFERENCE_SCOPE
  key: (typeof DEFAULT_MODEL_PREFERENCE_KEYS)[number]
  value: typeof CHERRYAI_DEFAULT_UNIQUE_MODEL_ID
}

function createCherryAiProviderRow(): ManagedCherryProviderRow {
  return {
    providerId: CHERRYAI_PROVIDER_ID,
    presetProviderId: CHERRYAI_PROVIDER_ID,
    name: CHERRYAI_PROVIDER_NAME,
    endpointConfigs: {
      [ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]: {
        baseUrl: CHERRYAI_API_BASE_URL
      }
    },
    defaultChatEndpoint: ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS,
    authConfig: null,
    providerSettings: null,
    isEnabled: true
  }
}

function createCherryCloudProviderRow(): ManagedCherryProviderRow {
  return {
    providerId: CHERRY_CLOUD_PROVIDER_ID,
    presetProviderId: CHERRYAI_PROVIDER_ID,
    name: CHERRYAI_PROVIDER_NAME,
    endpointConfigs: null,
    defaultChatEndpoint: ENDPOINT_TYPE.ANTHROPIC_MESSAGES,
    authConfig: null,
    providerSettings: null,
    isEnabled: true
  }
}

function createCherryAiDefaultModelRow(): CherryAiDefaultModelRow {
  return {
    id: CHERRYAI_DEFAULT_UNIQUE_MODEL_ID,
    providerId: CHERRYAI_PROVIDER_ID,
    modelId: CHERRYAI_DEFAULT_MODEL_ID,
    presetModelId: null,
    name: CHERRYAI_DEFAULT_MODEL_NAME,
    description: null,
    group: CHERRYAI_DEFAULT_MODEL_GROUP,
    capabilities: [] as ModelCapability[],
    inputModalities: null,
    outputModalities: null,
    endpointTypes: null,
    contextWindow: null,
    maxInputTokens: null,
    maxOutputTokens: null,
    supportsStreaming: true,
    reasoning: null,
    parameters: null,
    pricing: null,
    isEnabled: true,
    isHidden: false,
    isDeprecated: false,
    notes: null
  }
}

// Exported solely for v1->v2 migration reuse; make private when migration support is dropped.
export function ensureCherryAiDefaultProviderAndModelTx(tx: TxLike): void {
  const insertedProviderCount = providerService.batchUpsertTx(tx, [createCherryAiProviderRow()])
  if (insertedProviderCount > 0) {
    logger.warn('Self-healed missing CherryAI default provider', { providerId: CHERRYAI_PROVIDER_ID })
  }

  const insertedCloudProviderCount = providerService.batchUpsertTx(tx, [createCherryCloudProviderRow()])
  if (insertedCloudProviderCount > 0) {
    logger.warn('Self-healed missing Cherry Cloud provider', { providerId: CHERRY_CLOUD_PROVIDER_ID })
  }

  const [existing] = tx
    .select({ id: userModelTable.id })
    .from(userModelTable)
    .where(eq(userModelTable.id, CHERRYAI_DEFAULT_UNIQUE_MODEL_ID))
    .limit(1)
    .all()

  if (existing) return

  logger.warn('Self-healed missing CherryAI default model', { modelId: CHERRYAI_DEFAULT_UNIQUE_MODEL_ID })
  insertManyWithOrderKey(tx, userModelTable, [createCherryAiDefaultModelRow()], {
    pkColumn: userModelTable.id,
    scope: eq(userModelTable.providerId, CHERRYAI_PROVIDER_ID)
  })
}

function createDefaultModelPreferenceRows(): DefaultModelPreferenceRow[] {
  return DEFAULT_MODEL_PREFERENCE_KEYS.map((key) => ({
    scope: DEFAULT_MODEL_PREFERENCE_SCOPE,
    key,
    value: CHERRYAI_DEFAULT_UNIQUE_MODEL_ID
  }))
}

function ensureDefaultModelPreferencesTx(tx: TxLike): void {
  for (const { scope, key, value } of createDefaultModelPreferenceRows()) {
    const [existing] = tx
      .select({ value: preferenceTable.value })
      .from(preferenceTable)
      .where(and(eq(preferenceTable.scope, scope), eq(preferenceTable.key, key)))
      .limit(1)
      .all()

    if (!existing) {
      logger.warn('Self-healed missing default model preference', { key, value })
      tx.insert(preferenceTable)
        .values({
          scope,
          key,
          value
        })
        .run()
    }
  }
}

function ensureCherryAiDefaultModelSetupTx(tx: TxLike): void {
  repairLegacyDefaultModelTx(tx)
  ensureCherryAiDefaultProviderAndModelTx(tx)
  ensureDefaultModelPreferencesTx(tx)
  repointDeadDefaultModelPreferencesTx(tx)
}

/**
 * v2.1.9 repair: the old seeded default model id ("qwen") no longer exists on
 * the api.superagent.ng gateway — every request with it returns 403 Forbidden.
 * Drop the dead model row so the fresh default can seed, and remember which
 * preference values referenced it.
 */
function repairLegacyDefaultModelTx(tx: TxLike): void {
  // Legacy branding: the managed SuperAgent provider may still be stored as
  // "CherryAI" / "CherryIN" from pre-rebrand installs.
  const renamed = tx
    .update(userProviderTable)
    .set({ name: CHERRYAI_PROVIDER_NAME })
    .where(
      and(
        inArray(userProviderTable.providerId, [CHERRYAI_PROVIDER_ID, SystemProviderIds.cherryin]),
        inArray(userProviderTable.name, [
          'CherryAI',
          'CherryIN',
          'CherryIN Models',
          'Cherry',
          'Cherry Cloud'
        ])
      )
    )
    .run()
  if (renamed.changes > 0) {
    logger.warn('Renamed legacy CherryAI/CherryIN provider to SuperAgent', {
      providerId: CHERRYAI_PROVIDER_ID
    })
  }

  for (const legacyModelId of CHERRYAI_LEGACY_MODEL_IDS) {
    const legacyUnique = createUniqueModelId(CHERRYAI_PROVIDER_ID, legacyModelId)
    const deleted = tx
      .delete(userModelTable)
      .where(
        and(eq(userModelTable.providerId, CHERRYAI_PROVIDER_ID), eq(userModelTable.modelId, legacyModelId))
      )
      .run()
    if (deleted.changes > 0) {
      logger.warn('Removed legacy CherryAI default model (dead on the gateway)', {
        modelId: legacyUnique
      })
    }
  }
}

/**
 * v2.1.9 repair: repoint the three default-model preferences when their value
 * references the legacy id or any model row that no longer exists.
 */
function repointDeadDefaultModelPreferencesTx(tx: TxLike): void {
  for (const key of DEFAULT_MODEL_PREFERENCE_KEYS) {
    const [existing] = tx
      .select({ value: preferenceTable.value })
      .from(preferenceTable)
      .where(and(eq(preferenceTable.scope, DEFAULT_MODEL_PREFERENCE_SCOPE), eq(preferenceTable.key, key)))
      .limit(1)
      .all()
    if (!existing) continue

    let value: string | null = null
    try {
      const parsed: unknown = JSON.parse(existing.value)
      value = typeof parsed === 'string' ? parsed : null
    } catch {
      value = typeof existing.value === 'string' ? existing.value : null
    }
    if (!value) continue

    // A value is dead when it references a model row that no longer exists
    // (the legacy "qwen" row was removed above; synced models come and go).
    const [row] = tx
      .select({ id: userModelTable.id })
      .from(userModelTable)
      .where(eq(userModelTable.id, value as string))
      .limit(1)
      .all()
    if (row) continue

    tx.update(preferenceTable)
      .set({ value: CHERRYAI_DEFAULT_UNIQUE_MODEL_ID })
      .where(and(eq(preferenceTable.scope, DEFAULT_MODEL_PREFERENCE_SCOPE), eq(preferenceTable.key, key)))
      .run()
    logger.warn('Repointed dead default model preference to the gateway router', {
      key,
      oldValue: value,
      newValue: CHERRYAI_DEFAULT_UNIQUE_MODEL_ID
    })
  }
}

export class CherryAiDefaultModelSeeder implements ISeeder {
  readonly name = 'cherryaiDefaultModel'
  readonly description = 'Ensure CherryAI providers, default model, and default model preferences'
  readonly version: string

  constructor() {
    this.version = hashObject({
      provider: createCherryAiProviderRow(),
      cloudProvider: createCherryCloudProviderRow(),
      model: createCherryAiDefaultModelRow(),
      preferences: createDefaultModelPreferenceRows()
    })
  }

  run(db: DbType): void {
    db.transaction((tx) => ensureCherryAiDefaultModelSetupTx(tx))
  }
}
