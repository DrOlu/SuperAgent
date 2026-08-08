// 
const config = {
  R2_CUSTOM_DOMAIN: 'superagent.ocool.online',
  R2_BUCKET_NAME: 'superagent',
  // 
  CACHE_KEY: 'superagent-latest-release',
  VERSION_DB: 'versions.json',
  LOG_FILE: 'logs.json',
  MAX_LOGS: 1000 // 
}

// Worker 
const worker = {
  // 
  scheduled: {
    cron: '*/1 * * * *' // 
  },

  //  - 
  async scheduled(event, env, ctx) {
    try {
      await initDataFiles(env)
      console.log('...')
      //  checkNewRelease 
      await checkNewRelease(env)
    } catch (error) {
      console.error(':', error)
    }
  },

  // HTTP  - 
  async fetch(request, env, ctx) {
    if (!env || !env.R2_BUCKET) {
      return new Response(
        JSON.stringify({
          error: 'R2 '
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const url = new URL(request.url)
    const filename = url.pathname.slice(1)

    try {
      // 
      if (filename) {
        return await handleDownload(env, filename)
      }

      // 
      return await getCachedRelease(env)
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error.message,
          stack: error.stack
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }
  }
}

export default worker

/**
 * 
 */
async function addLog(env, type, event, details = null) {
  try {
    const logFile = await env.R2_BUCKET.get(config.LOG_FILE)
    let logs = { logs: [] }

    if (logFile) {
      logs = JSON.parse(await logFile.text())
    }

    logs.logs.unshift({
      timestamp: new Date().toISOString(),
      type,
      event,
      details
    })

    // 
    if (logs.logs.length > config.MAX_LOGS) {
      logs.logs = logs.logs.slice(0, config.MAX_LOGS)
    }

    await env.R2_BUCKET.put(config.LOG_FILE, JSON.stringify(logs, null, 2))
  } catch (error) {
    console.error(':', error)
  }
}

/**
 * 
 */
async function getLatestRelease(env) {
  try {
    const cached = await env.R2_BUCKET.get(config.CACHE_KEY)
    if (!cached) {
      // 
      const versionDB = await env.R2_BUCKET.get(config.VERSION_DB)
      if (versionDB) {
        const versions = JSON.parse(await versionDB.text())
        if (versions.latestVersion) {
          // 
          const latestVersion = versions.versions[versions.latestVersion]
          const cacheData = {
            version: latestVersion.version,
            publishedAt: latestVersion.publishedAt,
            changelog: latestVersion.changelog,
            downloads: latestVersion.files
              .filter((file) => file.uploaded)
              .map((file) => ({
                name: file.name,
                url: `https://${config.R2_CUSTOM_DOMAIN}/${file.name}`,
                size: formatFileSize(file.size)
              }))
          }
          // 
          await env.R2_BUCKET.put(config.CACHE_KEY, JSON.stringify(cacheData))
          return new Response(JSON.stringify(cacheData), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          })
        }
      }
      // 
      const data = await checkNewRelease(env)
      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    const data = await cached.text()
    return new Response(data, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    await addLog(env, 'ERROR', '', error.message)
    return new Response(
      JSON.stringify({
        error: ': ' + error.message,
        detail: '���'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
}

//  env
async function handleDownload(env, filename) {
  try {
    const object = await env.R2_BUCKET.get(filename)

    if (!object) {
      return new Response('', { status: 404 })
    }

    // 
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    headers.set('Content-Disposition', `attachment; filename="${filename}"`)

    return new Response(object.body, {
      headers
    })
  } catch (error) {
    console.error(':', error)
    return new Response('', { status: 500 })
  }
}

/**
 *  Content-Type
 */
function getContentType(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const types = {
    exe: 'application/x-msdownload', // Windows 
    dmg: 'application/x-apple-diskimage', // macOS 
    zip: 'application/zip', // 
    AppImage: 'application/x-executable', // Linux 
    blockmap: 'application/octet-stream' // 
  }
  return types[ext] || 'application/octet-stream'
}

/**
 * 
 * B, KB, MB, GB
 */
function formatFileSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

/**
 * 
 * 
 */
function compareVersions(a, b) {
  const partsA = a.replace('v', '').split('.')
  const partsB = b.replace('v', '').split('.')

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = parseInt(partsA[i] || 0)
    const numB = parseInt(partsB[i] || 0)

    if (numA !== numB) {
      return numA - numB
    }
  }

  return 0
}

/**
 * 
 */
async function initDataFiles(env) {
  try {
    // 
    const versionDB = await env.R2_BUCKET.get(config.VERSION_DB)
    if (!versionDB) {
      const initialVersions = {
        versions: {},
        latestVersion: null,
        lastChecked: new Date().toISOString()
      }
      await env.R2_BUCKET.put(config.VERSION_DB, JSON.stringify(initialVersions, null, 2))
      await addLog(env, 'INFO', 'versions.json ')
    }

    // 
    const logFile = await env.R2_BUCKET.get(config.LOG_FILE)
    if (!logFile) {
      const initialLogs = {
        logs: [
          {
            timestamp: new Date().toISOString(),
            type: 'INFO',
            event: ''
          }
        ]
      }
      await env.R2_BUCKET.put(config.LOG_FILE, JSON.stringify(initialLogs, null, 2))
      console.log('logs.json ')
    }
  } catch (error) {
    console.error(':', error)
  }
}

// 
async function getCachedRelease(env) {
  try {
    const cached = await env.R2_BUCKET.get(config.CACHE_KEY)
    if (!cached) {
      // 
      const versionDB = await env.R2_BUCKET.get(config.VERSION_DB)
      if (versionDB) {
        const versions = JSON.parse(await versionDB.text())
        if (versions.latestVersion) {
          const latestVersion = versions.versions[versions.latestVersion]
          const cacheData = {
            version: latestVersion.version,
            publishedAt: latestVersion.publishedAt,
            changelog: latestVersion.changelog,
            downloads: latestVersion.files
              .filter((file) => file.uploaded)
              .map((file) => ({
                name: file.name,
                url: `https://${config.R2_CUSTOM_DOMAIN}/${file.name}`,
                size: formatFileSize(file.size)
              }))
          }
          // 
          await env.R2_BUCKET.put(config.CACHE_KEY, JSON.stringify(cacheData))
          return new Response(JSON.stringify(cacheData), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          })
        }
      }
      // 
      return new Response(
        JSON.stringify({
          error: ''
        }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      )
    }

    // 
    return new Response(await cached.text(), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  } catch (error) {
    await addLog(env, 'ERROR', '', error.message)
    throw error
  }
}

// 
async function checkNewRelease(env) {
  try {
    //  GitHub 
    const githubResponse = await fetch('https://api.github.com/repos/Hyperspace Technologies/superagent/releases/latest', {
      headers: { 'User-Agent': 'CloudflareWorker' }
    })

    if (!githubResponse.ok) {
      throw new Error('GitHub API ')
    }

    const releaseData = await githubResponse.json()
    const version = releaseData.tag_name

    // 
    const versionDB = await env.R2_BUCKET.get(config.VERSION_DB)
    let versions = { versions: {}, latestVersion: null, lastChecked: new Date().toISOString() }

    if (versionDB) {
      versions = JSON.parse(await versionDB.text())
    }

    // 
    let hasUpdates = false
    if (versions.latestVersion !== version) {
      await addLog(env, 'INFO', `: ${version}`)
      hasUpdates = true
    } else {
      await addLog(env, 'INFO', ` ${version} `)
    }

    // 
    const versionRecord = {
      version,
      publishedAt: releaseData.published_at,
      uploadedAt: null,
      files: releaseData.assets.map((asset) => ({
        name: asset.name,
        size: asset.size,
        uploaded: false
      })),
      changelog: releaseData.body
    }

    // 
    for (const asset of releaseData.assets) {
      try {
        const existingFile = await env.R2_BUCKET.get(asset.name)
        // 
        if (!existingFile || existingFile.size !== asset.size) {
          hasUpdates = true
          const response = await fetch(asset.browser_download_url)
          if (!response.ok) {
            throw new Error(`: HTTP ${response.status}`)
          }

          const file = await response.arrayBuffer()
          await env.R2_BUCKET.put(asset.name, file, {
            httpMetadata: { contentType: getContentType(asset.name) }
          })

          // 
          const fileIndex = versionRecord.files.findIndex((f) => f.name === asset.name)
          if (fileIndex !== -1) {
            versionRecord.files[fileIndex].uploaded = true
          }

          await addLog(env, 'INFO', `${existingFile ? '' : ''}: ${asset.name}`)
        } else {
          // 
          const fileIndex = versionRecord.files.findIndex((f) => f.name === asset.name)
          if (fileIndex !== -1) {
            versionRecord.files[fileIndex].uploaded = true
          }
          await addLog(env, 'INFO', `: ${asset.name}`)
        }
      } catch (error) {
        await addLog(env, 'ERROR', `: ${asset.name}`, error.message)
      }
    }

    // 
    if (hasUpdates) {
      // 
      versionRecord.uploadedAt = new Date().toISOString()
      versions.versions[version] = versionRecord
      versions.latestVersion = version

      // 
      await env.R2_BUCKET.put(config.VERSION_DB, JSON.stringify(versions, null, 2))

      // 
      const cacheData = {
        version,
        publishedAt: releaseData.published_at,
        changelog: releaseData.body,
        downloads: versionRecord.files
          .filter((file) => file.uploaded)
          .map((file) => ({
            name: file.name,
            url: `https://${config.R2_CUSTOM_DOMAIN}/${file.name}`,
            size: formatFileSize(file.size)
          }))
      }

      await env.R2_BUCKET.put(config.CACHE_KEY, JSON.stringify(cacheData))
      await addLog(env, 'INFO', hasUpdates ? '' : '')

      // 
      const versionList = Object.keys(versions.versions).sort((a, b) => compareVersions(b, a))
      if (versionList.length > 2) {
        // 
        const keepVersions = versionList.slice(0, 2)
        // 
        const oldVersions = versionList.slice(2)

        //  R2 
        const allFiles = await listAllFiles(env)

        // 
        const keepFiles = new Set()
        for (const keepVersion of keepVersions) {
          const versionFiles = versions.versions[keepVersion].files
          versionFiles.forEach((file) => keepFiles.add(file.name))
        }

        // 
        for (const oldVersion of oldVersions) {
          const oldFiles = versions.versions[oldVersion].files
          for (const file of oldFiles) {
            try {
              if (file.uploaded) {
                await env.R2_BUCKET.delete(file.name)
                await addLog(env, 'INFO', `: ${file.name}`)
              }
            } catch (error) {
              await addLog(env, 'ERROR', `: ${file.name}`, error.message)
            }
          }
          delete versions.versions[oldVersion]
        }

        // 
        for (const file of allFiles) {
          if (!keepFiles.has(file.name)) {
            try {
              await env.R2_BUCKET.delete(file.name)
              await addLog(env, 'INFO', `: ${file.name}`)
            } catch (error) {
              await addLog(env, 'ERROR', `: ${file.name}`, error.message)
            }
          }
        }

        // 
        await env.R2_BUCKET.put(config.VERSION_DB, JSON.stringify(versions, null, 2))
      }
    } else {
      await addLog(env, 'INFO', '')
    }

    return hasUpdates ? cacheData : null
  } catch (error) {
    await addLog(env, 'ERROR', '', error.message)
    throw error
  }
}

//  R2 
async function listAllFiles(env) {
  const files = []
  let cursor

  do {
    const listed = await env.R2_BUCKET.list({ cursor, include: ['customMetadata'] })
    files.push(...listed.objects)
    cursor = listed.cursor
  } while (cursor)

  return files
}
