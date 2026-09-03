import { readFileSync } from 'node:fs'

import { application } from '@application'
import type { AppEdition } from '@shared/types/appEdition'
import { app } from 'electron'

const APPLICATION_IDS = {
  global: 'com.hyperspace.SuperAgent',
  cn: 'com.cherryai.superagent.cn'
} as const satisfies Record<AppEdition, string>

function parseAppEdition(value: unknown): AppEdition {
  if (value === undefined || value === 'global') {
    return 'global'
  }
  if (value === 'cn') {
    return 'cn'
  }
  throw new Error(`Unsupported application edition: ${String(value)}`)
}

function resolveAppEdition(): AppEdition {
  const developmentEdition = process.env.CHERRY_EDITION?.trim().toLowerCase()
  if (!app.isPackaged && developmentEdition) {
    return parseAppEdition(developmentEdition)
  }

  const packageMetadata = JSON.parse(readFileSync(application.getPath('app.root', 'package.json'), 'utf8')) as {
    cherryEdition?: unknown
  }

  return parseAppEdition(packageMetadata.cherryEdition)
}

let cachedAppEdition: AppEdition | undefined

export function getAppEdition(): AppEdition {
  cachedAppEdition ??= resolveAppEdition()
  return cachedAppEdition
}

export function getApplicationId(): string {
  return APPLICATION_IDS[getAppEdition()]
}
